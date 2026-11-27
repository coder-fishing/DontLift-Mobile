import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  Alert,
  Linking,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { buildBankTransferDeeplink } from "../bank-transfer/deeplink";
import type {
  BankAppOption,
  BankAppPlatform,
} from "../bank-transfer/bank-app-directory";
import type { BankOption } from "../settlement/bank-directory";
import type { PremiumApi, PremiumOrder } from "./premium-api";

type BankDirectory = { list: () => Promise<BankOption[]> };
type BankAppDirectory = {
  list: (platform: BankAppPlatform) => Promise<BankAppOption[]>;
};

type Options = {
  order: PremiumOrder | null;
  api: PremiumApi;
  key: string;
  working: MutableRefObject<boolean>;
  bankDirectory?: BankDirectory;
  bankAppDirectory?: BankAppDirectory;
  applyOrder: (saved: PremiumOrder | null) => Promise<PremiumOrder | null>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  replaceLegacyOrder: (source: PremiumOrder) => void;
};

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function usePremiumBankTransfer({
  order,
  api,
  key,
  working,
  bankDirectory,
  bankAppDirectory,
  applyOrder,
  setBusy,
  setStatusMessage,
  replaceLegacyOrder,
}: Options) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [bankLookup, setBankLookup] = useState<{
    bin: string;
    code: string | null;
  } | null>(null);
  const linkLogged = useRef(false);
  const transfer = order?.status === "PENDING" ? order.bankTransfer ?? null : null;
  const bankCode =
    transfer && bankLookup?.bin === transfer.bankBin ? bankLookup.code : null;

  useEffect(() => {
    if (!transfer?.bankBin || !bankDirectory) {
      setBankLookup(null);
      return;
    }
    let active = true;
    void bankDirectory
      .list()
      .then((banks) => {
        if (active)
          setBankLookup({
            bin: transfer.bankBin,
            code: banks.find((bank) => bank.bin === transfer.bankBin)?.code ?? null,
          });
      })
      .catch(() => {
        if (active) setBankLookup({ bin: transfer.bankBin, code: null });
      });
    return () => {
      active = false;
    };
  }, [transfer?.bankBin, bankDirectory]);

  useEffect(() => {
    if (!transfer) setPickerVisible(false);
  }, [order?.requestId, order?.status, transfer?.bankBin]);

  async function openBankApp(app: BankAppOption) {
    const activeTransfer = order?.status === "PENDING" ? order.bankTransfer : null;
    const code =
      activeTransfer && bankLookup?.bin === activeTransfer.bankBin
        ? bankLookup.code
        : null;
    if (!activeTransfer || !code || !order)
      throw new Error("bank-transfer-details-unavailable");
    const url = buildBankTransferDeeplink({
      appId: app.appId,
      bankCode: code,
      accountNumber: activeTransfer.accountNumber,
      accountName: activeTransfer.accountName,
      amountVnd: order.amountVnd,
      memo: activeTransfer.memo,
      returnUrl: __DEV__
        ? "https://www.vietqr.io/deeplink"
        : "dontliftmobile://",
    });
    if (__DEV__ && !linkLogged.current) {
      console.info("[Premium bank transfer deeplink]", url);
      linkLogged.current = true;
    }
    await Linking.openURL(url);
  }

  async function prepare() {
    if (preparing || working.current || !order || order.status !== "PENDING")
      return;
    setPreparing(true);
    setStatusMessage("Refreshing PayOS transfer details…");
    try {
      let currentOrder = order;
      if (!currentOrder.bankTransfer) {
        currentOrder = await withTimeout(
          api.get(order.orderCode, true),
          18_000,
          "PayOS transfer details took too long to load. Try again or scan the QR code.",
        );
        if (currentOrder.requestId !== order.requestId)
          throw new Error(
            "The Premium payment changed. Refresh this screen and try again.",
          );
        void applyOrder(currentOrder);
      }
      if (currentOrder.status !== "PENDING")
        throw new Error(
          "This Premium payment is no longer pending. Refresh its status.",
        );
      const bankTransfer = currentOrder.bankTransfer;
      if (!bankTransfer) {
        if (__DEV__)
          console.info("[Premium bank transfer details unavailable]", {
            currentOrder,
            orderCode: currentOrder.orderCode,
            status: currentOrder.status,
          });
        const replacementOrderCode = await AsyncStorage.getItem(
          `${key}:bank-transfer-replacement-order`,
        );
        if (replacementOrderCode === String(currentOrder.orderCode)) {
          setStatusMessage(
            "The new QR still has no bank details from the Premium API. Keep this QR and scan it to pay; the API must return bank details before a bank app link can be created.",
          );
          Alert.alert(
            "Bank transfer details unavailable",
            "The Premium API did not include the receiving bank details for this new QR. Replacing it again would create another QR with the same issue. Keep this QR and scan it, or update the Premium API before trying bank transfer again.",
            [{ text: "OK" }],
          );
          return;
        }
        setStatusMessage(
          "The Premium API did not return bank app details for this QR. You can still scan the QR code below.",
        );
        Alert.alert(
          "Bank transfer details unavailable",
          "The Premium API did not return the receiving bank details needed for a prefilled bank app link. Replacing this QR will cancel it and create a new one; if the API still omits those details, the new QR will have the same limitation.",
          [
            { text: "Keep current QR", style: "cancel" },
            {
              text: "Replace QR once",
              style: "destructive",
              onPress: () => replaceLegacyOrder(currentOrder),
            },
          ],
        );
        return;
      }
      if (!bankDirectory || !bankAppDirectory)
        throw new Error("Bank app transfer is unavailable. Use the QR code below.");
      setStatusMessage("Looking up the receiving bank…");
      const banks = await withTimeout(
        bankDirectory.list(),
        12_000,
        "Bank lookup took too long. Try again or scan the QR code.",
      );
      const code = banks.find((bank) => bank.bin === bankTransfer.bankBin)?.code;
      if (!code)
        throw new Error(
          "Could not match the PayOS bank details to a supported bank. Use the QR code below.",
        );
      setBankLookup({ bin: bankTransfer.bankBin, code });
      const platform =
        Platform.OS === "ios"
          ? "ios"
          : Platform.OS === "android"
            ? "android"
            : null;
      if (!platform)
        throw new Error("Bank app transfers are only available on iOS and Android.");
      setStatusMessage("Preparing bank app links…");
      const apps = await withTimeout(
        bankAppDirectory.list(platform),
        12_000,
        "Supported bank apps took too long to load. Try again or scan the QR code.",
      );
      if (!apps.length)
        throw new Error("No supported bank apps were returned. Use the QR code below.");
      if (__DEV__ && !linkLogged.current) {
        const returnUrl = "https://www.vietqr.io/deeplink";
        const previews = apps.map((app) => ({
          appId: app.appId,
          appName: app.appName,
          url: buildBankTransferDeeplink({
            appId: app.appId,
            bankCode: code,
            accountNumber: bankTransfer.accountNumber,
            accountName: bankTransfer.accountName,
            amountVnd: currentOrder.amountVnd,
            memo: bankTransfer.memo,
            returnUrl,
          }),
        }));
        console.info("[Premium bank transfer deeplink previews]", previews);
        linkLogged.current = true;
      }
      setStatusMessage("Choose your banking app to continue.");
      setPickerVisible(true);
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "Could not prepare bank app transfer. Use the QR code below.",
      );
    } finally {
      setPreparing(false);
    }
  }

  return {
    bankCode,
    bankTransfer: transfer,
    closePicker: () => setPickerVisible(false),
    openBankApp,
    pickerVisible,
    prepare,
    preparing,
  };
}

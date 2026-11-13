import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { Colors } from "../constants/theme";
import { GlassCard } from "../components/GlassCard";
import { RoomInvitationQr } from "../components/RoomInvitationQr";
import {
  DISPLAY_PREMIUM_PACKAGES,
  getBestValuePackageId,
  getPremiumPlanLabels,
  type PremiumApi,
  type PremiumOrder,
  type PremiumPackage,
} from "../features/premium/premium-api";
import { premiumIsActive } from "../features/premium/premium-entitlement";
import { BankAppPicker } from "../features/bank-transfer/BankAppPicker";
import { BankTransferButton } from "../features/bank-transfer/BankTransferButton";
import { buildBankTransferDeeplink } from "../features/bank-transfer/deeplink";
import type {
  BankAppOption,
  BankAppPlatform,
} from "../features/bank-transfer/bank-app-directory";
import type { BankOption } from "../features/settlement/bank-directory";

const colors = Colors.light;
const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
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
type Pending = { requestId: string; packageId: string; orderCode?: number };
type Props = {
  uid: string;
  api: PremiumApi;
  expiresAtUtcMs?: number | null;
  bankDirectory?: { list: () => Promise<BankOption[]> };
  bankAppDirectory?: {
    list: (platform: BankAppPlatform) => Promise<BankAppOption[]>;
  };
};
export function PremiumScreen({
  uid,
  api,
  expiresAtUtcMs,
  bankDirectory,
  bankAppDirectory,
}: Props) {
  const [packages, setPackages] = useState<PremiumPackage[]>(
    DISPLAY_PREMIUM_PACKAGES,
  );
  const [catalogReady, setCatalogReady] = useState(false);
  const [selected, setSelected] = useState("MONTH_12");
  const [order, setOrder] = useState<PremiumOrder | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [switchPhase, setSwitchPhase] = useState<
    "debouncing" | "cancelling" | "creating" | null
  >(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankTransferPreparing, setBankTransferPreparing] = useState(false);
  const [bankLookup, setBankLookup] = useState<{
    bin: string;
    code: string | null;
  } | null>(null);
  const alive = useRef(true);
  const working = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const orderRef = useRef<PremiumOrder | null>(null);
  const selectionTouched = useRef(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchSequence = useRef(0);
  const bankTransferLinkLogged = useRef(false);
  const key = `premium-checkout:${uid}`;
  const expiry =
    Math.max(order?.premiumExpiresAtUtcMs ?? 0, expiresAtUtcMs ?? 0) || null;
  const active = premiumIsActive(expiry);
  const bestValuePackageId = getBestValuePackageId(packages);
  const selectedPackage = packages.find((pack) => pack.id === selected);
  const selectedPlanDuration = selectedPackage
    ? getPremiumPlanLabels(selectedPackage).duration
    : "selected";
  const bankTransfer =
    order?.status === "PENDING" ? (order.bankTransfer ?? null) : null;
  const bankCode =
    bankTransfer && bankLookup && bankLookup.bin === bankTransfer.bankBin
      ? bankLookup.code
      : null;

  useEffect(() => {
    if (!bankTransfer?.bankBin || !bankDirectory) {
      setBankLookup(null);
      return;
    }
    let active = true;
    void bankDirectory
      .list()
      .then((banks) => {
        if (active)
          setBankLookup({
            bin: bankTransfer.bankBin,
            code:
              banks.find((bank) => bank.bin === bankTransfer.bankBin)?.code ??
              null,
          });
      })
      .catch(() => {
        if (active) setBankLookup({ bin: bankTransfer.bankBin, code: null });
      });
    return () => {
      active = false;
    };
  }, [bankTransfer?.bankBin, bankDirectory]);

  useEffect(() => {
    if (!bankTransfer) setBankPickerVisible(false);
  }, [order?.requestId, order?.status, bankTransfer?.bankBin]);

  async function openBankApp(app: BankAppOption) {
    const transfer = order?.status === "PENDING" ? order.bankTransfer : null;
    const code =
      transfer && bankLookup && bankLookup.bin === transfer.bankBin
        ? bankLookup.code
        : null;
    if (!transfer || !code || !order)
      throw new Error("bank-transfer-details-unavailable");
    const url = buildBankTransferDeeplink({
      appId: app.appId,
      bankCode: code,
      accountNumber: transfer.accountNumber,
      accountName: transfer.accountName,
      amountVnd: order.amountVnd,
      memo: transfer.memo,
      returnUrl: __DEV__
        ? "https://www.vietqr.io/deeplink"
        : "dontliftmobile://",
    });
    if (__DEV__ && !bankTransferLinkLogged.current) {
      console.info("[Premium bank transfer deeplink]", url);
      bankTransferLinkLogged.current = true;
    }
    await Linking.openURL(url);
  }

  async function replaceLegacyOrderForBankTransfer(source: PremiumOrder) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setStatusMessage("Checking and replacing the older payment QR…");
    try {
      const latest = await api.current(true);
      if (!latest || latest.requestId !== source.requestId)
        throw new Error(
          "A different Premium payment is current. Refresh this screen before replacing a QR.",
        );
      await applyOrder(latest);
      if (latest.status === "PAID") {
        setStatusMessage(
          "Payment is already confirmed. No replacement QR was created.",
        );
        return;
      }
      if (latest.status !== "PENDING")
        throw new Error(
          "This payment is no longer pending. Refresh Premium status and try again.",
        );

      const cancelled = await api.cancelCurrent();
      if (!cancelled || cancelled.requestId !== source.requestId)
        throw new Error(
          "The old QR could not be confirmed as cancelled. No replacement was created.",
        );
      await applyOrder(cancelled);
      if (cancelled.status === "PAID") {
        setStatusMessage(
          "Payment was confirmed while replacing the QR. No new QR was created.",
        );
        return;
      }
      if (!["CANCELLED", "EXPIRED"].includes(cancelled.status))
        throw new Error(
          "The old QR is still active. No replacement was created.",
        );

      const nextRequest = {
        requestId: Crypto.randomUUID(),
        packageId: source.packageId,
      };
      await AsyncStorage.setItem(key, JSON.stringify(nextRequest));
      pendingRef.current = nextRequest;
      setPending(nextRequest);
      orderRef.current = null;
      setOrder(null);
      setSelected(source.packageId);
      selectionTouched.current = false;
      setStatusMessage("Old QR cancelled. Creating a fresh Premium payment…");

      const replacement = await api.create(
        nextRequest.requestId,
        nextRequest.packageId,
      );
      await applyOrder(replacement);
      if (replacement.bankTransfer) {
        await AsyncStorage.removeItem(
          `${key}:bank-transfer-replacement-order`,
        ).catch(() => undefined);
      } else {
        await AsyncStorage.setItem(
          `${key}:bank-transfer-replacement-order`,
          String(replacement.orderCode),
        ).catch(() => undefined);
      }
      setStatusMessage(
        replacement.bankTransfer
          ? "Fresh payment QR ready. Tap Transfer in a bank app to continue."
          : "A new QR was created, but the API did not return bank details. Keep this QR and use it to pay; replacing it again will not help until the Premium API is fixed.",
      );
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "Could not replace the old QR. You can still pay with its QR code.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function prepareBankTransfer() {
    if (
      bankTransferPreparing ||
      working.current ||
      !order ||
      order.status !== "PENDING"
    )
      return;
    setBankTransferPreparing(true);
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
      const transfer = currentOrder.bankTransfer;
      if (!transfer) {
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
              onPress: () => {
                void replaceLegacyOrderForBankTransfer(currentOrder);
              },
            },
          ],
        );
        return;
      }
      if (!bankDirectory || !bankAppDirectory)
        throw new Error(
          "Bank app transfer is unavailable. Use the QR code below.",
        );
      setStatusMessage("Looking up the receiving bank…");
      const banks = await withTimeout(
        bankDirectory.list(),
        12_000,
        "Bank lookup took too long. Try again or scan the QR code.",
      );
      const code = banks.find((bank) => bank.bin === transfer.bankBin)?.code;
      if (!code)
        throw new Error(
          "Could not match the PayOS bank details to a supported bank. Use the QR code below.",
        );
      setBankLookup({ bin: transfer.bankBin, code });
      const platform =
        Platform.OS === "ios"
          ? "ios"
          : Platform.OS === "android"
            ? "android"
            : null;
      if (!platform)
        throw new Error(
          "Bank app transfers are only available on iOS and Android.",
        );
      setStatusMessage("Preparing bank app links…");
      const apps = await withTimeout(
        bankAppDirectory.list(platform),
        12_000,
        "Supported bank apps took too long to load. Try again or scan the QR code.",
      );
      if (!apps.length)
        throw new Error(
          "No supported bank apps were returned. Use the QR code below.",
        );
      if (__DEV__ && !bankTransferLinkLogged.current) {
        const returnUrl = "https://www.vietqr.io/deeplink";
        const previews = apps.map((app) => ({
          appId: app.appId,
          appName: app.appName,
          url: buildBankTransferDeeplink({
            appId: app.appId,
            bankCode: code,
            accountNumber: transfer.accountNumber,
            accountName: transfer.accountName,
            amountVnd: currentOrder.amountVnd,
            memo: transfer.memo,
            returnUrl,
          }),
        }));
        console.info("[Premium bank transfer deeplink previews]", previews);
        bankTransferLinkLogged.current = true;
      }
      setStatusMessage("Choose your banking app to continue.");
      setBankPickerVisible(true);
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "Could not prepare bank app transfer. Use the QR code below.",
      );
    } finally {
      setBankTransferPreparing(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (switchTimer.current) clearTimeout(switchTimer.current);
    };
  }, []);

  async function applyOrder(saved: PremiumOrder | null) {
    if (!alive.current) return orderRef.current;
    // Không để pointer cũ/thiết bị khác xóa request mới vừa gửi nhưng chưa nhận response.
    if (pendingRef.current && saved?.requestId !== pendingRef.current.requestId)
      return orderRef.current;
    if (
      orderRef.current?.requestId === saved?.requestId &&
      orderRef.current?.status === "PAID" &&
      saved?.status !== "PAID"
    )
      return orderRef.current;
    orderRef.current = saved;
    setOrder(saved);
    if (saved && ["PAID", "CANCELLED", "EXPIRED"].includes(saved.status)) {
      pendingRef.current = null;
      setPending(null);
      // Trạng thái server đã chốt; lỗi dọn cache cục bộ không được che mất kết quả thanh toán.
      await AsyncStorage.removeItem(key).catch(() => undefined);
    } else if (saved) {
      const nextPending = {
        requestId: saved.requestId,
        packageId: saved.packageId,
        orderCode: saved.orderCode,
      };
      const previousPending = pendingRef.current;
      pendingRef.current = nextPending;
      if (saved.status === "PAID" || !selectionTouched.current)
        setSelected(saved.packageId);
      setPending(pendingRef.current);
      // Lưu mã đơn để lần sau hỏi trạng thái đúng QR, kể cả khi thiết bị khác tạo đơn mới hơn.
      if (
        previousPending?.requestId !== nextPending.requestId ||
        previousPending.packageId !== nextPending.packageId ||
        previousPending.orderCode !== nextPending.orderCode
      ) {
        await AsyncStorage.setItem(key, JSON.stringify(nextPending)).catch(
          () => undefined,
        );
      }
    }
    return saved;
  }

  async function refresh(forceRefresh = false) {
    const knownCheckout = pendingRef.current;
    if (!knownCheckout) return applyOrder(await api.current(forceRefresh));

    // Luôn đọc trạng thái của QR đang hiển thị; nếu chưa có mã đơn thì retry cùng requestId để phục hồi.
    const checkout =
      knownCheckout.orderCode != null
        ? await api.get(knownCheckout.orderCode, forceRefresh)
        : await api
            .create(knownCheckout.requestId, knownCheckout.packageId)
            .then((saved) => api.get(saved.orderCode));
    if (checkout.requestId !== knownCheckout.requestId) {
      throw new Error(
        "The saved Premium checkout could not be matched. Keep its QR and retry status later.",
      );
    }
    const applied = await applyOrder(checkout);
    if (["PAID", "CANCELLED", "EXPIRED"].includes(checkout.status)) {
      // Chỉ sau khi checkout đã biết kết thúc mới nhận đơn mới nhất của tài khoản.
      return applyOrder(await api.current(forceRefresh));
    }
    return applied;
  }
  async function load() {
    if (working.current) return;
    working.current = true;
    setLoading(true);
    setError("");
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached && alive.current) {
        const value: unknown = JSON.parse(cached);
        if (
          value &&
          typeof value === "object" &&
          "requestId" in value &&
          "packageId" in value &&
          typeof value.requestId === "string" &&
          typeof value.packageId === "string" &&
          (!("orderCode" in value) ||
            (typeof value.orderCode === "number" &&
              Number.isSafeInteger(value.orderCode)))
        ) {
          pendingRef.current = {
            requestId: value.requestId,
            packageId: value.packageId,
            ...("orderCode" in value &&
            typeof value.orderCode === "number" &&
            Number.isSafeInteger(value.orderCode)
              ? { orderCode: value.orderCode }
              : {}),
          };
          setPending(pendingRef.current);
          setSelected(pendingRef.current.packageId);
        }
      }
      const offers = await api.packages();
      if (!alive.current) return;
      setPackages(offers);
      if (!selectionTouched.current && !pendingRef.current) {
        setSelected(getBestValuePackageId(offers) ?? offers[0]?.id ?? "");
      }
      setCatalogReady(true);
      await refresh();
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error ? cause.message : "Unable to load Premium.",
        );
    } finally {
      working.current = false;
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [api, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkPaymentStatus() {
    if (working.current) return;
    working.current = true;
    setCheckingStatus(true);
    setError("");
    setStatusMessage("");
    try {
      const saved = await refresh(true);
      if (!alive.current) return;
      if (saved?.status === "PAID") {
        setStatusMessage(
          "Payment confirmed. Your Premium access has been extended.",
        );
      } else if (saved?.status === "PENDING" || saved?.status === "CREATING") {
        setStatusMessage(
          "PayOS has not confirmed this payment yet. If you just paid, wait a moment and check again.",
        );
      } else if (saved?.status === "CANCELLED" || saved?.status === "EXPIRED") {
        setStatusMessage(
          `This payment is ${saved.status.toLowerCase()}. You can choose a package and try again.`,
        );
      } else {
        setStatusMessage("No current Premium payment was found.");
      }
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check payment status. Please retry.",
        );
    } finally {
      working.current = false;
      if (alive.current) setCheckingStatus(false);
    }
  }

  async function cancelAndSwitchPackage(packageId: string, sequence: number) {
    const activePending = pendingRef.current;
    if (
      working.current ||
      !activePending ||
      packageId === activePending.packageId ||
      sequence !== switchSequence.current
    )
      return;
    working.current = true;
    setBusy(true);
    setSwitchPhase("cancelling");
    setError("");
    setStatusMessage("");
    try {
      const network = await Network.getNetworkStateAsync();
      if (
        network.isConnected !== true ||
        network.isInternetReachable === false
      ) {
        throw new Error(
          "Connect to the internet before cancelling this payment.",
        );
      }
      let result: PremiumOrder | null = null;
      let cancelFailure: unknown;
      try {
        result = await api.cancelCurrent();
      } catch (cause) {
        cancelFailure = cause;
      }
      // A timed-out cancel may already have reached the server. Read the exact saved order
      // before retrying or creating anything; only a terminal server state permits replacement.
      if (!result && activePending.orderCode != null) {
        const reconciled = await api
          .get(activePending.orderCode, true)
          .catch(() => null);
        if (
          reconciled?.requestId === activePending.requestId &&
          ["PAID", "CANCELLED", "EXPIRED"].includes(reconciled.status)
        )
          result = reconciled;
      }
      if (cancelFailure && !result) throw cancelFailure;
      if (!alive.current) return;
      if (!result)
        throw new Error(
          "No current payment was found. Refresh and review your Premium status.",
        );
      if (result.requestId !== activePending.requestId) {
        throw new Error(
          "A different Premium checkout is current for this account. This device’s saved QR was not confirmed cancelled, so no replacement was created. Select its package and resume that checkout before switching.",
        );
      }
      const applied = await applyOrder(result);
      if (result.status === "PAID" || applied?.status === "PAID") {
        setSelected(result.packageId);
        selectionTouched.current = false;
        setSwitchPhase(null);
        setStatusMessage(
          "Payment confirmed. Your Premium access has been extended; the package was not changed.",
        );
        return;
      }
      if (result.status !== "CANCELLED" && result.status !== "EXPIRED") {
        throw new Error(
          "The old payment is still active. Its QR remains valid, so the package was not changed.",
        );
      }

      // Chỉ tạo request mới sau khi backend xác nhận QR cũ đã không còn thanh toán được.
      const nextRequest = { requestId: Crypto.randomUUID(), packageId };
      await AsyncStorage.setItem(key, JSON.stringify(nextRequest));
      if (!alive.current) return;
      pendingRef.current = nextRequest;
      setPending(nextRequest);
      orderRef.current = null;
      setOrder(null);
      setSelected(packageId);
      selectionTouched.current = false;
      setSwitchPhase("creating");
      setStatusMessage("Previous QR cancelled. Preparing the new package QR…");

      const nextOrder = await api.create(
        nextRequest.requestId,
        nextRequest.packageId,
      );
      if (!alive.current) return;
      await applyOrder(nextOrder);
      if (!["PAID", "CANCELLED", "EXPIRED"].includes(nextOrder.status)) {
        setStatusMessage(
          nextOrder.qrCode
            ? "New payment QR is ready. Scan it with your bank app to continue."
            : "The new payment is being prepared. Its QR will appear here when ready.",
        );
      }
    } catch (cause) {
      if (alive.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not cancel the current payment.",
        );
        setStatusMessage(
          "The previous QR cancellation was not confirmed. No replacement QR was created.",
        );
      }
    } finally {
      working.current = false;
      if (alive.current) {
        setBusy(false);
        setSwitchPhase(null);
      }
    }
  }

  function selectPackage(packageId: string) {
    if (working.current) return;
    selectionTouched.current = true;
    setSelected(packageId);
    setError("");
    setStatusMessage("");
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = null;
    const sequence = ++switchSequence.current;
    const activePending = pendingRef.current;
    if (!activePending || packageId === activePending.packageId) {
      setSwitchPhase(null);
      return;
    }
    setSwitchPhase("debouncing");
    switchTimer.current = setTimeout(() => {
      switchTimer.current = null;
      if (!alive.current || sequence !== switchSequence.current) return;
      void cancelAndSwitchPackage(packageId, sequence);
    }, 400);
  }

  function retryPackageSwitch() {
    const activePending = pendingRef.current;
    if (
      working.current ||
      !activePending ||
      selected === activePending.packageId
    )
      return;
    const sequence = ++switchSequence.current;
    setError("");
    setStatusMessage("");
    setSwitchPhase("cancelling");
    void cancelAndSwitchPackage(selected, sequence);
  }

  useEffect(() => {
    if (!pending) return;
    let checking = false;
    let attempts = 0;
    const check = async () => {
      if (
        checking ||
        working.current ||
        selected !== pending.packageId ||
        attempts >= 12
      )
        return;
      checking = true;
      attempts++;
      try {
        await refresh();
      } catch {
        /* Giữ đơn durable khi mất mạng; user có thể kiểm tra lại. */
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void check();
    }, 5000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        attempts = 0;
        void check();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [api, pending?.requestId, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkout() {
    if (working.current || !catalogReady) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected !== true || network.isInternetReachable === false)
        throw new Error("Connect to the internet to purchase Premium.");
      const request = pending ?? {
        requestId: Crypto.randomUUID(),
        packageId: selected,
      };
      // Lưu request trước HTTP; timeout/restart tiếp tục cùng đơn, không mở thanh toán thứ hai.
      await AsyncStorage.setItem(key, JSON.stringify(request));
      if (!alive.current) return;
      pendingRef.current = request;
      setPending(request);
      const result = await api.create(request.requestId, request.packageId);
      if (!alive.current) return;
      selectionTouched.current = false;
      await applyOrder(result);
      if (["PAID", "CANCELLED", "EXPIRED"].includes(result.status)) {
        // Xóa identity của request terminal trước; refresh sau đó mới có thể nhận đơn mới hơn.
        await refresh();
        return;
      }
      if (result.checkoutUrl) {
        if (!/^https:\/\/pay\.payos\.vn\//.test(result.checkoutUrl))
          throw new Error("The checkout link is invalid.");
      }
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Checkout failed. Please retry.",
        );
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>DONTLIFT PREMIUM</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Choose your plan
        </Text>
        <Text style={styles.subtitle}>
          Unlimited rooms and participants. One payment, no auto-renewal.
        </Text>
        {expiry != null ? (
          <Text style={styles.expiry}>
            {active ? "Premium until" : "Previous access ended"}{" "}
            {new Date(expiry).toLocaleDateString("vi-VN")}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Loading Premium packages"
          color={colors.primary}
        />
      ) : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Premium plans"
        style={styles.packages}
      >
        {packages.map((pack) => {
          const labels = getPremiumPlanLabels(pack);
          const bonusMonths = labels.bonusMonths;
          const isSelected = selected === pack.id;
          const isBestValue =
            bestValuePackageId === pack.id && packages.length > 1;
          return (
            <Pressable
              key={pack.id}
              accessibilityRole="radio"
              accessibilityLabel={`${pack.paidMonths} ${pack.paidMonths === 1 ? "month" : "months"}, ${money(pack.amountVnd)}${bonusMonths > 0 ? `, plus ${bonusMonths} months free, use Premium for ${pack.grantedMonths} months` : ", basic access"}`}
              accessibilityHint={
                pending && pack.id !== pending.packageId
                  ? "Selecting this plan will cancel the current payment QR after a short pause, then replace it when cancellation is confirmed."
                  : "Select this Premium package"
              }
              accessibilityState={{
                checked: isSelected,
                disabled:
                  busy ||
                  loading ||
                  checkingStatus ||
                  switchPhase === "cancelling" ||
                  switchPhase === "creating",
              }}
              disabled={
                busy ||
                loading ||
                checkingStatus ||
                switchPhase === "cancelling" ||
                switchPhase === "creating"
              }
              onPress={() => selectPackage(pack.id)}
              style={({ pressed }) => [
                styles.package,
                isSelected && styles.selected,
                pressed && styles.packagePressed,
              ]}
            >
              <View style={styles.packageRow}>
                <View style={styles.packageCopy}>
                  {isBestValue ? (
                    <Text style={styles.bestValue}>BEST VALUE</Text>
                  ) : null}
                  <Text style={styles.duration}>{labels.duration}</Text>
                  {labels.bonus ? (
                    <Text style={styles.bonus}>{labels.bonus}</Text>
                  ) : null}
                  <Text style={styles.caption}>{labels.access}</Text>
                </View>
                <View style={styles.priceChoice}>
                  <Text style={styles.price}>{money(pack.amountVnd)}</Text>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.radio, isSelected && styles.radioSelected]}
                  >
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      {order && ["CANCELLED", "EXPIRED"].includes(order.status) ? (
        <Text style={styles.caption}>
          This checkout is {order.status.toLowerCase()}. Choose a package to
          start again.
        </Text>
      ) : null}
      {pending ? (
        <GlassCard className="" style={styles.status}>
          <Text style={styles.duration}>
            {selected !== pending.packageId
              ? "Switching Premium package"
              : order?.status === "CREATING"
                ? "Payment being prepared"
                : order
                  ? "Payment awaiting confirmation"
                  : "Payment setup needs retry"}
          </Text>
          {order && selected === pending.packageId ? (
            <Text style={styles.price}>{money(order.amountVnd)}</Text>
          ) : null}
          {selected !== pending.packageId || switchPhase === "creating" ? (
            <View style={styles.switchPanel}>
              {switchPhase ? (
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Preparing new payment QR"
                  style={styles.qrSkeleton}
                >
                  <View style={styles.skeletonQr} />
                  <View
                    style={[styles.skeletonLine, styles.skeletonLineShort]}
                  />
                  <Text style={styles.caption}>
                    {switchPhase === "debouncing"
                      ? `Preparing ${selectedPlanDuration} plan…`
                      : switchPhase === "cancelling"
                        ? "Cancelling the current payment QR…"
                        : "Creating your new payment QR…"}
                  </Text>
                  <Text style={styles.caption}>
                    The new QR appears after the server confirms the previous
                    payment is cancelled.
                  </Text>
                </View>
              ) : (
                <>
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  ) : (
                    <Text style={styles.caption}>
                      Choose a plan to replace the current payment QR.
                    </Text>
                  )}
                  {statusMessage ? (
                    <Text style={styles.caption}>{statusMessage}</Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry package switch"
                    disabled={busy || checkingStatus}
                    style={styles.secondary}
                    onPress={retryPackageSwitch}
                  >
                    <Text style={styles.link}>Retry package switch</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Keep current Premium package"
                    disabled={busy || checkingStatus}
                    style={styles.secondary}
                    onPress={() => selectPackage(pending.packageId)}
                  >
                    <Text style={styles.link}>Keep current package</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : order?.qrCode ? (
            <View style={styles.qrPanel}>
              {Platform.OS !== "web" ? (
                <>
                  <BankTransferButton
                    onPress={() => {
                      void prepareBankTransfer();
                    }}
                    busy={bankTransferPreparing || busy || checkingStatus}
                  />
                  {!bankTransfer ? (
                    <Text style={styles.caption}>
                      Tap to refresh PayOS transfer details, or scan the QR code
                      below.
                    </Text>
                  ) : !bankCode ? (
                    <Text style={styles.caption}>
                      Loading bank details for app transfer…
                    </Text>
                  ) : null}
                </>
              ) : null}
              <RoomInvitationQr
                value={order.qrCode}
                size={232}
                accessibilityLabel="Premium payment QR code"
              />
              <Text style={styles.qrHelp}>
                Scan this code with your bank app. Payment confirmation will
                appear here automatically.
              </Text>
            </View>
          ) : order?.status === "CREATING" ? (
            <Text style={styles.caption}>
              Your payment QR is being prepared. Keep this screen open; it will
              appear automatically.
            </Text>
          ) : order?.status === "PENDING" ? (
            <Text style={styles.caption}>
              The payment link is ready, but its QR could not be loaded yet.
              Retry below or open payOS checkout.
            </Text>
          ) : null}
          {selected === pending.packageId ? (
            <Text style={styles.caption}>
              Already transferred? Check payment status. Your access updates
              after verification.
            </Text>
          ) : null}
          {order?.checkoutUrl && selected === pending.packageId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open payOS checkout"
              style={styles.secondary}
              onPress={() => {
                void WebBrowser.openBrowserAsync(order.checkoutUrl!);
              }}
            >
              <Text style={styles.link}>Open payOS checkout</Text>
            </Pressable>
          ) : null}
          {statusMessage && order?.requestId === pending.requestId ? (
            <Text accessibilityRole="alert" style={styles.statusMessage}>
              {statusMessage}
            </Text>
          ) : null}
          {selected === pending.packageId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || checkingStatus }}
              disabled={busy || checkingStatus}
              style={styles.secondary}
              onPress={() => {
                void checkPaymentStatus();
              }}
            >
              {checkingStatus ? (
                <ActivityIndicator
                  accessibilityLabel="Checking payment status"
                  color={colors.primary}
                />
              ) : (
                <Text style={styles.link}>Check payment status</Text>
              )}
            </Pressable>
          ) : null}
        </GlassCard>
      ) : order?.status === "PAID" ? (
        <GlassCard className="" style={styles.status}>
          <Text accessibilityRole="header" style={styles.duration}>
            Payment confirmed
          </Text>
          <Text accessibilityRole="alert" style={styles.expiry}>
            Your Premium access has been extended
            {expiry
              ? ` until ${new Date(expiry).toLocaleDateString("vi-VN")}`
              : ""}
            .
          </Text>
          {statusMessage ? (
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          ) : null}
        </GlassCard>
      ) : null}
      {error && !(pending && selected !== pending.packageId) ? (
        <View accessibilityRole="alert">
          <Text style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            onPress={() => {
              void load();
            }}
          >
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <BankAppPicker
        visible={bankPickerVisible && Boolean(bankTransfer)}
        directory={bankAppDirectory}
        onClose={() => setBankPickerVisible(false)}
        onSelect={openBankApp}
      />
      {!(pending && order?.qrCode) &&
      !(pending && selected !== pending.packageId) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            pending
              ? "Continue saved Premium checkout"
              : "Purchase selected Premium package"
          }
          accessibilityState={{ disabled: busy || loading || !catalogReady }}
          disabled={busy || loading || !catalogReady}
          onPress={() => {
            void checkout();
          }}
          style={[
            styles.button,
            (busy || loading || !catalogReady) && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>
              {pending
                ? order?.status === "CREATING"
                  ? "Retry payment setup"
                  : "Load payment QR"
                : active
                  ? "Extend Premium"
                  : "Continue to Payment"}
            </Text>
          )}
        </Pressable>
      ) : null}
      <Text style={styles.footer}>
        Purchase online. When you extend early, the new months are added after
        your current access expires.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18, paddingBottom: 24 },
  heading: { gap: 8 },
  eyebrow: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
  },
  subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  expiry: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  packages: { gap: 12 },
  package: {
    minHeight: 88,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  selected: {
    borderColor: colors.primary,
    borderWidth: 2,
    padding: 14,
    backgroundColor: colors.backgroundSelected,
  },
  packagePressed: { opacity: 0.82 },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  packageCopy: { flex: 1, alignItems: "flex-start", gap: 4 },
  priceChoice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  bestValue: {
    color: colors.primary,
    backgroundColor: colors.backgroundSelected,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    overflow: "hidden",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  bonus: {
    color: colors.success,
    backgroundColor: colors.successSurface,
    fontSize: 14,
    fontWeight: "700",
    overflow: "hidden",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  duration: { color: colors.text, fontSize: 17, fontWeight: "700" },
  price: { color: colors.text, fontSize: 19, fontWeight: "700" },
  caption: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  status: { padding: 18, gap: 10 },
  statusMessage: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  secondary: { minHeight: 44, justifyContent: "center" },
  switchPanel: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qrSkeleton: { gap: 12, alignItems: "center", paddingVertical: 8 },
  skeletonQr: {
    width: 184,
    height: 184,
    borderRadius: 18,
    backgroundColor: colors.backgroundElement,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.backgroundElement,
    width: "82%",
  },
  skeletonLineShort: { width: "48%" },
  pressed: { opacity: 0.72 },
  qrPanel: {
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.inputSurface,
  },
  qrHelp: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  link: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
  button: {
    backgroundColor: colors.primary,
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  buttonText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
  footer: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
  },
});

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../constants/theme";
import { GlassCard } from "../components/GlassCard";
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
import { usePremiumBankTransfer } from "../features/premium/use-premium-bank-transfer";
import { usePremiumCheckoutActions } from "../features/premium/use-premium-checkout-actions";
import { usePremiumOrderState } from "../features/premium/use-premium-order-state";
import { PremiumPackageSelector } from "../features/premium/components/PremiumPackageSelector";
import { PremiumPendingOrderCard, type PendingPremiumOrder } from "../features/premium/components/PremiumPendingOrderCard";
import type {
  BankAppOption,
  BankAppPlatform,
} from "../features/bank-transfer/bank-app-directory";
import type { BankOption } from "../features/settlement/bank-directory";

const colors = Colors.light;
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
  const [selected, setSelected] = useState("MONTH_12");
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [switchPhase, setSwitchPhase] = useState<
    "debouncing" | "cancelling" | "creating" | null
  >(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const working = useRef(false);
  const selectionTouched = useRef(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchSequence = useRef(0);
  const orderState = usePremiumOrderState({
    api,
    uid,
    working,
    selectionTouched,
    setPackages,
    setSelected,
    setError,
  });
  const {
    alive,
    applyOrder,
    catalogReady,
    key,
    load,
    loading,
    order,
    orderRef,
    pending,
    pendingRef,
    refresh,
    setOrder,
    setPending,
  } = orderState;
  const expiry =
    Math.max(order?.premiumExpiresAtUtcMs ?? 0, expiresAtUtcMs ?? 0) || null;
  const active = premiumIsActive(expiry);
  const selectedPackage = packages.find((pack) => pack.id === selected);
  const selectedPlanDuration = selectedPackage
    ? getPremiumPlanLabels(selectedPackage).duration
    : "selected";
  const bankTransferFlow = usePremiumBankTransfer({
    order,
    api,
    key,
    working,
    bankDirectory,
    bankAppDirectory,
    applyOrder,
    setBusy,
    setStatusMessage,
    replaceLegacyOrder: (source) => {
      void replaceLegacyOrderForBankTransfer(source);
    },
  });
  const {
    bankCode,
    bankTransfer,
    closePicker,
    openBankApp,
    pickerVisible: bankPickerVisible,
    prepare: prepareBankTransfer,
    preparing: bankTransferPreparing,
  } = bankTransferFlow;

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

  const checkoutActions = usePremiumCheckoutActions({
    api,
    key,
    pending,
    pendingRef,
    selected,
    catalogReady,
    working,
    alive,
    selectionTouched,
    switchTimer,
    switchSequence,
    orderRef,
    setPending,
    setOrder,
    setSelected,
    setBusy,
    setError,
    setStatusMessage,
    setSwitchPhase,
    applyOrder,
    refresh,
  });

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
      <PremiumPackageSelector
        packages={packages}
        bestValuePackageId={getBestValuePackageId(packages)}
        selectedPackageId={selected}
        pendingPackageId={pending?.packageId}
        disabled={busy || loading || checkingStatus || switchPhase === "cancelling" || switchPhase === "creating"}
        onSelect={checkoutActions.selectPackage}
      />
      {order && ["CANCELLED", "EXPIRED"].includes(order.status) ? (
        <Text style={styles.caption}>
          This checkout is {order.status.toLowerCase()}. Choose a package to
          start again.
        </Text>
      ) : null}
      {pending ? (
        <PremiumPendingOrderCard
          pending={pending}
          order={order}
          selectedPackageId={selected}
          selectedPlanDuration={selectedPlanDuration}
          switchPhase={switchPhase}
          error={error}
          statusMessage={statusMessage}
          busy={busy}
          checkingStatus={checkingStatus}
          bankTransferPreparing={bankTransferPreparing}
          bankTransfer={bankTransfer}
          bankCode={bankCode}
          onRetryPackageSwitch={checkoutActions.retryPackageSwitch}
          onSelectPackage={checkoutActions.selectPackage}
          onPrepareBankTransfer={() => { void prepareBankTransfer(); }}
          onOpenCheckout={url => { void WebBrowser.openBrowserAsync(url); }}
          onCheckPaymentStatus={() => { void checkPaymentStatus(); }}
        />
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
        onClose={closePicker}
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
            void checkoutActions.checkout();
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

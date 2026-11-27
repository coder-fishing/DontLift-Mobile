import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type { PremiumApi, PremiumOrder } from "./premium-api";

type PendingCheckout = {
  requestId: string;
  packageId: string;
  orderCode?: number;
};
type SwitchPhase = "debouncing" | "cancelling" | "creating" | null;

type Options = {
  api: PremiumApi;
  key: string;
  pending: PendingCheckout | null;
  pendingRef: MutableRefObject<PendingCheckout | null>;
  selected: string;
  catalogReady: boolean;
  working: MutableRefObject<boolean>;
  alive: MutableRefObject<boolean>;
  selectionTouched: MutableRefObject<boolean>;
  switchTimer: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  switchSequence: MutableRefObject<number>;
  orderRef: MutableRefObject<PremiumOrder | null>;
  setPending: Dispatch<SetStateAction<PendingCheckout | null>>;
  setOrder: Dispatch<SetStateAction<PremiumOrder | null>>;
  setSelected: Dispatch<SetStateAction<string>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setSwitchPhase: Dispatch<SetStateAction<SwitchPhase>>;
  applyOrder: (saved: PremiumOrder | null) => Promise<PremiumOrder | null>;
  refresh: () => Promise<PremiumOrder | null>;
};

export function usePremiumCheckoutActions({
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
}: Options) {
  useEffect(
    () => () => {
      if (switchTimer.current) clearTimeout(switchTimer.current);
    },
    [],
  );

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

      // Create a replacement only after the backend confirms the old QR is terminal.
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
      // Persist the request before HTTP so retries continue the same checkout.
      await AsyncStorage.setItem(key, JSON.stringify(request));
      if (!alive.current) return;
      pendingRef.current = request;
      setPending(request);
      const result = await api.create(request.requestId, request.packageId);
      if (!alive.current) return;
      selectionTouched.current = false;
      await applyOrder(result);
      if (["PAID", "CANCELLED", "EXPIRED"].includes(result.status)) {
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

  return { checkout, retryPackageSwitch, selectPackage };
}

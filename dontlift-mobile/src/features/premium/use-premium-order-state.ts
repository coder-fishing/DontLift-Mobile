import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  getBestValuePackageId,
  type PremiumApi,
  type PremiumOrder,
  type PremiumPackage,
} from "./premium-api";

export type PendingPremiumCheckout = {
  requestId: string;
  packageId: string;
  orderCode?: number;
};

type Options = {
  api: PremiumApi;
  uid: string;
  working: MutableRefObject<boolean>;
  selectionTouched: MutableRefObject<boolean>;
  setPackages: Dispatch<SetStateAction<PremiumPackage[]>>;
  setSelected: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
};

export function usePremiumOrderState({
  api,
  uid,
  working,
  selectionTouched,
  setPackages,
  setSelected,
  setError,
}: Options) {
  const [order, setOrder] = useState<PremiumOrder | null>(null);
  const [pending, setPending] = useState<PendingPremiumCheckout | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogReady, setCatalogReady] = useState(false);
  const alive = useRef(true);
  const pendingRef = useRef<PendingPremiumCheckout | null>(null);
  const orderRef = useRef<PremiumOrder | null>(null);
  const key = `premium-checkout:${uid}`;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function applyOrder(saved: PremiumOrder | null) {
    if (!alive.current) return orderRef.current;
    // Ignore stale responses from another device or from a request still being created.
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
      // Server state is final; a local cache cleanup failure must not hide it.
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
      // Persist the order code so later status checks target the QR on screen.
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

    // Always read the visible QR; retry the same request ID if its order code is missing.
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
      // Only look for a newer account order after the visible checkout is terminal.
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
          pendingRef.current = value as PendingPremiumCheckout;
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

  return {
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
  };
}

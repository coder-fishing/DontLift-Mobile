"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AuthController } from "./auth-controller";
import { initialAccessState } from "./auth-state";

interface AuthContextValue {
  controller: AuthController;
  state: ReturnType<AuthController["getSnapshot"]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new AuthController());
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    () => initialAccessState,
  );

  useEffect(() => {
    void controller.start();
    const onPageShow = () => void controller.reverify();
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      controller.dispose();
    };
  }, [controller]);

  const value = useMemo(() => ({ controller, state }), [controller, state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAdminAuth must be used within AuthProvider.");
  return value;
}

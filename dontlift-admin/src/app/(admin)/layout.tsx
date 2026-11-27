"use client";

import type { ReactNode } from "react";
import { AccessStateView } from "@/features/auth/access-state-view";
import { useAdminAuth } from "@/features/auth/auth-provider";
import { AdminShell } from "@/features/dashboard/admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { state } = useAdminAuth();
  if (state.status !== "authorized") return <AccessStateView status={state.status} />;
  return <AdminShell>{children}</AdminShell>;
}

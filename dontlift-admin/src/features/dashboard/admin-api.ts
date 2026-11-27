"use client";

import type { AuthController } from "@/features/auth/auth-controller";
import { getBrowserAuth } from "@/lib/firebase/client";

export class AdminApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "AdminApiError";
  }
}

export async function adminGet<T>(path: string, controller: AuthController, signal: AbortSignal): Promise<T> {
  const auth = getBrowserAuth();
  const user = auth.currentUser;
  if (!user) throw new AdminApiError(401, "unauthenticated");
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw new DOMException("Request cancelled", "AbortError");
  const response = await fetch(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    credentials: "omit",
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    void controller.reverify();
    throw new AdminApiError(response.status, response.status === 401 ? "unauthenticated" : "forbidden");
  }
  let body: { version?: number; data?: T; code?: string };
  try {
    body = await response.json() as typeof body;
  } catch {
    throw new AdminApiError(503, "data-unavailable");
  }
  if (!response.ok || body.version !== 1 || body.data === undefined) {
    throw new AdminApiError(response.status, body.code ?? "data-unavailable");
  }
  return body.data;
}

export function currentMonthDates(): { from: string; to: string } {
  const now = new Date();
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    from: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    to: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
  };
}

export function formatVnd(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export function formatTimestamp(value: number | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short",
  }).format(value);
}

export function dateQuery(from: string, to: string): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

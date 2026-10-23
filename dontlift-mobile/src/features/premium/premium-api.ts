import type { Auth } from "firebase/auth";

export type PremiumPackage = {
  id: string;
  amountVnd: number;
  paidMonths: number;
  grantedMonths: number;
};
// Chỉ để hiển thị khi offline/chưa nối API; checkout luôn cần catalog server đã tải thành công.
export const DISPLAY_PREMIUM_PACKAGES: PremiumPackage[] = [
  { id: "MONTH_1", amountVnd: 89000, paidMonths: 1, grantedMonths: 1 },
  { id: "MONTH_3", amountVnd: 178000, paidMonths: 2, grantedMonths: 3 },
  { id: "MONTH_6", amountVnd: 356000, paidMonths: 4, grantedMonths: 6 },
  { id: "MONTH_12", amountVnd: 623000, paidMonths: 7, grantedMonths: 12 },
];
export type PremiumOrder = {
  version: 1;
  requestId: string;
  orderCode: number;
  packageId: string;
  amountVnd: number;
  status: "CREATING" | "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  checkoutUrl: string | null;
  qrCode?: string | null;
  premiumExpiresAtUtcMs: number | null;
};

function checkedOrder(value: unknown): PremiumOrder {
  if (!value || typeof value !== "object")
    throw new Error("Payment status is unavailable. Please retry.");
  const row = value as Partial<PremiumOrder>;
  if (
    row.version !== 1 ||
    typeof row.requestId !== "string" ||
    !Number.isSafeInteger(row.orderCode) ||
    typeof row.packageId !== "string" ||
    !Number.isSafeInteger(row.amountVnd) ||
    !["CREATING", "PENDING", "PAID", "CANCELLED", "EXPIRED"].includes(
      row.status ?? "",
    ) ||
    !(
      row.checkoutUrl === null ||
      (typeof row.checkoutUrl === "string" &&
        /^https:\/\/pay\.payos\.vn\//.test(row.checkoutUrl))
    ) ||
    !(
      row.qrCode == null ||
      (typeof row.qrCode === "string" &&
        row.qrCode.length > 0 &&
        row.qrCode.length <= 2048)
    ) ||
    !(
      row.premiumExpiresAtUtcMs === null ||
      Number.isSafeInteger(row.premiumExpiresAtUtcMs)
    )
  ) {
    throw new Error("Payment status is unavailable. Please retry.");
  }
  return { ...row, qrCode: row.qrCode ?? null } as PremiumOrder;
}

export function createPremiumApi(
  auth: Auth,
  baseUrl = process.env.EXPO_PUBLIC_PREMIUM_API_URL ?? "",
) {
  async function request<T>(path: string, body?: object): Promise<T> {
    if (
      !/^https:\/\/[^/?#]+/.test(baseUrl) &&
      !(
        __DEV__ &&
        /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(
          baseUrl,
        )
      )
    ) {
      throw new Error(
        "Premium checkout is not available yet. Please try again later.",
      );
    }
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in to purchase Premium.");
    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== user.uid)
      throw new Error("The signed-in account changed.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "1",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (auth.currentUser?.uid !== user.uid)
        throw new Error("The signed-in account changed.");
      const contentType =
        response.headers.get("content-type") ?? "unknown content type";
      const responseText = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        const prefix = responseText
          .trimStart()
          .slice(0, 48)
          .replace(/\s+/g, " ");
        const hint = prefix
          ? ` Response starts with “${prefix}”.`
          : " Response body is empty.";
        throw new Error(
          `Premium API returned non-JSON (HTTP ${response.status}, ${contentType}).${hint} Restart pnpm dev and check that your device can reach the API host.`,
        );
      }
      if (!response.ok) {
        const errorCode =
          data && typeof data === "object" && "code" in data &&
          typeof data.code === "string"
            ? data.code
            : null;
        if (response.status === 401)
          throw new Error("Sign in again to continue.");
        if (
          path === "/v1/premium/orders/current/cancel" &&
          response.status === 404
        ) {
          throw new Error(
            "This Premium API does not have the package-switch endpoint yet. Deploy the latest premium-api backend, then retry.",
          );
        }
        throw new Error(
          `Premium API request failed (HTTP ${response.status}${errorCode ? `, ${errorCode}` : ""}). Please retry.`,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    packages: async () => {
      const result = await request<{
        version: number;
        packages: PremiumPackage[];
      }>("/v1/premium/packages");
      if (
        result.version !== 1 ||
        !Array.isArray(result.packages) ||
        !result.packages.length ||
        result.packages.some(
          (p) =>
            !p ||
            typeof p.id !== "string" ||
            !Number.isSafeInteger(p.amountVnd) ||
            p.amountVnd <= 0 ||
            !Number.isSafeInteger(p.grantedMonths) ||
            p.grantedMonths < 1 ||
            !Number.isSafeInteger(p.paidMonths) ||
            p.paidMonths < 1,
        )
      ) {
        throw new Error("Premium packages are unavailable. Please retry.");
      }
      return result.packages;
    },
    create: async (requestId: string, packageId: string) =>
      checkedOrder(
        await request("/v1/premium/orders", {
          version: 1,
          requestId,
          packageId,
        }),
      ),
    current: async (forceRefresh = false) => {
      const result = await request<{ version: number; order: unknown }>(
        `/v1/premium/orders/current${forceRefresh ? "?refresh=1" : ""}`,
      );
      if (result.version !== 1)
        throw new Error("Payment status is unavailable. Please retry.");
      return result.order === null ? null : checkedOrder(result.order);
    },
    cancelCurrent: async () => {
      const result = await request<{ version: number; order: unknown }>(
        "/v1/premium/orders/current/cancel",
        { version: 1 },
      );
      if (result.version !== 1)
        throw new Error("The current payment could not be cancelled.");
      return result.order === null ? null : checkedOrder(result.order);
    },
    get: async (code: number) =>
      checkedOrder(await request(`/v1/premium/orders/${code}`)),
  };
}
export type PremiumApi = ReturnType<typeof createPremiumApi>;

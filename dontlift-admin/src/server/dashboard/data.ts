import "server-only";

import { FieldPath, Timestamp, type DocumentData, type Query } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/server/firebase/admin";

const USERS = "users";
const ORDERS = "premiumOrders";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_REPORT_DAYS = 90;
const HCMC_OFFSET_MS = 7 * 60 * 60 * 1000;

export class DashboardDataError extends Error {
  constructor(readonly status: 400 | 404 | 503, readonly code: "invalid-request" | "not-found" | "data-unavailable") {
    super(code);
    this.name = "DashboardDataError";
  }
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  return null;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsePageSize(value: string | null): number {
  if (value === null) return DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new DashboardDataError(400, "invalid-request");
  }
  return parsed;
}

interface UserCursor {
  createdAt: number;
  uid: string;
}

function parseCursor(value: string | null): UserCursor | null {
  if (!value) return null;
  if (value.length > 512) throw new DashboardDataError(400, "invalid-request");
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<UserCursor>;
    if (!Number.isSafeInteger(parsed.createdAt) || typeof parsed.uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(parsed.uid)) {
      throw new Error("invalid cursor");
    }
    return { createdAt: parsed.createdAt as number, uid: parsed.uid };
  } catch {
    throw new DashboardDataError(400, "invalid-request");
  }
}

function makeCursor(createdAt: number, uid: string): string {
  return Buffer.from(JSON.stringify({ createdAt, uid })).toString("base64url");
}

function startOfHcmcDayUtc(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DashboardDataError(400, "invalid-request");
  const [year, month, day] = date.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) - HCMC_OFFSET_MS;
  const check = new Date(utc + HCMC_OFFSET_MS);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new DashboardDataError(400, "invalid-request");
  }
  return utc;
}

function dateWindow(from: string, to: string): { startMs: number; endMs: number; days: number } {
  const startMs = startOfHcmcDayUtc(from);
  const endMs = startOfHcmcDayUtc(to) + 24 * 60 * 60 * 1000;
  const days = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
  if (endMs <= startMs || days > MAX_REPORT_DAYS) throw new DashboardDataError(400, "invalid-request");
  return { startMs, endMs, days };
}

function dateLabelFromUtc(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));
}

function currentMonthWindow(now: Date): { from: string; to: string } {
  const local = new Date(now.getTime() + HCMC_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = dateLabelFromUtc(now.getTime());
  return { from, to };
}

function requireOrderStatus(value: string | null): string | null {
  if (value === null || value === "") return null;
  const allowed = new Set(["CREATING", "PENDING", "PAID", "CANCELLED", "EXPIRED"]);
  if (!allowed.has(value)) throw new DashboardDataError(400, "invalid-request");
  return value;
}

function requireDate(value: string | null): string | null {
  if (value === null || value === "") return null;
  startOfHcmcDayUtc(value);
  return value;
}

function userDto(uid: string, profile: DocumentData | undefined, authRecord: { email?: string; displayName?: string; disabled?: boolean } | null) {
  const expiry = timestampMillis(profile?.premiumExpiresAt);
  const createdAt = timestampMillis(profile?.createdAt);
  return {
    uid,
    displayName: safeString(profile?.displayName) ?? authRecord?.displayName ?? null,
    email: safeString(profile?.email) ?? authRecord?.email ?? null,
    createdAt: createdAt,
    premiumExpiresAt: expiry,
    premiumActive: expiry !== null && expiry > Date.now(),
    disabled: authRecord ? Boolean(authRecord.disabled) : null,
    profileExists: Boolean(profile),
    authExists: Boolean(authRecord),
  };
}

function orderDto(orderCode: string, data: DocumentData) {
  return {
    orderCode,
    uid: safeString(data.uid),
    packageId: safeString(data.packageId),
    amountVnd: Number.isSafeInteger(data.amountVnd) && data.amountVnd >= 0 ? data.amountVnd as number : null,
    status: safeString(data.status),
    paidMonths: Number.isSafeInteger(data.paidMonths) ? data.paidMonths as number : null,
    grantedMonths: Number.isSafeInteger(data.grantedMonths) ? data.grantedMonths as number : null,
    createdAt: timestampMillis(data.createdAt),
    paidAt: timestampMillis(data.paidAt),
    grantedExpiresAt: timestampMillis(data.grantedExpiresAt),
    receiptValid: typeof data.paymentLinkId === "string" && data.paymentLinkId.length > 0
      && data.grantedExpiresAt instanceof Timestamp && data.paidAt instanceof Timestamp
      && Number.isSafeInteger(data.amountVnd) && data.amountVnd > 0
      && safeString(data.uid) !== null && safeString(data.packageId) !== null,
  };
}

async function fetchPageUsers(pageSize: number, cursor: UserCursor | null) {
  const db = getAdminFirestore();
  let query = db.collection(USERS)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc") as Query;
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.createdAt), cursor.uid);
  const snapshots = await query.limit(pageSize + 1).get();
  const hasMore = snapshots.docs.length > pageSize;
  const page = snapshots.docs.slice(0, pageSize);
  const identities = page.map((snapshot) => ({ uid: snapshot.id }));
  const userRecords = identities.length ? await getAdminAuth().getUsers(identities) : { users: [] };
  const authByUid = new Map(userRecords.users.map((record) => [record.uid, record]));
  const rows = page.map((snapshot) => userDto(snapshot.id, snapshot.data(), authByUid.get(snapshot.id) ?? null));
  const last = page.at(-1);
  const lastCreatedAt = last ? timestampMillis(last.get("createdAt")) : null;
  if (last && lastCreatedAt === null) throw new DashboardDataError(503, "data-unavailable");
  return {
    rows,
    nextCursor: hasMore && last && lastCreatedAt !== null ? makeCursor(lastCreatedAt, last.id) : null,
  };
}

async function userByEmail(email: string) {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DashboardDataError(400, "invalid-request");
  }
  try {
    const authRecord = await getAdminAuth().getUserByEmail(email);
    const profile = await getAdminFirestore().collection(USERS).doc(authRecord.uid).get();
    return userDto(authRecord.uid, profile.exists ? profile.data() : undefined, authRecord);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found") {
      return { uid: null, profileExists: false, authExists: false };
    }
    throw error;
  }
}

async function userByUid(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new DashboardDataError(400, "invalid-request");
  const [profile, authRecord] = await Promise.all([
    getAdminFirestore().collection(USERS).doc(uid).get(),
    getAdminAuth().getUser(uid).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found") return null;
      throw error;
    }),
  ]);
  if (!profile.exists && !authRecord) return { uid, profileExists: false, authExists: false };
  return userDto(uid, profile.exists ? profile.data() : undefined, authRecord);
}

async function getWindowOrders(from: string, to: string) {
  const { startMs, endMs, days } = dateWindow(from, to);
  const db = getAdminFirestore();
  const query = db.collection(ORDERS)
    .where("paidAt", ">=", Timestamp.fromMillis(startMs))
    .where("paidAt", "<", Timestamp.fromMillis(endMs))
    .orderBy("paidAt", "asc");
  const rows: ReturnType<typeof orderDto>[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let pageQuery = query.limit(500);
    if (cursor) pageQuery = pageQuery.startAfter(cursor) as typeof pageQuery;
    const page = await pageQuery.get();
    rows.push(...page.docs.map((snapshot) => orderDto(snapshot.id, snapshot.data())));
    if (page.empty || page.docs.length < 500) break;
    cursor = page.docs.at(-1);
    if (rows.length > 20000) throw new DashboardDataError(503, "data-unavailable");
  }
  return { rows, startMs, endMs, days };
}

function aggregateRevenue(rows: ReturnType<typeof orderDto>[], from: string, to: string) {
  const paidInWindow = rows.filter((row) => row.status === "PAID");
  const valid = paidInWindow.filter((row) => row.receiptValid && row.amountVnd !== null && row.paidAt !== null);
  const excluded = paidInWindow.length - valid.length;
  const daily = new Map<string, { date: string; revenueVnd: number; orders: number }>();
  const packages = new Map<string, { packageId: string; revenueVnd: number; orders: number }>();
  for (const row of valid) {
    const day = dateLabelFromUtc(row.paidAt!);
    const packageId = row.packageId!;
    const dailyRow = daily.get(day) ?? { date: day, revenueVnd: 0, orders: 0 };
    dailyRow.revenueVnd += row.amountVnd!;
    dailyRow.orders += 1;
    daily.set(day, dailyRow);
    const packageRow = packages.get(packageId) ?? { packageId, revenueVnd: 0, orders: 0 };
    packageRow.revenueVnd += row.amountVnd!;
    packageRow.orders += 1;
    packages.set(packageId, packageRow);
  }
  const days: Array<{ date: string; revenueVnd: number; orders: number }> = [];
  const startMs = startOfHcmcDayUtc(from);
  const endMs = startOfHcmcDayUtc(to) + 24 * 60 * 60 * 1000;
  for (let dayMs = startMs; dayMs < endMs; dayMs += 24 * 60 * 60 * 1000) {
    const date = dateLabelFromUtc(dayMs);
    days.push(daily.get(date) ?? { date, revenueVnd: 0, orders: 0 });
  }
  return {
    from,
    to,
    timeZone: "Asia/Ho_Chi_Minh",
    revenueVnd: valid.reduce((sum, row) => sum + row.amountVnd!, 0),
    paidOrderCount: valid.length,
    excludedPaidOrderCount: excluded,
    daily: days,
    packages: [...packages.values()].sort((a, b) => b.revenueVnd - a.revenueVnd),
  };
}

export async function getDashboardOverview(fromValue: string | null, toValue: string | null) {
  const now = new Date();
  const defaultWindow = currentMonthWindow(now);
  const from = requireDate(fromValue) ?? defaultWindow.from;
  const to = requireDate(toValue) ?? defaultWindow.to;
  const windowOrdersPromise = getWindowOrders(from, to);
  const db = getAdminFirestore();
  const [profileCount, activePremiumCount, windowOrders, latestOrders] = await Promise.all([
    db.collection(USERS).count().get(),
    db.collection(USERS).where("premiumExpiresAt", ">", Timestamp.fromMillis(now.getTime())).count().get(),
    windowOrdersPromise,
    db.collection(ORDERS).orderBy("createdAt", "desc").limit(8).get(),
  ]);
  return {
    refreshedAt: now.toISOString(),
    profileCount: profileCount.data().count,
    activePremiumCount: activePremiumCount.data().count,
    revenue: aggregateRevenue(windowOrders.rows, from, to),
    latestOrders: latestOrders.docs.map((snapshot) => orderDto(snapshot.id, snapshot.data())),
  };
}

export async function getUsersPage(url: URL) {
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query) {
    const result = query.includes("@") ? await userByEmail(query) : await userByUid(query);
    return { rows: result.uid ? [result] : [], nextCursor: null, exactMatch: true };
  }
  const page = await fetchPageUsers(parsePageSize(url.searchParams.get("limit")), parseCursor(url.searchParams.get("cursor")));
  return { ...page, exactMatch: false };
}

export async function getUserDetails(uid: string) {
  const user = await userByUid(uid);
  const orderSnapshots = await getAdminFirestore().collection(ORDERS)
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(25).get();
  return {
    user,
    orders: orderSnapshots.docs.map((snapshot) => orderDto(snapshot.id, snapshot.data())),
  };
}

export async function getOrdersPage(url: URL) {
  const pageSize = parsePageSize(url.searchParams.get("limit"));
  const status = requireOrderStatus(url.searchParams.get("status"));
  const packageId = url.searchParams.get("packageId")?.trim() || null;
  if (packageId && !/^MONTH_(1|3|6|12)$/.test(packageId)) throw new DashboardDataError(400, "invalid-request");
  const exact = url.searchParams.get("q")?.trim() ?? "";
  const dateFrom = requireDate(url.searchParams.get("from"));
  const dateTo = requireDate(url.searchParams.get("to"));
  const dateModeValue = url.searchParams.get("dateMode") ?? "created";
  if (dateModeValue !== "created" && dateModeValue !== "paid") throw new DashboardDataError(400, "invalid-request");
  const dateMode = dateModeValue === "paid" ? "paidAt" : "createdAt";
  const hasDate = Boolean(dateFrom || dateTo);
  if (Boolean(dateFrom) !== Boolean(dateTo)) throw new DashboardDataError(400, "invalid-request");
  let query: Query = getAdminFirestore().collection(ORDERS);
  if (exact) {
    if (/^\d{6,10}$/.test(exact)) {
      const exactOrder = await getAdminFirestore().collection(ORDERS).doc(exact).get();
      if (!exactOrder.exists) return { rows: [], nextCursor: null, exactMatch: true };
      const row = orderDto(exactOrder.id, exactOrder.data()!);
      const { startMs, endMs } = hasDate ? dateWindow(dateFrom!, dateTo!) : { startMs: null, endMs: null };
      const timestamp = dateMode === "createdAt" ? row.createdAt : row.paidAt;
      const matches = (!status || row.status === status) && (!packageId || row.packageId === packageId)
        && (!hasDate || (timestamp !== null && timestamp! >= startMs! && timestamp! < endMs!));
      return { rows: matches ? [row] : [], nextCursor: null, exactMatch: true };
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(exact)) throw new DashboardDataError(400, "invalid-request");
    query = query.where("uid", "==", exact);
    if (status) query = query.where("status", "==", status);
    if (packageId) query = query.where("packageId", "==", packageId);
    if (hasDate) {
      const { startMs, endMs } = dateWindow(dateFrom!, dateTo!);
      query = query.where(dateMode, ">=", Timestamp.fromMillis(startMs)).where(dateMode, "<", Timestamp.fromMillis(endMs));
    }
    query = query.orderBy(dateMode, "desc");
  } else {
    if (status) query = query.where("status", "==", status);
    if (packageId) query = query.where("packageId", "==", packageId);
    if (hasDate) {
      const { startMs, endMs } = dateWindow(dateFrom!, dateTo!);
      query = query.where(dateMode, ">=", Timestamp.fromMillis(startMs)).where(dateMode, "<", Timestamp.fromMillis(endMs));
    }
    query = query.orderBy(dateMode, "desc");
  }
  const cursor = url.searchParams.get("cursor");
  if (cursor) {
    if (cursor.length > 512) throw new DashboardDataError(400, "invalid-request");
    const snapshot = await getAdminFirestore().collection(ORDERS).doc(cursor).get();
    if (!snapshot.exists) throw new DashboardDataError(400, "invalid-request");
    query = query.startAfter(snapshot);
  }
  const page = await query.limit(pageSize + 1).get();
  const hasMore = page.docs.length > pageSize;
  const rows = page.docs.slice(0, pageSize).map((snapshot) => orderDto(snapshot.id, snapshot.data()));
  return { rows, nextCursor: hasMore ? page.docs[pageSize - 1]?.id ?? null : null, exactMatch: false };
}

export async function getRevenueReport(fromValue: string | null, toValue: string | null) {
  const now = new Date();
  const defaults = currentMonthWindow(now);
  const from = requireDate(fromValue) ?? defaults.from;
  const to = requireDate(toValue) ?? defaults.to;
  const window = await getWindowOrders(from, to);
  return { refreshedAt: now.toISOString(), ...aggregateRevenue(window.rows, from, to) };
}

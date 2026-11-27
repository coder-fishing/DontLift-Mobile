import "server-only";

import type { Auth, DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { getFirebaseRuntimeConfig } from "@/lib/firebase/config";
import { getAdminAuth } from "@/server/firebase/admin";
import { selectVerifiedAdminIdentity, type VerifiedAdmin } from "./admin-identity";

export class AdminAccessError extends Error {
  constructor(
    readonly status: 401 | 403 | 503,
    readonly code: "unauthenticated" | "forbidden" | "identity-unavailable",
  ) {
    super(code);
    this.name = "AdminAccessError";
  }
}

export type AdminAuthPort = Pick<Auth, "verifyIdToken" | "getUser">;

interface RequireAdminOptions {
  auth?: AdminAuthPort;
  projectId?: string;
}

const unauthenticatedCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
  "auth/user-not-found",
]);

function reportVerificationFailure(stage: string, error: unknown): void {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : error instanceof Error
        ? error.name
        : "unknown";
  const safeCode = /^[a-zA-Z0-9/_-]{1,80}$/.test(code) ? code : "unknown";
  console.error(`[admin-auth] ${stage} failed (${safeCode})`);
}

function isInvalidCredentialError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return typeof error.code === "string" && unauthenticatedCodes.has(error.code);
}

function parseBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s,]+)$/i);
  if (!match || match[1].length > 8192) {
    throw new AdminAccessError(401, "unauthenticated");
  }
  return match[1];
}

function assertProject(decoded: DecodedIdToken, projectId: string): void {
  const issuer = `https://securetoken.google.com/${projectId}`;
  if (decoded.aud !== projectId || decoded.iss !== issuer || typeof decoded.uid !== "string") {
    throw new AdminAccessError(401, "unauthenticated");
  }
}

async function verifyToken(auth: AdminAuthPort, token: string): Promise<DecodedIdToken> {
  try {
    return await auth.verifyIdToken(token, true);
  } catch (error) {
    reportVerificationFailure("verify-id-token", error);
    if (isInvalidCredentialError(error)) throw new AdminAccessError(401, "unauthenticated");
    throw new AdminAccessError(503, "identity-unavailable");
  }
}

async function getCurrentUser(auth: AdminAuthPort, uid: string): Promise<UserRecord> {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    reportVerificationFailure("get-user", error);
    if (isInvalidCredentialError(error)) throw new AdminAccessError(401, "unauthenticated");
    throw new AdminAccessError(503, "identity-unavailable");
  }
}

export async function requireAdmin(
  request: Request,
  options: RequireAdminOptions = {},
): Promise<VerifiedAdmin> {
  const token = parseBearerToken(request);
  let projectId: string;
  let auth: AdminAuthPort;
  try {
    projectId = options.projectId ?? getFirebaseRuntimeConfig().projectId;
    auth = options.auth ?? getAdminAuth();
  } catch (error) {
    reportVerificationFailure("firebase-admin-init", error);
    throw new AdminAccessError(503, "identity-unavailable");
  }
  const decoded = await verifyToken(auth, token);
  assertProject(decoded, projectId);

  if (decoded.admin !== true) throw new AdminAccessError(403, "forbidden");

  const currentUser = await getCurrentUser(auth, decoded.uid);
  if (currentUser.disabled) throw new AdminAccessError(401, "unauthenticated");
  if (currentUser.customClaims?.admin !== true) {
    throw new AdminAccessError(403, "forbidden");
  }
  return selectVerifiedAdminIdentity(decoded);
}

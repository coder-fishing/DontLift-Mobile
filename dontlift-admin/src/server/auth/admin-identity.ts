import type { DecodedIdToken } from "firebase-admin/auth";

export interface VerifiedAdmin {
  uid: string;
  admin: true;
  email: string | null;
  displayName: string | null;
}

export function selectVerifiedAdminIdentity(token: DecodedIdToken): VerifiedAdmin {
  return {
    uid: token.uid,
    admin: true,
    email: typeof token.email === "string" ? token.email : null,
    displayName: typeof token.name === "string" ? token.name : null,
  };
}

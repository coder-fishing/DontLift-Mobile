import type { AdminIdentity } from "./identity";

export type AccessStatus =
  | "signed-out"
  | "signing-in"
  | "invalid-credentials"
  | "verifying"
  | "authorized"
  | "forbidden"
  | "session-expired"
  | "dependency-error"
  | "signing-out"
  | "signout-incomplete";

export interface ClientAccessState {
  status: AccessStatus;
  identity: AdminIdentity | null;
}

export const initialAccessState: ClientAccessState = {
  status: "verifying",
  identity: null,
};

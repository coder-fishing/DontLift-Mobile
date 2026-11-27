export interface AdminIdentity {
  uid: string;
  admin: true;
  email: string | null;
  displayName: string | null;
}

export interface AdminIdentityEnvelope {
  version: 1;
  data: AdminIdentity;
}

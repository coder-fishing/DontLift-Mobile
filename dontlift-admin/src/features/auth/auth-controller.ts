import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { ensureTabSessionPersistence, getBrowserAuth } from "@/lib/firebase/client";
import type { AdminIdentityEnvelope } from "./identity";
import { initialAccessState, type ClientAccessState } from "./auth-state";

export interface ClientAuthUser {
  uid: string;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export interface AuthPort {
  ensureSession(): Promise<void>;
  observe(callback: (user: ClientAuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<ClientAuthUser>;
  signOut(): Promise<void>;
  currentUser(): ClientAuthUser | null;
}

type Listener = () => void;

function firebaseUser(user: User | null): ClientAuthUser | null {
  return user;
}

function makeFirebasePort(): AuthPort {
  function auth(): Auth {
    return getBrowserAuth();
  }
  return {
    ensureSession: async () => {
      await ensureTabSessionPersistence();
    },
    observe: (callback) => onAuthStateChanged(auth(), (user) => callback(firebaseUser(user))),
    signIn: async (email, password) => {
      const result = await signInWithEmailAndPassword(auth(), email, password);
      return result.user;
    },
    signOut: async () => firebaseSignOut(auth()),
    currentUser: () => firebaseUser(auth().currentUser),
  };
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

function reportAuthFailure(stage: string, error: unknown): void {
  const code = errorCode(error);
  const safeCode = code && /^[a-zA-Z0-9/_-]{1,80}$/.test(code)
    ? code
    : error instanceof Error
      ? error.name
      : "unknown";
  const safeMessage = error instanceof TypeError
    ? error.message
        .replace(/https?:\/\/[^\s"'`]+/gi, "[url]")
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
        .slice(0, 120)
    : "";
  console.warn(
    `[DontLift Admin] ${stage} failed (${safeCode})${safeMessage ? `: ${safeMessage}` : ""}`,
  );
}

function isSignInDependencyError(error: unknown): boolean {
  const code = errorCode(error);
  return Boolean(code && [
    "auth/network-request-failed",
    "auth/too-many-requests",
    "auth/web-storage-unsupported",
    "auth/operation-not-allowed",
    "app/no-app",
  ].includes(code));
}

export class AuthController {
  private state: ClientAccessState = initialAccessState;
  private readonly listeners = new Set<Listener>();
  private generation = 0;
  private activeUid: string | null = null;
  private abortController: AbortController | null = null;
  private unsubscribe: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly port: AuthPort = makeFirebasePort(),
    private readonly fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  readonly getSnapshot = (): ClientAccessState => this.state;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(status: ClientAccessState["status"], identity: ClientAccessState["identity"] = null) {
    if (this.disposed) return;
    this.state = { status, identity };
    this.listeners.forEach((listener) => listener());
  }

  private invalidatePendingWork(): number {
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;
    return this.generation;
  }

  private isCurrent(generation: number, uid: string): boolean {
    return !this.disposed && this.generation === generation && this.activeUid === uid;
  }

  async start(): Promise<void> {
    this.disposed = false;
    try {
      await this.port.ensureSession();
      if (this.disposed || this.unsubscribe) return;
      this.unsubscribe = this.port.observe((user) => {
        void this.onAuthChanged(user);
      });
    } catch (error) {
      reportAuthFailure("auth-start", error);
      this.activeUid = null;
      this.invalidatePendingWork();
      this.publish("dependency-error");
    }
  }

  private async onAuthChanged(user: ClientAuthUser | null): Promise<void> {
    if (this.disposed) return;
    if (!user) {
      if (this.activeUid === null && this.state.status === "signed-out") return;
      this.activeUid = null;
      this.invalidatePendingWork();
      this.publish("signed-out");
      return;
    }
    if (this.activeUid === user.uid) return;

    this.activeUid = user.uid;
    const generation = this.invalidatePendingWork();
    this.publish("verifying");
    await this.verifyUser(user, generation);
  }

  async signIn(email: string, password: string): Promise<void> {
    this.activeUid = null;
    const generation = this.invalidatePendingWork();
    this.publish("signing-in");
    try {
      await this.port.ensureSession();
      const user = await this.port.signIn(email.trim(), password);
      if (this.disposed || generation !== this.generation) return;
      this.activeUid = user.uid;
      await this.verifyUser(user, generation);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      reportAuthFailure("sign-in", error);
      this.activeUid = null;
      this.publish(isSignInDependencyError(error) ? "dependency-error" : "invalid-credentials");
    }
  }

  async reverify(): Promise<void> {
    let user: ClientAuthUser | null;
    try {
      user = this.port.currentUser();
    } catch (error) {
      reportAuthFailure("session-restore", error);
      this.activeUid = null;
      this.invalidatePendingWork();
      this.publish("dependency-error");
      return;
    }
    if (!user) {
      this.activeUid = null;
      this.invalidatePendingWork();
      this.publish("signed-out");
      return;
    }
    this.activeUid = user.uid;
    const generation = this.invalidatePendingWork();
    this.publish("verifying");
    await this.verifyUser(user, generation);
  }

  async retry(): Promise<void> {
    if (this.state.status === "signout-incomplete") {
      await this.signOut();
      return;
    }
    await this.start();
    await this.reverify();
  }

  async signOut(): Promise<void> {
    this.activeUid = null;
    const generation = this.invalidatePendingWork();
    this.publish("signing-out");
    try {
      await this.port.signOut();
      if (this.disposed || generation !== this.generation) return;
      this.publish("signed-out");
    } catch {
      if (this.disposed || generation !== this.generation) return;
      this.publish("signout-incomplete");
    }
  }

  private async verifyUser(user: ClientAuthUser, generation: number): Promise<void> {
    const uid = user.uid;
    const controller = new AbortController();
    let stage = "get-id-token";
    this.abortController = controller;
    try {
      let token = await user.getIdToken(false);
      if (!this.isCurrent(generation, uid)) return;
      stage = "identity-api-fetch";
      let response = await this.fetchIdentity(token, controller.signal);
      if (!this.isCurrent(generation, uid)) return;
      stage = "identity-api-response";

      if (response.status === 401) {
        stage = "refresh-id-token";
        token = await user.getIdToken(true);
        if (!this.isCurrent(generation, uid)) return;
        stage = "identity-api-retry";
        response = await this.fetchIdentity(token, controller.signal);
        stage = "identity-api-response";
      }
      if (!this.isCurrent(generation, uid)) return;

      if (response.status === 401) {
        this.publish("session-expired");
        return;
      }
      if (response.status === 403) {
        this.publish("forbidden");
        return;
      }
      if (response.status === 503 || response.status >= 500) {
        console.warn(`[DontLift Admin] identity-api returned HTTP ${response.status}`);
        this.publish("dependency-error");
        return;
      }
      if (!response.ok) {
        console.warn(`[DontLift Admin] identity-api returned HTTP ${response.status}`);
        this.publish("dependency-error");
        return;
      }

      stage = "identity-api-json";
      const envelope = (await response.json()) as AdminIdentityEnvelope;
      if (
        envelope?.version !== 1 ||
        envelope.data?.uid !== uid ||
        envelope.data?.admin !== true ||
        (envelope.data.email !== null && typeof envelope.data.email !== "string") ||
        (envelope.data.displayName !== null && typeof envelope.data.displayName !== "string")
      ) {
        console.warn("[DontLift Admin] identity-api returned an invalid response");
        this.publish("dependency-error");
        return;
      }
      this.publish("authorized", envelope.data);
    } catch (error) {
      if (!this.isCurrent(generation, uid)) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      reportAuthFailure(stage, error);
      const code = errorCode(error);
      if (code?.startsWith("auth/") && code !== "auth/network-request-failed" && code !== "auth/too-many-requests") {
        this.publish("session-expired");
        return;
      }
      this.publish("dependency-error");
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  }

  private fetchIdentity(token: string, signal: AbortSignal): Promise<Response> {
    return this.fetcher("/api/admin/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
      signal,
    });
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.abortController?.abort();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }
}

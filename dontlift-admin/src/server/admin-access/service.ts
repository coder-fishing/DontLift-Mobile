import type { Auth, UserRecord } from "firebase-admin/auth";
import type { AdminAccessCommand, OperatorCommand, OperatorResult } from "./types";
import { commandPayloadFingerprint } from "./validation";
import type {
  AdminAccessRepository,
  NewAccessCommand,
  RecordedEvent,
} from "./repository";
import { loadRecoverableCommand, RecoveryError } from "./recovery";

export class OperatorServiceError extends Error {
  constructor(
    readonly code: string,
    readonly exitCode: 2 | 3 | 4 | 5 | 6,
    message = code,
  ) {
    super(message);
    this.name = "OperatorServiceError";
  }
}

type AuthPort = Pick<Auth, "getUser" | "setCustomUserClaims" | "revokeRefreshTokens">;

export interface AdminAccessServiceDependencies {
  auth: AuthPort;
  repository: AdminAccessRepository;
  projectId: string;
}

function providerCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

function userNotFound(error: unknown): boolean {
  return providerCode(error) === "auth/user-not-found";
}

function safeEffectCode(step: string, error: unknown): string {
  const code = providerCode(error);
  if (code === "auth/user-not-found") return "target-not-found";
  if (code === "auth/insufficient-permission" || code === "app/invalid-credential") return "operator-credential-rejected";
  if (step === "claimWrite") return "claim-write-unverified";
  if (step === "invalidation") return "session-invalidation-unverified";
  if (step === "readback") return "readback-unavailable";
  return "dependency-unavailable";
}

function plainClaims(user: UserRecord): Record<string, unknown> {
  const claims: unknown = user.customClaims ?? {};
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new OperatorServiceError("unsupported-claims", 5);
  }
  try {
    return JSON.parse(JSON.stringify(claims)) as Record<string, unknown>;
  } catch {
    throw new OperatorServiceError("unsupported-claims", 5);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function claimsWithoutAdmin(claims: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...claims };
  delete rest.admin;
  return rest;
}

function event(input: Omit<RecordedEvent, "operatorRef">, operatorRef: string): RecordedEvent {
  return { ...input, operatorRef };
}

function terminalResult(
  operation: OperatorCommand["operation"],
  command: AdminAccessCommand,
  nextAction?: string,
): OperatorResult {
  const outcome = command.state === "completed" || command.state === "unchanged" || command.state === "failed-before-change"
    ? command.state
    : command.state === "partial" ? "partial" : "unknown";
  return {
    version: 1,
    operation,
    projectId: command.projectId,
    targetUid: command.targetUid,
    commandId: command.commandId,
    outcome,
    effects: { ...command.stepStates },
    code: command.errorCode ?? undefined,
    nextAction,
    notice: operation === "revoke" || ((operation === "status" || operation === "reconcile") && command.action === "revoke")
      ? "Refresh-token revocation is account-wide and may sign this identity out of DontLift Mobile and other clients."
      : undefined,
  };
}

export class AdminAccessService {
  constructor(private readonly dependencies: AdminAccessServiceDependencies) {}

  private requireProject(projectId: string): void {
    if (projectId !== this.dependencies.projectId) {
      throw new OperatorServiceError("project-mismatch", 2);
    }
  }

  private async getTarget(uid: string): Promise<UserRecord> {
    try {
      return await this.dependencies.auth.getUser(uid);
    } catch (error) {
      if (userNotFound(error)) throw new OperatorServiceError("target-not-found", 2);
      throw new OperatorServiceError("dependency-unavailable", 5);
    }
  }

  async inspect(projectId: string, uid: string): Promise<OperatorResult> {
    this.requireProject(projectId);
    const user = await this.getTarget(uid);
    return {
      version: 1,
      operation: "inspect",
      projectId,
      targetUid: uid,
      enabled: !user.disabled,
      admin: user.customClaims?.admin === true,
    };
  }

  async status(projectId: string, commandId: string): Promise<OperatorResult> {
    this.requireProject(projectId);
    const command = await this.dependencies.repository.getCommand(commandId);
    if (!command || command.projectId !== projectId) {
      throw new OperatorServiceError("command-not-found", 2);
    }
    let observed: boolean | undefined;
    let observationError: string | undefined;
    let eventHistoryUnavailable = false;
    let events: Awaited<ReturnType<AdminAccessRepository["getEvents"]>> = [];
    try {
      const current = await this.dependencies.auth.getUser(command.targetUid);
      observed = current.customClaims?.admin === true;
    } catch {
      observed = undefined;
      observationError = "current-auth-unavailable";
    }
    try {
      events = await this.dependencies.repository.getEvents(commandId);
    } catch {
      // Status remains useful if the optional event history is temporarily unavailable.
      eventHistoryUnavailable = true;
    }
    return {
      ...terminalResult("status", command),
      outcome: command.state === "prepared" || command.state === "running"
        ? "unknown"
        : command.state,
      effects: { ...command.stepStates },
      admin: observed,
      observationError,
      eventHistoryUnavailable,
      events: events.map((entry) => ({
        sequence: entry.sequence,
        kind: entry.kind,
        occurredAt: entry.serverTime.toDate().toISOString(),
        step: entry.step,
        outcome: entry.outcome,
        error: entry.error,
      })),
      code: command.errorCode ?? undefined,
      nextAction: observationError
        ? "Current Auth state could not be observed; retry status before deciding how to proceed."
        : eventHistoryUnavailable
          ? "Event history could not be loaded; retry status before reconciliation."
          : command.state === "partial" || command.state === "unknown" || command.state === "running" || command.state === "prepared"
            ? "Review the recorded effects and reconcile only after confirming the previous worker has stopped."
            : undefined,
      notice: command.action === "revoke"
        ? "Refresh-token revocation is account-wide and may sign this identity out of DontLift Mobile and other clients."
        : undefined,
    };
  }

  async mutate(input: Extract<OperatorCommand, { operation: "grant" | "revoke" }>): Promise<OperatorResult> {
    this.requireProject(input.projectId);
    const initial = await this.getTarget(input.uid);
    if (initial.disabled) throw new OperatorServiceError("target-disabled", 2);

    const fingerprint = commandPayloadFingerprint({
      projectId: input.projectId,
      uid: input.uid,
      action: input.operation,
      operator: input.operator,
      reason: input.reason,
    });
    const reserveInput: NewAccessCommand = {
      version: 1,
      commandId: input.commandId,
      projectId: input.projectId,
      targetUid: input.uid,
      operatorRef: input.operator,
      action: input.operation,
      payloadFingerprint: fingerprint,
      reason: input.reason,
      beforeAdmin: initial.customClaims?.admin === true,
    };
    let reservation;
    try {
      reservation = await this.dependencies.repository.reserveCommand(reserveInput);
    } catch {
      throw new OperatorServiceError("initial-audit-unavailable", 4);
    }
    if (reservation.kind === "conflict") throw new OperatorServiceError("command-or-target-locked", 3);
    if (reservation.kind === "existing") return terminalResult(input.operation, reservation.command);

    const commandId = input.commandId;
    const operatorRef = input.operator;
    let effectStarted = false;
    let stepStates: AdminAccessCommand["stepStates"] = {
      claimWrite: "planned",
      invalidation: input.operation === "revoke" ? "planned" : "not-required",
      readback: "planned",
      recording: "confirmed",
    };
    let beforeAdmin = reserveInput.beforeAdmin;
    let afterAdmin: boolean | null = beforeAdmin;
    let expectedUnrelatedClaims: string | null = null;
    let invalidationCutoff: Date | null = null;
    const errors: string[] = [];

    const persist = async (entry: RecordedEvent, release = false) => {
      try {
        await this.dependencies.repository.recordEvent(commandId, entry, release);
      } catch {
        stepStates = { ...stepStates, recording: "failed" };
        throw new OperatorServiceError("audit-recording-failed", effectStarted ? 6 : 4);
      }
      if (entry.stepStates) stepStates = { ...stepStates, ...entry.stepStates };
      if (entry.beforeAdmin !== undefined && entry.beforeAdmin !== null) beforeAdmin = entry.beforeAdmin;
      if (entry.afterAdmin !== undefined) afterAdmin = entry.afterAdmin;
      if (entry.invalidationCutoff !== undefined) invalidationCutoff = entry.invalidationCutoff;
    };

    try {
      let user = await this.getTarget(input.uid);
      if (user.disabled) {
        await persist(event({
          kind: "target-disabled-before-effect",
          step: "readback",
          outcome: "failed",
          state: "failed-before-change",
          stepStates: { claimWrite: "not-required", invalidation: "not-required", readback: "confirmed" },
          errorCode: "target-disabled",
        }, operatorRef), true);
        throw new OperatorServiceError("target-disabled", 2);
      }

      let claims = plainClaims(user);
      beforeAdmin = claims.admin === true;
      const shouldWriteClaim = input.operation === "grant" ? !beforeAdmin : beforeAdmin;
      if (shouldWriteClaim) {
        await persist(event({
          kind: "claim-write-started",
          step: "claimWrite",
          outcome: "started",
          state: "running",
          stepStates: { claimWrite: "started" },
          beforeAdmin,
        }, operatorRef));
        effectStarted = true;

        const unrelatedBefore = claimsWithoutAdmin(claims);
        expectedUnrelatedClaims = stableJson(unrelatedBefore);
        const nextClaims = input.operation === "grant"
          ? { ...claims, admin: true }
          : claimsWithoutAdmin(claims);
        try {
          await this.dependencies.auth.setCustomUserClaims(input.uid, nextClaims);
          await persist(event({
            kind: "claim-write-confirmed",
            step: "claimWrite",
            outcome: "confirmed",
            stepStates: { claimWrite: "confirmed" },
          }, operatorRef));
        } catch (error) {
          errors.push(safeEffectCode("claimWrite", error));
          stepStates = { ...stepStates, claimWrite: "unknown" };
          try {
            await persist(event({
              kind: "claim-write-unknown",
              step: "claimWrite",
              outcome: "unknown",
              error: errors.at(-1),
              state: "unknown",
              stepStates: { claimWrite: "unknown" },
              errorCode: errors.at(-1),
            }, operatorRef));
          } catch {
            throw new OperatorServiceError("audit-recording-failed", 6);
          }
        }
      } else {
        expectedUnrelatedClaims = stableJson(claimsWithoutAdmin(claims));
        await persist(event({
          kind: "claim-write-not-required",
          step: "claimWrite",
          outcome: "not-required",
          stepStates: { claimWrite: "not-required" },
          beforeAdmin,
        }, operatorRef));
      }

      if (input.operation === "revoke") {
        await persist(event({
          kind: "session-invalidation-started",
          step: "invalidation",
          outcome: "started",
          state: "running",
          stepStates: { invalidation: "started" },
        }, operatorRef));
        effectStarted = true;
        try {
          await this.dependencies.auth.revokeRefreshTokens(input.uid);
          const invalidatedUser = await this.dependencies.auth.getUser(input.uid);
          invalidationCutoff = invalidatedUser.tokensValidAfterTime
            ? new Date(invalidatedUser.tokensValidAfterTime)
            : null;
          if (!invalidationCutoff || Number.isNaN(invalidationCutoff.getTime())) {
            throw new Error("invalidation-readback-unavailable");
          }
          await persist(event({
            kind: "session-invalidation-confirmed",
            step: "invalidation",
            outcome: "confirmed",
            stepStates: { invalidation: "confirmed" },
            invalidationCutoff,
          }, operatorRef));
        } catch (error) {
          errors.push(safeEffectCode("invalidation", error));
          stepStates = { ...stepStates, invalidation: "unknown" };
          try {
            await persist(event({
              kind: "session-invalidation-unknown",
              step: "invalidation",
              outcome: "unknown",
              error: errors.at(-1),
              state: "unknown",
              stepStates: { invalidation: "unknown" },
              errorCode: errors.at(-1),
            }, operatorRef));
          } catch {
            throw new OperatorServiceError("audit-recording-failed", 6);
          }
        }
      }

      await persist(event({
        kind: "readback-started",
        step: "readback",
        outcome: "started",
        state: "running",
        stepStates: { readback: "started" },
      }, operatorRef));
      try {
        user = await this.dependencies.auth.getUser(input.uid);
        claims = plainClaims(user);
        afterAdmin = claims.admin === true;
        const desiredAdmin = input.operation === "grant";
        const readbackErrors: string[] = [];
        if (user.disabled || afterAdmin !== desiredAdmin) {
          readbackErrors.push("readback-mismatch");
        }
        if (
          expectedUnrelatedClaims !== null &&
          stableJson(claimsWithoutAdmin(claims)) !== expectedUnrelatedClaims
        ) {
          readbackErrors.push("unrelated-claims-changed");
        }
        if (afterAdmin === desiredAdmin) stepStates = { ...stepStates, claimWrite: "confirmed" };
        errors.push(...readbackErrors);
        await persist(event({
          kind: readbackErrors.length ? "readback-mismatch" : "readback-confirmed",
          step: "readback",
          outcome: readbackErrors.length ? "failed" : "confirmed",
          stepStates: { readback: readbackErrors.length ? "failed" : "confirmed" },
          afterAdmin,
          state: readbackErrors.length ? "unknown" : undefined,
          errorCode: readbackErrors.at(-1) ?? null,
        }, operatorRef));
      } catch (error) {
        errors.push(safeEffectCode("readback", error));
        stepStates = { ...stepStates, readback: "unknown" };
        try {
          await persist(event({
            kind: "readback-unknown",
            step: "readback",
            outcome: "unknown",
            state: "unknown",
            stepStates: { readback: "unknown" },
            errorCode: errors.at(-1),
          }, operatorRef));
        } catch {
          throw new OperatorServiceError("audit-recording-failed", 6);
        }
      }

      const revocationComplete = input.operation === "grant" || stepStates.invalidation === "confirmed";
      const roleComplete = afterAdmin === (input.operation === "grant");
      const allConfirmed = roleComplete && revocationComplete && stepStates.readback === "confirmed";
      const outcome = allConfirmed
        ? (input.operation === "grant" && beforeAdmin ? "unchanged" : "completed")
        : errors.some((code) => code === "readback-mismatch") ? "partial" : "unknown";
      const finalState = outcome;
      await persist(event({
        kind: `command-${outcome}`,
        step: "recording",
        outcome,
        state: finalState,
        stepStates: { ...stepStates, recording: "confirmed" },
        beforeAdmin,
        afterAdmin,
        invalidationCutoff,
        errorCode: allConfirmed ? null : errors.at(-1) ?? null,
      }, operatorRef), allConfirmed);

      const command = await this.dependencies.repository.getCommand(commandId);
      if (!command) throw new OperatorServiceError("command-not-found-after-write", 6);
      return terminalResult(input.operation, {
        ...command,
        state: finalState,
        stepStates: { ...stepStates, recording: "confirmed" },
        beforeAdmin,
        afterAdmin,
        invalidationCutoff: invalidationCutoff
          ? command.invalidationCutoff
          : null,
        errorCode: allConfirmed ? null : errors.at(-1) ?? null,
      });
    } catch (error) {
      if (error instanceof OperatorServiceError) throw error;
      const safeCode = safeEffectCode("dependency", error);
      if (!effectStarted) {
        try {
          await persist(event({
            kind: "failed-before-auth-effect",
            step: "readback",
            outcome: "failed",
            state: "failed-before-change",
            stepStates: { claimWrite: "not-required", invalidation: "not-required", readback: "failed" },
            errorCode: safeCode,
          }, operatorRef), true);
        } catch {
          throw new OperatorServiceError("audit-recording-failed", 4);
        }
        throw new OperatorServiceError(safeCode, 5);
      }
      try {
        await persist(event({
          kind: "command-unknown",
          step: "recording",
          outcome: "unknown",
          state: "unknown",
          stepStates: { ...stepStates, recording: "confirmed" },
          afterAdmin,
          errorCode: safeCode,
        }, operatorRef));
      } catch {
        throw new OperatorServiceError("audit-recording-failed-after-effect", 6);
      }
      throw new OperatorServiceError(safeCode, 6);
    }
  }

  async reconcile(input: Extract<OperatorCommand, { operation: "reconcile" }>): Promise<OperatorResult> {
    this.requireProject(input.projectId);
    let command: AdminAccessCommand;
    try {
      command = await loadRecoverableCommand(this.dependencies.repository, input);
    } catch (error) {
      if (error instanceof RecoveryError) throw new OperatorServiceError(error.code, error.exitCode);
      throw new OperatorServiceError("dependency-unavailable", 5);
    }

    await this.dependencies.repository.recordEvent(command.commandId, {
      kind: "reconcile-started",
      step: "recording",
      outcome: "started",
      state: "running",
      operatorRef: input.operator,
    });
    const user = await this.getTarget(command.targetUid);
    if (command.action === "grant" && user.disabled) {
      throw new OperatorServiceError("target-disabled", 2);
    }
    let claims = plainClaims(user);
    if (command.action === "grant" && claims.admin !== true) {
      // Reconcile is an explicit apply operation after the prior worker is confirmed stopped.
      await this.dependencies.repository.recordEvent(command.commandId, {
        kind: "reconcile-grant-write-started",
        step: "claimWrite",
        outcome: "started",
        state: "running",
        stepStates: { claimWrite: "started" },
        operatorRef: input.operator,
      });
      await this.dependencies.auth.setCustomUserClaims(command.targetUid, { ...claims, admin: true });
      await this.dependencies.repository.recordEvent(command.commandId, {
        kind: "reconcile-grant-write-confirmed",
        step: "claimWrite",
        outcome: "confirmed",
        stepStates: { claimWrite: "confirmed" },
        afterAdmin: true,
        operatorRef: input.operator,
      });
      claims = { ...claims, admin: true };
    }

    if (command.action === "revoke" && claims.admin === true) {
      await this.dependencies.repository.recordEvent(command.commandId, {
        kind: "reconcile-claim-write-started",
        step: "claimWrite",
        outcome: "started",
        state: "running",
        stepStates: { claimWrite: "started" },
        operatorRef: input.operator,
      });
      await this.dependencies.auth.setCustomUserClaims(command.targetUid, claimsWithoutAdmin(claims));
      await this.dependencies.repository.recordEvent(command.commandId, {
        kind: "reconcile-claim-write-confirmed",
        step: "claimWrite",
        outcome: "confirmed",
        stepStates: { claimWrite: "confirmed" },
        afterAdmin: false,
        operatorRef: input.operator,
      });
      claims = claimsWithoutAdmin(claims);
    }

    let invalidationCutoff: Date | null = null;
    if (command.action === "revoke" && command.stepStates.invalidation !== "confirmed") {
      await this.dependencies.repository.recordEvent(command.commandId, {
        kind: "reconcile-invalidation-started",
        step: "invalidation",
        outcome: "started",
        state: "running",
        stepStates: { invalidation: "started" },
        operatorRef: input.operator,
      });
      await this.dependencies.auth.revokeRefreshTokens(command.targetUid);
      const reread = await this.dependencies.auth.getUser(command.targetUid);
      invalidationCutoff = reread.tokensValidAfterTime ? new Date(reread.tokensValidAfterTime) : null;
      if (!invalidationCutoff) throw new OperatorServiceError("session-invalidation-unverified", 6);
      await this.dependencies.repository.recordEvent(command.commandId, {
        kind: "reconcile-invalidation-confirmed",
        step: "invalidation",
        outcome: "confirmed",
        stepStates: { invalidation: "confirmed" },
        invalidationCutoff,
        operatorRef: input.operator,
      });
    }

    const readback = await this.dependencies.auth.getUser(command.targetUid);
    const afterAdmin = readback.customClaims?.admin === true;
    if (readback.disabled || afterAdmin !== (command.action === "grant")) {
      throw new OperatorServiceError("reconcile-outcome-unverified", 6);
    }
    const complete = command.action === "grant" || command.stepStates.invalidation === "confirmed" || Boolean(invalidationCutoff);
    const finalState = complete ? (command.action === "grant" && command.beforeAdmin ? "unchanged" : "completed") : "unknown";
    await this.dependencies.repository.recordEvent(command.commandId, {
      kind: `reconcile-${finalState}`,
      step: "recording",
      outcome: finalState,
      state: finalState,
      stepStates: { claimWrite: "confirmed", readback: "confirmed", recording: "confirmed" },
      afterAdmin,
      invalidationCutoff,
      operatorRef: input.operator,
    }, complete);
    const updated = await this.dependencies.repository.getCommand(command.commandId);
    if (!updated) throw new OperatorServiceError("command-not-found-after-write", 6);
    return terminalResult("reconcile", updated);
  }
}


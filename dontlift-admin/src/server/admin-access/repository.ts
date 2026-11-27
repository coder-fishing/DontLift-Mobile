import { createHash } from "node:crypto";
import {
  FieldValue,
  Timestamp,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { retentionDeadline } from "./retention";
import type {
  AccessAction,
  AccessCommandState,
  AdminAccessCommand,
  AdminAccessLock,
  OperatorEvent,
  StepState,
} from "./types";

export interface NewAccessCommand {
  version: 1;
  commandId: string;
  projectId: string;
  targetUid: string;
  operatorRef: string;
  action: AccessAction;
  payloadFingerprint: string;
  reason: string;
  beforeAdmin: boolean;
}

export interface RecordedEvent {
  kind: string;
  step: string;
  outcome: StepState | AccessCommandState | "observed";
  error?: string | null;
  operatorRef: string;
  state?: AccessCommandState;
  stepStates?: Partial<AdminAccessCommand["stepStates"]>;
  beforeAdmin?: boolean | null;
  afterAdmin?: boolean | null;
  invalidationCutoff?: Date | null;
  errorCode?: string | null;
}

export type ReserveCommandResult =
  | { kind: "created"; command: AdminAccessCommand }
  | { kind: "existing"; command: AdminAccessCommand }
  | { kind: "conflict"; command?: AdminAccessCommand };

export interface AdminAccessRepository {
  reserveCommand(input: NewAccessCommand): Promise<ReserveCommandResult>;
  recordEvent(commandId: string, event: RecordedEvent, releaseLock?: boolean): Promise<void>;
  getCommand(commandId: string): Promise<AdminAccessCommand | null>;
  getEvents(commandId: string): Promise<OperatorEvent[]>;
  getTargetLock(projectId: string, uid: string): Promise<AdminAccessLock | null>;
}

function targetLockId(projectId: string, uid: string): string {
  return createHash("sha256").update(`${projectId}\u0000${uid}`).digest("hex");
}

function snapshotData<T>(snapshot: QueryDocumentSnapshot): T {
  return snapshot.data() as T;
}

function retentionTimestamp(): Timestamp {
  // A one-day margin covers small host/server clock skew; records have no automatic cleanup.
  const anchor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return Timestamp.fromDate(retentionDeadline(anchor));
}

export function createAdminAccessRepository(firestore: Firestore): AdminAccessRepository {
  const commands = firestore.collection("adminAccessCommands");
  const locks = firestore.collection("adminAccessLocks");

  return {
    async reserveCommand(input) {
      const commandRef = commands.doc(input.commandId);
      const lockRef = locks.doc(targetLockId(input.projectId, input.targetUid));
      return firestore.runTransaction(async (transaction) => {
        const [commandSnapshot, lockSnapshot] = await Promise.all([
          transaction.get(commandRef),
          transaction.get(lockRef),
        ]);

        if (commandSnapshot.exists) {
          const command = commandSnapshot.data() as AdminAccessCommand;
          if (command.payloadFingerprint !== input.payloadFingerprint) return { kind: "conflict", command };
          if (command.state === "completed" || command.state === "unchanged") return { kind: "existing", command };
          return { kind: "conflict", command };
        }
        if (lockSnapshot.exists) return { kind: "conflict" };

        const command: Omit<AdminAccessCommand, "createdAt" | "updatedAt" | "lastEventAt"> & {
          createdAt: FirebaseFirestore.FieldValue;
          updatedAt: FirebaseFirestore.FieldValue;
          lastEventAt: FirebaseFirestore.FieldValue;
        } = {
          version: 1,
          commandId: input.commandId,
          projectId: input.projectId,
          targetUid: input.targetUid,
          operatorRef: input.operatorRef,
          action: input.action,
          payloadFingerprint: input.payloadFingerprint,
          reason: input.reason,
          state: "prepared",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastEventAt: FieldValue.serverTimestamp(),
          retainUntil: retentionTimestamp(),
          stepStates: {
            claimWrite: "planned",
            invalidation: input.action === "revoke" ? "planned" : "not-required",
            readback: "planned",
            recording: "confirmed",
          },
          beforeAdmin: input.beforeAdmin,
          afterAdmin: input.beforeAdmin,
          invalidationCutoff: null,
          errorCode: null,
        };
        const event: OperatorEvent = {
          sequence: 1,
          kind: "command-prepared",
          serverTime: Timestamp.now(),
          step: "recording",
          outcome: "confirmed",
          error: null,
          operatorRef: input.operatorRef,
        };
        transaction.create(commandRef, command);
        transaction.create(lockRef, {
          projectId: input.projectId,
          targetUid: input.targetUid,
          commandId: input.commandId,
          acquiredAt: FieldValue.serverTimestamp(),
        } satisfies Omit<AdminAccessLock, "acquiredAt"> & { acquiredAt: FirebaseFirestore.FieldValue });
        transaction.create(commandRef.collection("events").doc("evt-000001"), {
          ...event,
          serverTime: FieldValue.serverTimestamp(),
        });
        return { kind: "created", command: command as unknown as AdminAccessCommand };
      });
    },

    async recordEvent(commandId, input, releaseLock = false) {
      const commandRef = commands.doc(commandId);
      await firestore.runTransaction(async (transaction) => {
        const commandSnapshot = await transaction.get(commandRef);
        if (!commandSnapshot.exists) throw new Error("command-not-found");
        const command = commandSnapshot.data() as AdminAccessCommand;
        const eventsRef = commandRef.collection("events");
        const latestQuery = eventsRef.orderBy("sequence", "desc").limit(1);
        const latestSnapshot = await transaction.get(latestQuery);
        const nextSequence = latestSnapshot.empty
          ? 1
          : Number(latestSnapshot.docs[0].get("sequence")) + 1;
        let lockRef: FirebaseFirestore.DocumentReference | null = null;
        if (releaseLock) {
          lockRef = locks.doc(targetLockId(command.projectId, command.targetUid));
          const lockSnapshot = await transaction.get(lockRef);
          if (!lockSnapshot.exists || lockSnapshot.get("commandId") !== commandId) {
            throw new Error("command-lock-mismatch");
          }
        }

        const patch: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
          lastEventAt: FieldValue.serverTimestamp(),
          retainUntil: retentionTimestamp(),
        };
        if (input.state) patch.state = input.state;
        if (input.stepStates) {
          for (const [step, state] of Object.entries(input.stepStates)) {
            patch[`stepStates.${step}`] = state;
          }
        }
        if (input.beforeAdmin !== undefined) patch.beforeAdmin = input.beforeAdmin;
        if (input.afterAdmin !== undefined) patch.afterAdmin = input.afterAdmin;
        if (input.invalidationCutoff !== undefined) {
          patch.invalidationCutoff = input.invalidationCutoff
            ? Timestamp.fromDate(input.invalidationCutoff)
            : null;
        }
        if (input.errorCode !== undefined) patch.errorCode = input.errorCode;

        const event: OperatorEvent = {
          sequence: nextSequence,
          kind: input.kind,
          serverTime: Timestamp.now(),
          step: input.step,
          outcome: input.outcome,
          error: input.error ?? null,
          operatorRef: input.operatorRef,
        };
        const eventId = `evt-${String(nextSequence).padStart(6, "0")}`;
        transaction.create(eventsRef.doc(eventId), {
          ...event,
          serverTime: FieldValue.serverTimestamp(),
        });
        transaction.update(commandRef, patch);
        if (lockRef) transaction.delete(lockRef);
      });
    },

    async getCommand(commandId) {
      const snapshot = await commands.doc(commandId).get();
      return snapshot.exists ? (snapshot.data() as AdminAccessCommand) : null;
    },

    async getEvents(commandId) {
      const snapshot = await commands.doc(commandId).collection("events").orderBy("sequence").get();
      return snapshot.docs.map((event) => snapshotData<OperatorEvent>(event));
    },

    async getTargetLock(projectId, uid) {
      const snapshot = await locks.doc(targetLockId(projectId, uid)).get();
      return snapshot.exists ? (snapshot.data() as AdminAccessLock) : null;
    },
  };
}

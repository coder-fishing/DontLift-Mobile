import type { Timestamp } from "firebase-admin/firestore";

export type AccessAction = "grant" | "revoke";
export type AccessCommandState =
  | "prepared"
  | "running"
  | "completed"
  | "unchanged"
  | "failed-before-change"
  | "partial"
  | "unknown";
export type StepState = "planned" | "started" | "confirmed" | "failed" | "unknown" | "not-required";

export interface AdminAccessCommand {
  version: 1;
  commandId: string;
  projectId: string;
  targetUid: string;
  operatorRef: string;
  action: AccessAction;
  payloadFingerprint: string;
  reason: string;
  state: AccessCommandState;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastEventAt: Timestamp;
  retainUntil: Timestamp;
  stepStates: {
    claimWrite: StepState;
    invalidation: StepState;
    readback: StepState;
    recording: StepState;
  };
  beforeAdmin: boolean | null;
  afterAdmin: boolean | null;
  invalidationCutoff: Timestamp | null;
  errorCode: string | null;
}

export interface OperatorEvent {
  sequence: number;
  kind: string;
  serverTime: Timestamp;
  step: string;
  outcome: StepState | AccessCommandState | "observed";
  error: string | null;
  operatorRef: string;
}

export interface AdminAccessLock {
  projectId: string;
  targetUid: string;
  commandId: string;
  acquiredAt: Timestamp;
}

export interface OperatorCommandBase {
  operation: "inspect" | "status";
  projectId: string;
  uid?: string;
  commandId?: string;
}

export interface OperatorMutationCommand {
  operation: AccessAction;
  projectId: string;
  uid: string;
  operator: string;
  reason: string;
  commandId: string;
  apply: true;
}

export interface OperatorReconcileCommand {
  operation: "reconcile";
  projectId: string;
  commandId: string;
  operator: string;
  apply: true;
  priorWorkerStopped: true;
}

export type OperatorCommand =
  | (OperatorCommandBase & { operation: "inspect"; uid: string })
  | (OperatorCommandBase & { operation: "status"; commandId: string })
  | OperatorMutationCommand
  | OperatorReconcileCommand;

export type OperatorOutcome =
  | "inspected"
  | "completed"
  | "unchanged"
  | "failed-before-change"
  | "partial"
  | "unknown";

export interface OperatorResult {
  version: 1;
  operation: OperatorCommand["operation"];
  projectId: string;
  targetUid?: string;
  commandId?: string;
  outcome?: OperatorOutcome;
  enabled?: boolean;
  admin?: boolean;
  effects?: Record<string, StepState>;
  code?: string;
  nextAction?: string;
  notice?: string;
  events?: Array<{
    sequence: number;
    kind: string;
    occurredAt: string;
    step: string;
    outcome: OperatorEvent["outcome"];
    error: string | null;
  }>;
  observationError?: string;
  eventHistoryUnavailable?: boolean;
}

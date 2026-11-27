import type { AdminAccessCommand, OperatorReconcileCommand } from "./types";
import type { AdminAccessRepository } from "./repository";

export class RecoveryError extends Error {
  constructor(readonly code: string, readonly exitCode: 2 | 3) {
    super(code);
    this.name = "RecoveryError";
  }
}

const recoverableStates: ReadonlySet<string> = new Set(["prepared", "running", "partial", "unknown"]);

export async function loadRecoverableCommand(
  repository: AdminAccessRepository,
  input: OperatorReconcileCommand,
): Promise<AdminAccessCommand> {
  if (input.priorWorkerStopped !== true) {
    throw new RecoveryError("worker-stop-proof-required", 2);
  }
  const command = await repository.getCommand(input.commandId);
  if (!command || command.projectId !== input.projectId) {
    throw new RecoveryError("command-not-found", 2);
  }
  if (!recoverableStates.has(command.state)) {
    throw new RecoveryError("command-not-recoverable", 3);
  }
  const lock = await repository.getTargetLock(command.projectId, command.targetUid);
  if (!lock || lock.commandId !== command.commandId) {
    throw new RecoveryError("command-lock-mismatch", 3);
  }
  return command;
}

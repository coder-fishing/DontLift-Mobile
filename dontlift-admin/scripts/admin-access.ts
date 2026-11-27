import { loadLocalEnvironment } from "./lib/local-env";
import { initializeOperatorFirebase, OperatorEnvironmentError } from "./lib/operator-firebase";
import { AdminAccessService, OperatorServiceError } from "../src/server/admin-access/service";
import { createAdminAccessRepository } from "../src/server/admin-access/repository";
import { parseOperatorArgs, OperatorInputError } from "../src/server/admin-access/validation";
import type { OperatorCommand, OperatorResult } from "../src/server/admin-access/types";

function projectOf(command: OperatorCommand): string {
  return command.projectId;
}

function targetOf(command: OperatorCommand): string | undefined {
  return "uid" in command ? command.uid : undefined;
}

function idOf(command: OperatorCommand): string | undefined {
  return "commandId" in command ? command.commandId : undefined;
}

function nextAction(code: string): string | undefined {
  if (code === "command-or-target-locked" || code === "command-lock-mismatch") {
    return "Inspect command status; reconcile only after confirming the previous worker has stopped.";
  }
  if (code.includes("audit") || code.includes("unknown") || code.includes("unverified")) {
    return "Inspect the command status and preserve its target lock until its effects are reconciled.";
  }
  return undefined;
}

async function run(): Promise<void> {
  let command: OperatorCommand | undefined;
  try {
    loadLocalEnvironment();
    command = parseOperatorArgs(process.argv.slice(2));
    if (command.operation === "revoke") {
      process.stderr.write("Warning: revoke invalidates refresh tokens account-wide and may sign this identity out of DontLift Mobile and other clients.\n");
    }
    const firebase = initializeOperatorFirebase();
    const service = new AdminAccessService({
      auth: firebase.auth,
      repository: createAdminAccessRepository(firebase.firestore),
      projectId: firebase.projectId,
    });
    let result: OperatorResult;
    switch (command.operation) {
      case "inspect": result = await service.inspect(command.projectId, command.uid); break;
      case "status": result = await service.status(command.projectId, command.commandId); break;
      case "grant":
      case "revoke": result = await service.mutate(command); break;
      case "reconcile": result = await service.reconcile(command); break;
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (command.operation !== "inspect" && command.operation !== "status" &&
      (result.outcome === "unknown" || result.outcome === "partial" || result.outcome === "failed-before-change")) {
      process.exitCode = 6;
    }
  } catch (error) {
    const code = error instanceof OperatorInputError || error instanceof OperatorServiceError || error instanceof OperatorEnvironmentError
      ? error.code
      : "dependency-unavailable";
    const exitCode = error instanceof OperatorInputError || error instanceof OperatorServiceError || error instanceof OperatorEnvironmentError
      ? error.exitCode
      : 5;
    process.stdout.write(`${JSON.stringify({
      version: 1,
      operation: command?.operation ?? "unknown",
      projectId: command ? projectOf(command) : undefined,
      targetUid: command ? targetOf(command) : undefined,
      commandId: command ? idOf(command) : undefined,
      outcome: "failed-before-change",
      code,
      nextAction: nextAction(code),
    })}\n`);
    process.stderr.write(`${code}\n`);
    process.exitCode = exitCode;
  }
}

void run();

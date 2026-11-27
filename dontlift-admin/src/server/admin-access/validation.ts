import { createHash } from "node:crypto";
import type { OperatorCommand } from "./types";

export class OperatorInputError extends Error {
  readonly exitCode = 2;

  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "OperatorInputError";
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function oneLine(value: string, field: string, maximum: number): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > maximum ||
    /[\r\n\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    throw new OperatorInputError("invalid-input", `${field} must be a non-empty single-line value no longer than ${maximum} characters.`);
  }
  return trimmed;
}

function validateUid(value: string): string {
  if (value.length === 0 || value.length > 128 || value.trim() !== value || /[\r\n\u0000-\u001f\u007f]/.test(value)) {
    throw new OperatorInputError("invalid-uid", "UID must be an exact non-empty Firebase UID within 128 characters.");
  }
  return value;
}

function validateProject(value: string): string {
  if (!value || value.trim() !== value || /[\s/\\\u0000-\u001f]/.test(value)) {
    throw new OperatorInputError("invalid-project", "Project must be an explicit exact project identifier.");
  }
  return value;
}

function validateCommandId(value: string): string {
  if (!uuidPattern.test(value)) {
    throw new OperatorInputError("invalid-command-id", "Command ID must be a UUID.");
  }
  return value.toLowerCase();
}

const valueFlags = new Set(["project", "uid", "operator", "reason", "command-id"]);
const booleanFlags = new Set(["apply", "prior-worker-stopped"]);

export function parseOperatorArgs(input: string[]): OperatorCommand {
  const argv = input[0] === "--" ? input.slice(1) : input;
  const operation = argv[0] as OperatorCommand["operation"] | undefined;
  if (!operation || !["inspect", "grant", "revoke", "status", "reconcile"].includes(operation)) {
    throw new OperatorInputError("invalid-operation", "Choose inspect, grant, revoke, status, or reconcile.");
  }

  const flags = new Map<string, string | true>();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new OperatorInputError("unexpected-argument", "Positional arguments are not accepted.");
    }
    const name = token.slice(2);
    if (!valueFlags.has(name) && !booleanFlags.has(name)) {
      throw new OperatorInputError("unknown-flag", `Unknown option: --${name}`);
    }
    if (flags.has(name)) throw new OperatorInputError("duplicate-flag", `Duplicate option: --${name}`);
    if (booleanFlags.has(name)) {
      flags.set(name, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new OperatorInputError("missing-value", `Option --${name} requires a value.`);
    }
    flags.set(name, value);
    index += 1;
  }

  const allowed = new Set<string>(
    operation === "inspect" ? ["project", "uid"]
      : operation === "status" ? ["project", "command-id"]
        : operation === "reconcile" ? ["project", "command-id", "operator", "apply", "prior-worker-stopped"]
          : ["project", "uid", "operator", "reason", "command-id", "apply"],
  );
  for (const name of flags.keys()) {
    if (!allowed.has(name)) throw new OperatorInputError("unsupported-flag", `Option --${name} is not valid for ${operation}.`);
  }

  const projectId = validateProject(String(flags.get("project") ?? ""));
  if (operation === "inspect") {
    return { operation, projectId, uid: validateUid(String(flags.get("uid") ?? "")) };
  }
  if (operation === "status") {
    return { operation, projectId, commandId: validateCommandId(String(flags.get("command-id") ?? "")) };
  }
  if (flags.get("apply") !== true) {
    throw new OperatorInputError("apply-required", "Mutation requires explicit --apply.");
  }
  if (operation === "reconcile") {
    if (flags.get("prior-worker-stopped") !== true) {
      throw new OperatorInputError("worker-stop-proof-required", "Reconciliation requires --prior-worker-stopped after proving the prior process ended.");
    }
    return {
      operation,
      projectId,
      commandId: validateCommandId(String(flags.get("command-id") ?? "")),
      operator: oneLine(String(flags.get("operator") ?? ""), "Operator", 100),
      apply: true,
      priorWorkerStopped: true,
    };
  }

  return {
    operation,
    projectId,
    uid: validateUid(String(flags.get("uid") ?? "")),
    operator: oneLine(String(flags.get("operator") ?? ""), "Operator", 100),
    reason: oneLine(String(flags.get("reason") ?? ""), "Reason", 500),
    commandId: validateCommandId(String(flags.get("command-id") ?? "")),
    apply: true,
  };
}

export function commandPayloadFingerprint(input: {
  projectId: string;
  uid: string;
  action: "grant" | "revoke";
  operator: string;
  reason: string;
}): string {
  const canonical = JSON.stringify({
    projectId: input.projectId,
    uid: input.uid,
    action: input.action,
    operator: input.operator,
    reason: input.reason,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

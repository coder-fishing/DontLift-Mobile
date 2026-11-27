import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadLocalEnvironment(cwd = process.cwd()): void {
  const localFile = resolve(cwd, ".env.local");
  if (existsSync(localFile)) process.loadEnvFile(localFile);
}

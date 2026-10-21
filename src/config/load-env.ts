import { existsSync } from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./paths.js";

/**
 * On a developer's machine the settings live in a .env file at the project root. On a host
 * (Railway, Render and similar) they are set in the dashboard and there is no file, so this
 * does nothing. Variables already set in the environment always win over the file.
 */
export function loadLocalEnv(file = path.join(PROJECT_ROOT, ".env")): void {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

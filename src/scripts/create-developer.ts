import { createInterface } from "node:readline";
import { hashPassword } from "../auth/passwords.js";
import { loadLocalEnv } from "../config/load-env.js";
import { createPool } from "../db/pool.js";
import { PgDeveloperRepository } from "../repositories/pg-developer-repository.js";
import { AppError } from "../utils/app-error.js";
import { parseNewPassword } from "../validations/accounts.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a developer account for the platform area. The password is typed twice without being
 * shown, so it never appears on screen, in the shell history, or in the process list.
 *
 *   npm run developer:create -- you@example.com
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Set it to the database you want to create the developer in.");
  }

  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Usage: npm run developer:create -- you@example.com");
  }

  const password = await askHidden("Password (at least 12 characters): ");
  parseNewPassword(password);
  const repeated = await askHidden("Repeat the password: ");
  if (password !== repeated) {
    throw new Error("The passwords do not match. Nothing was saved.");
  }

  const pool = createPool(databaseUrl);
  try {
    const developers = new PgDeveloperRepository(pool);
    await developers.create(email, await hashPassword(password));
    console.log(`Developer created: ${email}`);
  } finally {
    await pool.end();
  }
}

/** Reads one line from the terminal with the characters hidden. Piped input is read as-is. */
function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return readPipedLine();
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (result: () => void) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      result();
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          finish(() => resolve(value));
          return;
        }
        if (character === "\u0003") {
          finish(() => reject(new Error("Cancelled. Nothing was saved.")));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

/** One reader for the whole run, so lines that arrive together are not lost between questions. */
let pipedLines: AsyncIterator<string> | undefined;

async function readPipedLine(): Promise<string> {
  pipedLines ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]();
  const next = await pipedLines.next();
  if (next.done) {
    throw new Error("No password was provided. Nothing was saved.");
  }
  return next.value;
}

main().catch((error: unknown) => {
  if (error instanceof AppError) {
    console.error(error.message);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});

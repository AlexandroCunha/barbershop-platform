import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { hashPassword } from "../auth/passwords.js";
import { PLATFORM_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import { PlatformController } from "../controllers/platform-controller.js";
import type {
  DeveloperAccount,
  DeveloperRepository,
  SessionRecord,
  SessionRepository,
} from "../repositories/types.js";
import type { AccountService } from "../services/account-service.js";
import { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

const PLATFORM_KEY = "a-platform-key-derived-only-for-tests";
const START = new Date("2030-01-01T10:00:00Z");
const PASSWORD = "correct horse battery";

class InMemoryDevelopers implements DeveloperRepository {
  constructor(private readonly rows: DeveloperAccount[]) {}

  async findByEmail(email: string): Promise<DeveloperAccount | null> {
    return this.rows.find((row) => row.email === email) ?? null;
  }

  async create(): Promise<DeveloperAccount> {
    throw new Error("not used by these tests");
  }
}

class InMemorySessions implements SessionRepository {
  readonly rows: SessionRecord[] = [];

  async create(session: SessionRecord): Promise<void> {
    this.rows.push(session);
  }

  async findActive(id: string): Promise<SessionRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async revoke(): Promise<void> {}

  async revokeAllForOwner(): Promise<void> {}

  async revokeAllForBarberAccount(): Promise<void> {}
}

function setup(email: string) {
  const clock: Clock = { now: () => START, today: () => "2030-01-01" };
  const sessionRows = new InMemorySessions();
  const developers = new InMemoryDevelopers([{ id: 7, email, passwordHash: "" }]);
  return { sessionRows, developers, clock, sessions: new SessionService(sessionRows, clock) };
}

async function signIn(email: string, password: string) {
  const { sessionRows, sessions, clock } = setup(email);
  const storedHash = await hashPassword(PASSWORD);
  const developers = new InMemoryDevelopers([{ id: 7, email: "dev@example.com", passwordHash: storedHash }]);
  const controller = new PlatformController({
    developers,
    platformKey: PLATFORM_KEY,
    accounts: {} as AccountService,
    sessions,
    secureCookies: false,
    clock,
  });

  const headers: Record<string, string> = {};
  const res = {
    setHeader: (name: string, value: string) => (headers[name] = value),
    json: () => res,
    status: () => res,
    end: () => undefined,
  };
  const req = { body: { email, password } } as unknown as Request;
  try {
    await controller.login(req, res as unknown as Response);
    return { outcome: "signed-in" as const, headers, sessionRows };
  } catch (error) {
    return { outcome: error, headers, sessionRows };
  }
}

test("a developer with the right password gets a platform session tied to the developer", async () => {
  const result = await signIn("dev@example.com", PASSWORD);

  assert.equal(result.outcome, "signed-in");
  const cookie = result.headers["Set-Cookie"];
  assert.ok(cookie?.startsWith(`${PLATFORM_COOKIE}=`), "the platform cookie is set");

  const [session] = result.sessionRows.rows;
  assert.equal(session?.kind, "platform");
  assert.equal(session?.developerId, 7);
});

test("the email is matched regardless of case", async () => {
  const result = await signIn("DEV@Example.com", PASSWORD);
  assert.equal(result.outcome, "signed-in");
});

test("a wrong password and an unknown email get the same refusal", async () => {
  const wrongPassword = await signIn("dev@example.com", "not the password at all");
  const unknownEmail = await signIn("nobody@example.com", PASSWORD);

  for (const result of [wrongPassword, unknownEmail]) {
    assert.ok(result.outcome instanceof AppError);
    assert.equal(result.outcome.status, 401);
    assert.equal(result.outcome.message, "Email or password is not correct");
    assert.equal(result.headers["Set-Cookie"], undefined, "no cookie is issued on refusal");
  }
});

test("the cookie issued at sign-in is signed with the platform key only", async () => {
  const result = await signIn("dev@example.com", PASSWORD);
  const value = result.headers["Set-Cookie"]!.split(";")[0]!.slice(`${PLATFORM_COOKIE}=`.length);

  assert.ok(readToken(PLATFORM_KEY, value, START.getTime()));
  assert.equal(readToken("a-different-key-that-is-long-enough-to-try", value, START.getTime()), null);
});

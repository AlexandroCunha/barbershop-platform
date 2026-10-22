import { randomUUID } from "node:crypto";
import { SESSION_SECONDS } from "../auth/session-config.js";
import type { SessionRecord, SessionRepository } from "../repositories/types.js";
import type { Clock } from "../utils/clock.js";

/** A new session: its id goes into the signed token, and its expiry in Unix seconds. */
export interface OpenedSession {
  id: string;
  expiresAt: number;
}

/**
 * Opens, looks up and ends the server-side records behind each signed-in cookie.
 * A signed token is not enough on its own: its session must still exist and be active.
 */
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  openOwnerSession(owner: { tenantId: number; ownerId: number }): Promise<OpenedSession> {
    return this.open({
      kind: "owner",
      tenantId: owner.tenantId,
      ownerId: owner.ownerId,
      developerId: null,
      barberAccountId: null,
    });
  }

  openPlatformSession(developerId: number): Promise<OpenedSession> {
    return this.open({ kind: "platform", tenantId: null, ownerId: null, developerId, barberAccountId: null });
  }

  openBarberSession(barber: { tenantId: number; barberAccountId: number }): Promise<OpenedSession> {
    return this.open({
      kind: "barber",
      tenantId: barber.tenantId,
      ownerId: null,
      developerId: null,
      barberAccountId: barber.barberAccountId,
    });
  }

  /** The session when it is still active, otherwise null. */
  findActive(id: string): Promise<SessionRecord | null> {
    return this.sessions.findActive(id, this.clock.now());
  }

  revoke(id: string): Promise<void> {
    return this.sessions.revoke(id);
  }

  revokeAllForOwner(ownerId: number): Promise<void> {
    return this.sessions.revokeAllForOwner(ownerId);
  }

  revokeAllForBarberAccount(barberAccountId: number): Promise<void> {
    return this.sessions.revokeAllForBarberAccount(barberAccountId);
  }

  private async open(record: Omit<SessionRecord, "id" | "expiresAt">): Promise<OpenedSession> {
    const expiresAt = new Date(this.clock.now().getTime() + SESSION_SECONDS * 1000);
    const session: SessionRecord = { ...record, id: randomUUID(), expiresAt };
    await this.sessions.create(session);
    return { id: session.id, expiresAt: Math.floor(expiresAt.getTime() / 1000) };
  }
}

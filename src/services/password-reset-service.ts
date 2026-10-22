import { hashPassword } from "../auth/passwords.js";
import { createLinkToken, hashLinkToken } from "../auth/link-token.js";
import type { Tenant } from "../domain/tenant.js";
import type { Mailer } from "../mail/mailer.js";
import type { BarberAccountRepository, OwnerRepository, PasswordResetRepository } from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import type { SessionService } from "./session-service.js";

const HOUR_MS = 60 * 60 * 1000;
/** A reset link works for an hour, and only once. */
const LINK_LIFETIME_MS = HOUR_MS;

export type ResetArea = "owner" | "barber";

export interface PasswordResetConfig {
  publicUrl: string;
  /** False when no mail is sent on this server. Then no link is made either. */
  enabled: boolean;
}

/**
 * Lets an owner or a barber choose a new password when they have forgotten it. The reply to a request
 * never says whether the e-mail has an account, so this service is called after the reply is sent.
 */
export class PasswordResetService {
  constructor(
    private readonly owners: OwnerRepository,
    private readonly barbers: BarberAccountRepository,
    private readonly resets: PasswordResetRepository,
    private readonly sessions: SessionService,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly config: PasswordResetConfig,
  ) {}

  /** Sends a link to the account with this e-mail, if there is one. Does nothing otherwise. */
  async request(tenant: Tenant, area: ResetArea, email: string): Promise<void> {
    if (!this.config.enabled) return;

    const account =
      area === "owner"
        ? await this.owners.findByEmail(tenant.id, email)
        : await this.barbers.findByEmail(tenant.id, email);
    if (!account) return;

    const token = createLinkToken();
    await this.resets.create({
      tokenHash: hashLinkToken(token),
      tenantId: tenant.id,
      ownerId: area === "owner" ? account.id : null,
      barberAccountId: area === "barber" ? account.id : null,
      expiresAt: new Date(this.clock.now().getTime() + LINK_LIFETIME_MS),
    });

    const link = `${this.config.publicUrl}/${tenant.slug}/redefinir?area=${area}&token=${token}`;
    await this.mailer.send({
      to: account.email,
      subject: `Reset your password for ${tenant.business.name}`,
      text: [
        `You asked to reset your ${area === "owner" ? "owner" : "barber"} password for ${tenant.business.name}.`,
        "",
        `Choose a new password here (the link works once and for one hour):`,
        link,
        "",
        "If you did not ask for this, ignore this e-mail. Your password stays the same.",
      ].join("\n"),
    });
  }

  /** Sets the new password for whoever the link belongs to, and ends their other sign-ins. */
  async confirm(tenant: Tenant, token: string, password: string): Promise<void> {
    const target = await this.resets.consume(hashLinkToken(token), tenant.id, this.clock.now());
    if (!target) {
      throw new AppError(400, "This link is no longer valid. Ask for a new one.");
    }

    const passwordHash = await hashPassword(password);
    if (target.ownerId !== null) {
      // Changing the owner's password bumps the session version, which signs out every owner session.
      await this.owners.updatePassword(target.ownerId, passwordHash);
      return;
    }
    if (target.barberAccountId !== null) {
      await this.barbers.updatePasswordHash(target.barberAccountId, passwordHash);
      await this.sessions.revokeAllForBarberAccount(target.barberAccountId);
    }
  }
}

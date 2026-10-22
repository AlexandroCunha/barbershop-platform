import type { Mailer } from "../mail/mailer.js";
import type { NotificationRepository } from "../repositories/types.js";
import type { Clock } from "../utils/clock.js";

const MINUTE_MS = 60_000;
/** How long a claimed message is held while it is being sent. A crash releases it after this. */
const LEASE_MS = 5 * MINUTE_MS;
const MAX_ATTEMPTS = 5;
const RETRY_STEP_MS = 5 * MINUTE_MS;

/**
 * Sends the queued e-mails. Each run claims a batch of due messages, sends them and records the outcome.
 * A message that cannot be sent is retried a little later, and given up after a few attempts. Its
 * address and text are cleared once it is sent or given up on.
 */
export class NotificationWorker {
  constructor(
    private readonly outbox: NotificationRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly report: (message: string) => void = console.error,
  ) {}

  /** Sends one batch. Returns how many messages were handled. */
  async runOnce(batchSize = 20): Promise<number> {
    const now = this.clock.now();
    const due = await this.outbox.claimDue(now, new Date(now.getTime() + LEASE_MS), batchSize);

    for (const message of due) {
      try {
        await this.mailer.send({ to: message.toAddress, subject: message.subject, text: message.body });
        await this.outbox.markSent(message.id);
      } catch (error) {
        // The log names the message, never the address or the text.
        this.report(`E-mail ${message.id} was not sent (attempt ${message.attempts}): ${describe(error)}`);
        if (message.attempts >= MAX_ATTEMPTS) {
          await this.outbox.markFailed(message.id);
        } else {
          await this.outbox.markRetry(message.id, new Date(now.getTime() + message.attempts * RETRY_STEP_MS));
        }
      }
    }
    return due.length;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
}

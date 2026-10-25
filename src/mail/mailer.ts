import nodemailer, { type Transporter } from "nodemailer";
import type { MailConfig, ResendSettings, SmtpSettings } from "../config/mail-config.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  /** The plain-text version. Every message has one, for clients that do not show HTML. */
  text: string;
  /** The HTML version. Its text is escaped when built, so customer details cannot run as markup. */
  html?: string;
}

/** Sends one e-mail. Throws when the message could not be handed to the mail service. */
export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

/** Sends through any SMTP server: a transactional mail service, the mail provider of the shop, and so on. */
export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.user && settings.password ? { user: settings.user, pass: settings.password } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(mail: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({
      from: this.settings.from,
      to: mail.to,
      subject: singleLine(mail.subject),
      text: mail.text,
      html: mail.html,
    });
  }
}

/**
 * A subject is one line. The shop's name goes into it, so a line break in that name must not be able to
 * start a new mail header.
 */
export function singleLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Sends through Resend's HTTP API over HTTPS. Outbound SMTP can be blocked or time out on some hosts, but
 * HTTPS always works. The request is bounded by a timeout, so a slow reply cannot stall the e-mail worker.
 */
export class ResendMailer implements Mailer {
  constructor(
    private readonly settings: ResendSettings,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(mail: OutgoingMail): Promise<void> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.settings.from,
        to: [mail.to],
        subject: singleLine(mail.subject),
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    // The reply can name the recipient, so only the status is kept for the log.
    if (!response.ok) {
      throw new Error(`Resend refused the message with status ${response.status}`);
    }
  }
}

/** Development only: prints each message to the terminal instead of sending it. */
export class ConsoleMailer implements Mailer {
  async send(mail: OutgoingMail): Promise<void> {
    console.log(`\n--- e-mail (development) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n---`);
  }
}

/** Sends nothing. Booking keeps working; the outbox simply stays empty of deliveries. */
export class DisabledMailer implements Mailer {
  async send(): Promise<void> {}
}

export function createMailer(config: MailConfig): Mailer {
  switch (config.kind) {
    case "smtp":
      return new SmtpMailer(config.settings);
    case "resend":
      return new ResendMailer(config.settings);
    case "console":
      return new ConsoleMailer();
    case "off":
      return new DisabledMailer();
  }
}

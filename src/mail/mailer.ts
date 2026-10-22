import nodemailer, { type Transporter } from "nodemailer";
import type { MailConfig, SmtpSettings } from "../config/mail-config.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  /** Plain text only. Nothing in a message is rendered as HTML, so nothing in it can run as a script. */
  text: string;
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
    case "console":
      return new ConsoleMailer();
    case "off":
      return new DisabledMailer();
  }
}

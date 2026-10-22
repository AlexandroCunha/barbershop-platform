export interface SmtpSettings {
  host: string;
  port: number;
  /** Implicit TLS from the first byte. Usually true on port 465, false on 587 (STARTTLS). */
  secure: boolean;
  user?: string;
  password?: string;
  /** The sender shown to customers, such as "Barbershop <bookings@example.com>". */
  from: string;
}

/**
 * How e-mails leave the app. `console` writes them to the terminal and is for development only:
 * the e-mails contain links that sign people in, so production refuses it. `off` keeps booking
 * working and sends nothing.
 */
export type MailConfig = { kind: "off" } | { kind: "console" } | { kind: "smtp"; settings: SmtpSettings };

export function parseMail(env: NodeJS.ProcessEnv, production: boolean): MailConfig {
  const kind = env.MAIL_TRANSPORT?.trim().toLowerCase() || (production ? "off" : "console");

  if (kind === "off") return { kind: "off" };
  if (kind === "console") {
    if (production) {
      throw new Error("MAIL_TRANSPORT=console is for development. Use smtp, or off, on the live site.");
    }
    return { kind: "console" };
  }
  if (kind !== "smtp") {
    throw new Error(`MAIL_TRANSPORT must be "smtp", "console" or "off", not "${kind}"`);
  }

  const host = env.SMTP_HOST?.trim();
  const from = env.MAIL_FROM?.trim();
  const missing = [!host && "SMTP_HOST", !from && "MAIL_FROM"].filter(Boolean);
  if (missing.length > 0 || !host || !from) {
    throw new Error(`MAIL_TRANSPORT=smtp needs these variables: ${missing.join(", ")}`);
  }
  if (!from.includes("@")) {
    throw new Error("MAIL_FROM must include an e-mail address, such as bookings@example.com");
  }

  const port = Number(env.SMTP_PORT?.trim() || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a number between 1 and 65535");
  }

  const user = env.SMTP_USER?.trim() || undefined;
  const password = env.SMTP_PASSWORD?.trim() || undefined;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be set together");
  }

  const secureText = env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureText ? secureText === "true" : port === 465;

  return { kind: "smtp", settings: { host, port, secure, user, password, from } };
}

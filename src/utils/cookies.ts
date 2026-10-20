/** Reads a Cookie request header into a map. Names are kept as-is, without prototype lookups. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = Object.create(null);
  if (!header) return cookies;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name && !(name in cookies)) {
      cookies[name] = pair.slice(separator + 1).trim();
    }
  }
  return cookies;
}

export interface CookieOptions {
  path: string;
  maxAgeSeconds: number;
  secure: boolean;
}

/** HttpOnly keeps the value away from page scripts; SameSite=Strict stops other sites from sending it. */
export function buildCookie(name: string, value: string, options: CookieOptions): string {
  const attributes = [
    `${name}=${value}`,
    `Path=${options.path}`,
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

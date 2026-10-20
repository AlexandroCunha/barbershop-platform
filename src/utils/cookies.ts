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

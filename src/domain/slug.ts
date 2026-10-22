/** Two to forty lowercase letters, digits and single dashes, starting and ending with a letter or digit. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

/** Paths the application itself uses, so no shop can take them. */
const RESERVED_SLUGS = new Set(["api", "admin", "acesso", "platform", "media", "assets", "www", "login", "static"]);

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !slug.includes("--") && !RESERVED_SLUGS.has(slug);
}

/** A suggested address from a shop name: "Northgate Barber Co." -> "northgate-barber-co". */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

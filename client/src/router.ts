/**
 * Works out which screen the address points to:
 *   /                 landing page
 *   /platform         platform owner
 *   /:slug            a barbershop's website
 *   /:slug/admin      that barbershop's owner area
 *
 * The server uses the same rules for the shop address; keep the two in step.
 */
const SHOP_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
const RESERVED = new Set(["api", "admin", "platform", "media", "assets", "www", "login", "static"]);

export type Route =
  | { kind: "landing" }
  | { kind: "platform" }
  | { kind: "shop"; slug: string; view: "site" | "admin" }
  | { kind: "not-found" };

function isShopSlug(slug: string): boolean {
  return SHOP_SLUG_PATTERN.test(slug) && !slug.includes("--") && !RESERVED.has(slug);
}

export function parseRoute(pathname: string): Route {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return { kind: "landing" };
  if (segments.length === 1 && segments[0] === "platform") return { kind: "platform" };

  const [slug, section, ...rest] = segments;
  if (slug === undefined || rest.length > 0 || !isShopSlug(slug)) return { kind: "not-found" };

  if (section === undefined) return { kind: "shop", slug, view: "site" };
  if (section === "admin") return { kind: "shop", slug, view: "admin" };
  return { kind: "not-found" };
}

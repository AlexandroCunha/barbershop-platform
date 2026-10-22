/**
 * Works out which screen the address points to:
 *   /                 the home shop's booking page (or a notice when there is none)
 *   /:slug            a barbershop's website
 *   /:slug/admin      that barbershop's owner area
 *   /:slug/barber     that barbershop's barber area (own bookings only)
 *
 * The server uses the same rules for the shop address; keep the two in step.
 */
const SHOP_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
const RESERVED = new Set(["api", "admin", "acesso", "platform", "media", "assets", "www", "login", "static"]);

export type Route =
  | { kind: "landing" }
  | { kind: "shop"; slug: string; view: "site" | "admin" | "barber" | "access" }
  | { kind: "not-found" };

function isShopSlug(slug: string): boolean {
  return SHOP_SLUG_PATTERN.test(slug) && !slug.includes("--") && !RESERVED.has(slug);
}

export function parseRoute(pathname: string): Route {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return { kind: "landing" };

  const [slug, section, ...rest] = segments;
  if (slug === undefined || rest.length > 0 || !isShopSlug(slug)) return { kind: "not-found" };

  if (section === undefined) return { kind: "shop", slug, view: "site" };
  if (section === "admin") return { kind: "shop", slug, view: "admin" };
  if (section === "barber") return { kind: "shop", slug, view: "barber" };
  if (section === "acesso") return { kind: "shop", slug, view: "access" };
  return { kind: "not-found" };
}

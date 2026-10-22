import { useAsync } from "../hooks";
import { NoHomeShop } from "./Static";
import { TenantPage } from "./TenantPage";

interface HomeResponse {
  slug: string | null;
}

/**
 * The first screen of the site: the booking page of the home shop. The server decides which
 * shop that is (HOME_SHOP_SLUG, or the first one created).
 */
export function HomePage() {
  const home = useAsync<HomeResponse>(async (signal) => {
    const response = await fetch("/api/home", { signal, headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error("We could not load this. Please try again.");
    }
    return (await response.json()) as HomeResponse;
  }, []);

  if (home.loading) {
    return <p className="status page-status">Loading…</p>;
  }
  if (!home.data?.slug) {
    return <NoHomeShop message={home.error} />;
  }
  return <TenantPage slug={home.data.slug} view="site" />;
}

import { HomePage } from "./pages/HomePage";
import { NotFound } from "./pages/Static";
import { TenantPage } from "./pages/TenantPage";
import { parseRoute } from "./router";

export default function App() {
  const route = parseRoute(window.location.pathname);

  switch (route.kind) {
    case "landing":
      return <HomePage />;
    case "shop":
      return <TenantPage slug={route.slug} view={route.view} />;
    case "not-found":
      return <NotFound message="This page does not exist" />;
  }
}

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, OWNER_SESSION_EXPIRED, type TenantApi } from "../api";
import { useTenant } from "../tenant-context";
import type { LicenseSummary } from "../types";
import { AccountPanel } from "./AccountPanel";
import { BookingsPanel } from "./BookingsPanel";
import { BusinessPanel } from "./BusinessPanel";
import { MediaPanel } from "./MediaPanel";
import { ServicesPanel } from "./ServicesPanel";
import { TeamPanel } from "./TeamPanel";
import { Field, errorText } from "./ui";
import { formatDate } from "../format";

type Tab = "bookings" | "business" | "media" | "team" | "services" | "account";
type Status = "checking" | "signed-out" | "signed-in";

const TABS: { id: Tab; label: string }[] = [
  { id: "bookings", label: "Bookings" },
  { id: "business", label: "Business" },
  { id: "media", label: "Photos" },
  { id: "team", label: "Barbers" },
  { id: "services", label: "Services" },
  { id: "account", label: "Account" },
];

/** A barbershop's owner area: its details, photos, barbers, services and account. */
export function AdminPage() {
  const { api, slug, business } = useTenant();
  const [status, setStatus] = useState<Status>("checking");
  const [license, setLicense] = useState<LicenseSummary | null>(null);
  const [tab, setTab] = useState<Tab>("business");

  useEffect(() => {
    let active = true;
    api.owner
      .session()
      .then((session) => {
        if (!active) return;
        setLicense(session.license);
        setStatus("signed-in");
      })
      .catch(() => {
        if (active) setStatus("signed-out");
      });

    const expired = () => setStatus("signed-out");
    window.addEventListener(OWNER_SESSION_EXPIRED, expired);
    return () => {
      active = false;
      window.removeEventListener(OWNER_SESSION_EXPIRED, expired);
    };
  }, [api]);

  if (status === "checking") {
    return <p className="status page-status">Loading…</p>;
  }
  if (status === "signed-out") {
    return (
      <LoginPanel
        api={api}
        shopName={business.name}
        onSignedIn={(summary) => {
          setLicense(summary);
          setStatus("signed-in");
        }}
      />
    );
  }

  async function signOut() {
    await api.owner.logout().catch(() => undefined);
    setStatus("signed-out");
  }

  return (
    <div className="owner">
      <header className="owner-top">
        <div className="container owner-top-inner">
          <span className="owner-title">{business.name} · Owner area</span>
          <div className="owner-actions">
            <a href={`/${slug}`}>View site</a>
            <button type="button" className="link-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="container owner-tabs" aria-label="Owner sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="container owner-main">
        {license && <LicenseNotice license={license} />}
        {tab === "bookings" && <BookingsPanel />}
        {tab === "business" && <BusinessPanel />}
        {tab === "media" && <MediaPanel />}
        {tab === "team" && <TeamPanel />}
        {tab === "services" && <ServicesPanel />}
        {tab === "account" && <AccountPanel />}
      </main>
    </div>
  );
}

/** Tells the owner whether online booking is running, and until when. */
function LicenseNotice({ license }: { license: LicenseSummary }) {
  const until = license.endsAt ? formatDate(license.endsAt.slice(0, 10)) : null;

  switch (license.state) {
    case "trial":
      return <p className="notice notice-ok">Free trial: online booking is open until {until}.</p>;
    case "active":
      return (
        <p className="notice notice-ok">
          Subscription active{until ? ` until ${until}` : ""}. Online booking is open.
        </p>
      );
    case "expired":
      return (
        <p className="notice notice-error" role="status">
          Online booking is paused because the subscription has ended. Your details stay safe; renew to reopen bookings.
        </p>
      );
    case "suspended":
      return (
        <p className="notice notice-error" role="status">
          Online booking is paused for this account. Contact the platform owner for help.
        </p>
      );
  }
}

function LoginPanel({
  api,
  shopName,
  onSignedIn,
}: {
  api: TenantApi;
  shopName: string;
  onSignedIn: (license: LicenseSummary) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.owner.login(email.trim(), password);
      const session = await api.owner.session();
      setPassword("");
      onSignedIn(session.license);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? "Email or password is not correct." : errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="owner owner-login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">{shopName} · Owner area</p>
        <h1>Sign in</h1>
        <Field label="Email" htmlFor="owner-email">
          <input
            id="owner-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="owner-password">
          <input
            id="owner-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-dark" disabled={busy}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, OWNER_SESSION_EXPIRED, owner } from "../api";
import { BusinessPanel } from "./BusinessPanel";
import { MediaPanel } from "./MediaPanel";
import { ServicesPanel } from "./ServicesPanel";
import { TeamPanel } from "./TeamPanel";
import { Field, errorText } from "./ui";

type Tab = "business" | "media" | "team" | "services";
type Status = "checking" | "signed-out" | "signed-in";

const TABS: { id: Tab; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "media", label: "Photos" },
  { id: "team", label: "Barbers" },
  { id: "services", label: "Services" },
];

/** The owner's area: business profile, photos, barbers and services. */
export function AdminPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [tab, setTab] = useState<Tab>("business");

  // Ask the server whether this browser already has a live session.
  useEffect(() => {
    let active = true;
    owner
      .session()
      .then(() => {
        if (active) setStatus("signed-in");
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
  }, []);

  if (status === "checking") {
    return <p className="status page-status">Loading…</p>;
  }

  if (status === "signed-out") {
    return <LoginPanel onSignedIn={() => setStatus("signed-in")} />;
  }

  async function signOut() {
    await owner.logout().catch(() => undefined);
    setStatus("signed-out");
  }

  return (
    <div className="owner">
      <header className="owner-top">
        <div className="container owner-top-inner">
          <span className="owner-title">Owner area</span>
          <div className="owner-actions">
            <a href="/">View site</a>
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
        {tab === "business" && <BusinessPanel />}
        {tab === "media" && <MediaPanel />}
        {tab === "team" && <TeamPanel />}
        {tab === "services" && <ServicesPanel />}
      </main>
    </div>
  );
}

function LoginPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = value.trim();
    if (!token) {
      setError("Enter your access token.");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      await owner.login(token);
      setValue("");
      onSignedIn();
    } catch (caught) {
      const message =
        caught instanceof ApiError && caught.status === 401
          ? "That access token is not correct."
          : errorText(caught);
      setError(message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="owner owner-login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">Owner area</p>
        <h1>Sign in</h1>
        <p className="muted">Enter the access token from the server's .env file (ADMIN_TOKEN).</p>

        <Field label="Access token" htmlFor="owner-token">
          <input
            id="owner-token"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-dark" disabled={checking}>
          {checking ? "Checking…" : "Sign in"}
        </button>
        <a className="link-arrow" href="/">
          Back to the website
        </a>
      </form>
    </div>
  );
}

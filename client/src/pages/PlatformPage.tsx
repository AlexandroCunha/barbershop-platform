import { useEffect, useState, type FormEvent } from "react";
import { ApiError, platformApi } from "../api";
import { Field, Notice, errorText } from "../admin/ui";
import type { TenantSummary } from "../types";

type Status = "checking" | "signed-out" | "signed-in";

/** The platform owner's area: every barbershop, its license, and new shops. */
export function PlatformPage() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    platformApi
      .session()
      .then(() => setStatus("signed-in"))
      .catch(() => setStatus("signed-out"));
  }, []);

  if (status === "checking") {
    return <p className="status page-status">Loading…</p>;
  }
  if (status === "signed-out") {
    return <PlatformLogin onSignedIn={() => setStatus("signed-in")} />;
  }
  return <Shops onSignedOut={() => setStatus("signed-out")} />;
}

function PlatformLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await platformApi.login(email.trim().toLowerCase(), password);
      setPassword("");
      onSignedIn();
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? "Email or password is not correct." : errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="owner owner-login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">Developer</p>
        <h1>Sign in</h1>
        <p className="muted">Developer accounts only.</p>
        <Field label="Email" htmlFor="developer-email">
          <input
            id="developer-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="developer-password">
          <input
            id="developer-password"
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

function Shops({ onSignedOut }: { onSignedOut: () => void }) {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformApi
      .tenants()
      .then(setTenants)
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);

  async function signOut() {
    await platformApi.logout().catch(() => undefined);
    onSignedOut();
  }

  function replaceTenant(updated: TenantSummary) {
    setTenants((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
  }

  return (
    <div className="owner">
      <header className="owner-top">
        <div className="container owner-top-inner">
          <span className="owner-title">Platform</span>
          <div className="owner-actions">
            <button type="button" className="link-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container owner-main">
        <NewShopForm onCreated={(created) => setTenants((current) => [...(current ?? []), created])} />

        <section className="owner-card">
          <h2>Barbershops</h2>
          {error && <Notice kind="error">{error}</Notice>}
          {!tenants && !error && <p className="status">Loading…</p>}
          {tenants && tenants.length === 0 && <p className="muted">No barbershops yet.</p>}
          {tenants?.map((tenant) => (
            <LicenseRow key={tenant.id} tenant={tenant} onSaved={replaceTenant} />
          ))}
        </section>
      </main>
    </div>
  );
}

function NewShopForm({ onCreated }: { onCreated: (tenant: TenantSummary) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const created = await platformApi.createTenant({ name, slug, ownerEmail: email, ownerPassword: password });
      onCreated(created);
      setName("");
      setSlug("");
      setEmail("");
      setPassword("");
      setResult({ kind: "ok", text: `Created /${created.slug}. The trial runs for 14 days.` });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="owner-card">
      <h2>Add a barbershop</h2>
      <form className="owner-form" onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <Field label="Shop name" htmlFor="new-name">
            <input id="new-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Address" htmlFor="new-slug" hint="Lowercase letters, digits and dashes. Used in the web address.">
            <input
              id="new-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              required
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Owner email" htmlFor="new-email">
            <input id="new-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Owner password" htmlFor="new-password" hint="At least 12 characters. Share it with the owner securely.">
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
        </div>
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
        <div className="owner-savebar">
          <button type="submit" className="btn btn-dark" disabled={busy}>
            {busy ? "Creating…" : "Create barbershop"}
          </button>
        </div>
      </form>
    </section>
  );
}

const dateInput = (value: string | null): string => (value ? value.slice(0, 10) : "");
const endOfDayIso = (value: string): string | null => (value ? new Date(`${value}T23:59:59Z`).toISOString() : null);

function LicenseRow({ tenant, onSaved }: { tenant: TenantSummary; onSaved: (tenant: TenantSummary) => void }) {
  const [status, setStatus] = useState<TenantSummary["status"]>(tenant.status);
  const [trialEnds, setTrialEnds] = useState(dateInput(tenant.trialEndsAt));
  const [paidUntil, setPaidUntil] = useState(dateInput(tenant.paidUntil));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setResult(null);
    try {
      const updated = await platformApi.setLicense(tenant.id, {
        status,
        trialEndsAt: endOfDayIso(trialEnds),
        paidUntil: endOfDayIso(paidUntil),
      });
      onSaved(updated);
      setResult({ kind: "ok", text: "Saved." });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="license-row">
      <div>
        <strong>{tenant.name}</strong>
        <p className="muted note">
          <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
            /{tenant.slug}
          </a>{" "}
          · <a href={`/${tenant.slug}/admin`} target="_blank" rel="noopener noreferrer">owner area</a> · {tenant.state}
        </p>
      </div>
      <div className="license-fields">
        <Field label="Status" htmlFor={`status-${tenant.id}`}>
          <select id={`status-${tenant.id}`} value={status} onChange={(event) => setStatus(event.target.value as TenantSummary["status"])}>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>
        <Field label="Trial ends" htmlFor={`trial-${tenant.id}`}>
          <input id={`trial-${tenant.id}`} type="date" value={trialEnds} onChange={(event) => setTrialEnds(event.target.value)} />
        </Field>
        <Field label="Paid until" htmlFor={`paid-${tenant.id}`}>
          <input id={`paid-${tenant.id}`} type="date" value={paidUntil} onChange={(event) => setPaidUntil(event.target.value)} />
        </Field>
        <button type="button" className="btn btn-dark" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="muted note">Leave "Paid until" empty for no end date.</p>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
    </div>
  );
}

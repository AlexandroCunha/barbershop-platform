import { useEffect, useState, type FormEvent } from "react";
import { Field, Notice, errorText } from "../admin/ui";
import { ApiError } from "../api";
import { ScheduleEditor } from "../components/ScheduleEditor";
import { formatDate } from "../format";
import { useTenant } from "../tenant-context";
import type { BarberBooking, BarberProfile } from "../types";

type Status =
  | { state: "checking" }
  | { state: "signed-out" }
  | { state: "signed-in"; professional: BarberProfile };

/**
 * A barber's own area: sign in with the login the owner created, then see the bookings that have
 * not started yet. Nothing else of the shop is reachable from here.
 */
export function BarberPage() {
  const { api, business } = useTenant();
  const [status, setStatus] = useState<Status>({ state: "checking" });

  useEffect(() => {
    api.barber
      .session()
      .then((response) => setStatus({ state: "signed-in", professional: response.professional }))
      .catch(() => setStatus({ state: "signed-out" }));
  }, [api]);

  if (status.state === "checking") {
    return <p className="status page-status">Loading…</p>;
  }

  return (
    <div className="owner barber-area">
      <p className="eyebrow">{business.name} · Barber area</p>
      {status.state === "signed-out" ? (
        <BarberSignIn onSignedIn={(professional) => setStatus({ state: "signed-in", professional })} />
      ) : (
        <>
          <BarberAgenda professional={status.professional} onSignedOut={() => setStatus({ state: "signed-out" })} />
          <ScheduleEditor professionalId={null} name={status.professional.name} />
        </>
      )}
    </div>
  );
}

function BarberSignIn({ onSignedIn }: { onSignedIn: (professional: BarberProfile) => void }) {
  const { api } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.barber.login(email.trim().toLowerCase(), password);
      setPassword("");
      const session = await api.barber.session();
      onSignedIn(session.professional);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? "Email or password is not correct." : errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={handleSubmit} noValidate>
      <h1>Sign in</h1>
      <p className="muted">Use the login your barbershop gave you.</p>
      <Field label="Email" htmlFor="barber-email">
        <input id="barber-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field label="Password" htmlFor="barber-password">
        <input
          id="barber-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <button type="submit" className="btn btn-dark" disabled={busy}>
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

function BarberAgenda({ professional, onSignedOut }: { professional: BarberProfile; onSignedOut: () => void }) {
  const { api } = useTenant();
  const [bookings, setBookings] = useState<BarberBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.barber
      .bookings()
      .then(setBookings)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          onSignedOut();
          return;
        }
        setError(errorText(caught));
      });
  }, [api, onSignedOut]);

  async function signOut() {
    await api.barber.logout().catch(() => undefined);
    onSignedOut();
  }

  return (
    <section className="owner-card">
      <div className="owner-savebar">
        <h1>Hello, {professional.name.split(" ")[0]}</h1>
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </div>
      <h2>Upcoming bookings</h2>
      {error && <Notice kind="error">{error}</Notice>}
      {!error && bookings === null && <p className="status">Loading…</p>}
      {bookings?.length === 0 && <p className="muted">No upcoming bookings.</p>}
      {bookings && bookings.length > 0 && (
        <ul className="barber-agenda">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <span className="barber-agenda-when">
                {formatDate(booking.date)} · {booking.startTime}–{booking.endTime}
              </span>
              <span>
                {booking.serviceName} for {booking.customerName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

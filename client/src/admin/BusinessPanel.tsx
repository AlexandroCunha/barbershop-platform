import { useEffect, useState, type FormEvent } from "react";
import { api, owner } from "../api";
import { DAY_LABELS } from "../format";
import { DAYS, type Business, type Day, type DayHours } from "../types";
import { Field, Notice, errorText } from "./ui";

type Result = { kind: "ok" | "error"; text: string };

export function BusinessPanel() {
  const [draft, setDraft] = useState<Business | null>(null);
  const [media, setMedia] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    api
      .business()
      .then(setDraft)
      .catch((caught: unknown) => setLoadError(errorText(caught)));
    owner
      .listMedia()
      .then((items) => setMedia(items.map((item) => item.name)))
      .catch(() => setMedia([]));
  }, []);

  if (loadError) {
    return <Notice kind="error">{loadError}</Notice>;
  }
  if (!draft) {
    return <p className="status">Loading business details…</p>;
  }

  const update = (patch: Partial<Business>) => setDraft({ ...draft, ...patch });
  const updateAddress = (patch: Partial<Business["address"]>) =>
    setDraft({ ...draft, address: { ...draft.address, ...patch } });
  const updateDay = (day: Day, hours: DayHours | null) =>
    setDraft({ ...draft, hours: { ...draft.hours, [day]: hours } });

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setResult(null);
    try {
      const saved = await owner.saveBusiness(draft);
      setDraft(saved);
      setResult({ kind: "ok", text: "Saved. The website is up to date." });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="owner-form" onSubmit={handleSave} noValidate>
      <section className="owner-card">
        <h2>Identity</h2>
        <Field label="Business name" htmlFor="b-name">
          <input id="b-name" value={draft.name} onChange={(event) => update({ name: event.target.value })} required />
        </Field>
        <Field label="Slogan" htmlFor="b-tagline" hint="Shown as the main headline on the website.">
          <input
            id="b-tagline"
            value={draft.tagline}
            maxLength={120}
            onChange={(event) => update({ tagline: event.target.value })}
          />
        </Field>
        <Field label="About" htmlFor="b-about" hint="A short paragraph under the headline.">
          <textarea
            id="b-about"
            rows={4}
            maxLength={1000}
            value={draft.about}
            onChange={(event) => update({ about: event.target.value })}
          />
        </Field>
      </section>

      <section className="owner-card">
        <h2>Contact</h2>
        <div className="field-row">
          <Field label="Phone" htmlFor="b-phone">
            <input id="b-phone" value={draft.phone} onChange={(event) => update({ phone: event.target.value })} />
          </Field>
          <Field label="WhatsApp" htmlFor="b-whatsapp" hint="Number with country code, e.g. +353 1 234 5678.">
            <input
              id="b-whatsapp"
              value={draft.whatsapp}
              onChange={(event) => update({ whatsapp: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Email" htmlFor="b-email">
          <input
            id="b-email"
            type="email"
            value={draft.email}
            onChange={(event) => update({ email: event.target.value })}
          />
        </Field>
        <Field label="Instagram" htmlFor="b-instagram" hint="Your handle without the @.">
          <input
            id="b-instagram"
            value={draft.instagram}
            onChange={(event) => update({ instagram: event.target.value })}
          />
        </Field>
      </section>

      <section className="owner-card">
        <h2>Address and directions</h2>
        <Field label="Street" htmlFor="b-street">
          <input
            id="b-street"
            value={draft.address.street}
            onChange={(event) => updateAddress({ street: event.target.value })}
          />
        </Field>
        <div className="field-row">
          <Field label="City" htmlFor="b-city">
            <input
              id="b-city"
              value={draft.address.city}
              onChange={(event) => updateAddress({ city: event.target.value })}
            />
          </Field>
          <Field label="Postcode" htmlFor="b-postcode">
            <input
              id="b-postcode"
              value={draft.address.postcode}
              onChange={(event) => updateAddress({ postcode: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Country" htmlFor="b-country">
          <input
            id="b-country"
            value={draft.address.country}
            onChange={(event) => updateAddress({ country: event.target.value })}
          />
        </Field>
        <Field label="Directions link" htmlFor="b-maps" hint="A Google Maps link that opens directions to the shop.">
          <input
            id="b-maps"
            type="url"
            value={draft.mapsUrl}
            onChange={(event) => update({ mapsUrl: event.target.value })}
          />
        </Field>
      </section>

      <section className="owner-card">
        <h2>Opening hours</h2>
        <p className="muted note">Untick a day to close it. Bookings are offered only inside these hours.</p>
        <div className="hours-editor">
          {DAYS.map((day) => {
            const hours = draft.hours[day];
            return (
              <div key={day} className="hours-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={hours !== null}
                    onChange={(event) =>
                      updateDay(day, event.target.checked ? { open: "09:00", close: "18:00" } : null)
                    }
                  />
                  {DAY_LABELS[day]}
                </label>
                {hours ? (
                  <>
                    <input
                      type="time"
                      aria-label={`${DAY_LABELS[day]} opens`}
                      value={hours.open}
                      onChange={(event) => updateDay(day, { ...hours, open: event.target.value })}
                    />
                    <span aria-hidden="true">to</span>
                    <input
                      type="time"
                      aria-label={`${DAY_LABELS[day]} closes`}
                      value={hours.close}
                      onChange={(event) => updateDay(day, { ...hours, close: event.target.value })}
                    />
                  </>
                ) : (
                  <span className="muted">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="owner-card">
        <h2>Appearance and settings</h2>
        <Field label="Hero photo" htmlFor="b-hero" hint="Add photos in the Photos tab, then choose one here.">
          <select id="b-hero" value={draft.heroImage} onChange={(event) => update({ heroImage: event.target.value })}>
            <option value="">No photo (show the initial instead)</option>
            {media.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <div className="field-row">
          <Field label="Time zone" htmlFor="b-tz" hint="For example Europe/Dublin or Europe/Lisbon.">
            <input id="b-tz" value={draft.timeZone} onChange={(event) => update({ timeZone: event.target.value })} />
          </Field>
          <Field label="Currency" htmlFor="b-currency" hint="Three-letter code, e.g. EUR.">
            <input
              id="b-currency"
              value={draft.currency}
              maxLength={3}
              onChange={(event) => update({ currency: event.target.value.toUpperCase() })}
            />
          </Field>
        </div>
      </section>

      <div className="owner-savebar">
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
        <button type="submit" className="btn btn-dark" disabled={saving}>
          {saving ? "Saving…" : "Save business details"}
        </button>
      </div>
    </form>
  );
}

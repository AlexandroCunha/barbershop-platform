import { useEffect, useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import type { Service } from "../types";
import { Field, Notice, errorText } from "./ui";
import { NewServiceForm } from "./NewServiceForm";

export function ServicesPanel() {
  const { api, business } = useTenant();
  const [services, setServices] = useState<Service[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .services()
      .then(setServices)
      .catch((caught: unknown) => setLoadError(errorText(caught)));
  }, [api]);

  if (loadError) return <Notice kind="error">{loadError}</Notice>;
  if (!services) return <p className="status">Loading services…</p>;

  return (
    <div className="owner-stack">
      <p className="muted">
        Prices are in {business.currency}. The duration decides how long each booking holds the chair.
      </p>
      <NewServiceForm onCreated={(created) => setServices((current) => [...(current ?? []), created])} />
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          currency={business.currency}
          onSaved={(saved) =>
            setServices((current) => current?.map((item) => (item.id === saved.id ? saved : item)) ?? null)
          }
          onRemoved={(id) => setServices((current) => current?.filter((item) => item.id !== id) ?? null)}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  service,
  currency,
  onSaved,
  onRemoved,
}: {
  service: Service;
  currency: string;
  onSaved: (saved: Service) => void;
  onRemoved: (id: number) => void;
}) {
  const { api } = useTenant();
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [price, setPrice] = useState((service.priceCents / 100).toFixed(2));
  const [duration, setDuration] = useState(String(service.durationMinutes));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function remove() {
    if (!window.confirm(`Remove ${service.name}? Past bookings keep it.`)) return;
    try {
      await api.owner.archiveService(service.id);
      onRemoved(service.id);
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    const durationMinutes = Number(duration);

    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setResult({ kind: "error", text: "Enter a price, for example 28.00." });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      setResult({ kind: "error", text: "Duration must be a whole number of minutes between 5 and 480." });
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const saved = await api.owner.updateService(service.id, {
        name: name.trim(),
        description: description.trim(),
        priceCents,
        durationMinutes,
      });
      onSaved(saved);
      setResult({ kind: "ok", text: "Saved." });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="owner-card owner-form" onSubmit={handleSave} noValidate>
      <Field label="Service name" htmlFor={`sname-${service.id}`}>
        <input id={`sname-${service.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field label="Description" htmlFor={`sdesc-${service.id}`}>
        <textarea
          id={`sdesc-${service.id}`}
          rows={2}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="field-row">
        <Field label={`Price (${currency})`} htmlFor={`sprice-${service.id}`}>
          <input
            id={`sprice-${service.id}`}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field label="Duration (minutes)" htmlFor={`sdur-${service.id}`}>
          <input
            id={`sdur-${service.id}`}
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </Field>
      </div>

      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <button type="button" className="btn btn-ghost" onClick={remove}>
          Remove service
        </button>
        <button type="submit" className="btn btn-dark" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save service"}
        </button>
      </div>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import { useTenant } from "../tenant-context";
import type { Professional } from "../types";
import { Field, Notice, errorText } from "./ui";

/** Adds a barber. Their photo, specialties and biography can be filled in afterwards. */
export function NewBarberForm({ onCreated }: { onCreated: (created: Professional) => void }) {
  const { api } = useTenant();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const created = await api.owner.createProfessional({ name: name.trim(), specialties: [], bio: "" });
      onCreated(created);
      setName("");
      setResult({ kind: "ok", text: `Added ${created.name}. Fill in their details below.` });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="owner-card owner-form" onSubmit={handleSubmit} noValidate>
      <h2>Add a barber</h2>
      <Field label="Name" htmlFor="new-barber-name">
        <input id="new-barber-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <button type="submit" className="btn btn-dark" disabled={busy || !name.trim()}>
          {busy ? "Adding…" : "Add barber"}
        </button>
      </div>
    </form>
  );
}

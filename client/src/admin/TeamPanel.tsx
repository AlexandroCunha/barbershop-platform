import { Fragment, useEffect, useState, type FormEvent } from "react";
import { mediaSrc } from "../media";
import { useTenant } from "../tenant-context";
import type { MediaItem, Professional } from "../types";
import { Field, Notice, errorText } from "./ui";
import { BarberLoginCard } from "./BarberLoginCard";
import { NewBarberForm } from "./NewBarberForm";

export function TeamPanel() {
  const { api } = useTenant();
  const [people, setPeople] = useState<Professional[] | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .professionals()
      .then(setPeople)
      .catch((caught: unknown) => setLoadError(errorText(caught)));
    api.owner
      .listMedia()
      .then(setMedia)
      .catch(() => setMedia([]));
  }, [api]);

  if (loadError) return <Notice kind="error">{loadError}</Notice>;
  if (!people) return <p className="status">Loading barbers…</p>;

  return (
    <div className="owner-stack">
      <NewBarberForm onCreated={(created) => setPeople((current) => [...(current ?? []), created])} />
      {people.map((person) => (
        <Fragment key={person.id}>
          <BarberCard
            person={person}
            media={media}
            onSaved={(saved) =>
              setPeople((current) => current?.map((item) => (item.id === saved.id ? saved : item)) ?? null)
            }
            onRemoved={(id) => setPeople((current) => current?.filter((item) => item.id !== id) ?? null)}
          />
          <BarberLoginCard person={person} />
        </Fragment>
      ))}
    </div>
  );
}

function BarberCard({
  person,
  media,
  onSaved,
  onRemoved,
}: {
  person: Professional;
  media: MediaItem[];
  onSaved: (saved: Professional) => void;
  onRemoved: (id: number) => void;
}) {
  const { api, slug } = useTenant();
  const [name, setName] = useState(person.name);
  const [specialties, setSpecialties] = useState(person.specialties.join(", "));
  const [bio, setBio] = useState(person.bio);
  const [photo, setPhoto] = useState(person.photo ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function remove() {
    if (!window.confirm(`Remove ${person.name}? Their past bookings are kept.`)) return;
    try {
      await api.owner.archiveProfessional(person.id);
      onRemoved(person.id);
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const saved = await api.owner.updateProfessional(person.id, {
        name: name.trim(),
        specialties: specialties
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        bio: bio.trim(),
        photo: photo || null,
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
      <div className="barber-edit">
        <div className="barber-edit-photo">
          {photo ? <img src={mediaSrc(slug, photo)} alt="" /> : <span aria-hidden="true">{name.charAt(0)}</span>}
        </div>
        <div className="barber-edit-fields">
          <div className="field-row">
            <Field label="Name" htmlFor={`name-${person.id}`}>
              <input id={`name-${person.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Specialties" htmlFor={`spec-${person.id}`} hint="Separate with commas.">
              <input
                id={`spec-${person.id}`}
                value={specialties}
                onChange={(event) => setSpecialties(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Biography" htmlFor={`bio-${person.id}`}>
            <textarea
              id={`bio-${person.id}`}
              rows={3}
              maxLength={600}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </Field>
          <Field label="Portrait" htmlFor={`photo-${person.id}`} hint="Add photos in the Photos tab.">
            <select id={`photo-${person.id}`} value={photo} onChange={(event) => setPhoto(event.target.value)}>
              <option value="">No photo (show the initial)</option>
              {media.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <button type="button" className="btn btn-ghost" onClick={remove}>
          Remove barber
        </button>
        <button type="submit" className="btn btn-dark" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : `Save ${person.name.split(" ")[0] || "barber"}`}
        </button>
      </div>
    </form>
  );
}

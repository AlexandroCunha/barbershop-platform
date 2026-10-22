import { useEffect, useState, type ChangeEvent } from "react";
import { useTenant } from "../tenant-context";
import type { MediaItem } from "../types";
import { Notice, errorText } from "./ui";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Result = { kind: "ok" | "error"; text: string };

export function MediaPanel() {
  const { api } = useTenant();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    api.owner
      .listMedia()
      .then(setItems)
      .catch((caught: unknown) => setResult({ kind: "error", text: errorText(caught) }));
  }, [api]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setResult({ kind: "error", text: "Choose a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setResult({ kind: "error", text: "The photo is larger than 8 MB. Please resize it and try again." });
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      const uploaded = await api.owner.uploadMedia(file);
      setItems((current) => [...(current ?? []), uploaded].sort((a, b) => a.name.localeCompare(b.name)));
      setResult({ kind: "ok", text: `Uploaded ${uploaded.name}.` });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(name: string) {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;

    setRemoving(name);
    setResult(null);
    try {
      await api.owner.removeMedia(name);
      setItems((current) => current?.filter((item) => item.name !== name) ?? null);
      setResult({ kind: "ok", text: `Removed ${name}.` });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="owner-stack">
      <section className="owner-card">
        <h2>Add a photo</h2>
        <p className="muted">
          JPG, PNG or WebP, up to 8 MB. Landscape photos suit the hero; portraits (4:5) suit the barbers.
        </p>
        <label className={`upload${uploading ? " is-busy" : ""}`}>
          <input type="file" accept={ACCEPTED.join(",")} onChange={handleUpload} disabled={uploading} />
          <span>{uploading ? "Uploading…" : "Choose a photo"}</span>
        </label>
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
      </section>

      <section className="owner-card">
        <h2>Your photos</h2>
        {!items && <p className="status">Loading photos…</p>}
        {items && items.length === 0 && <p className="muted">No photos yet.</p>}
        {items && items.length > 0 && (
          <ul className="media-grid">
            {items.map((item) => (
              <li key={item.name}>
                <img src={item.url} alt="" loading="lazy" />
                <span className="media-name">{item.name}</span>
                <button
                  type="button"
                  className="btn btn-ghost media-remove"
                  disabled={removing !== null}
                  onClick={() => handleRemove(item.name)}
                >
                  {removing === item.name ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

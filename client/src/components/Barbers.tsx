import { mediaSrc } from "../media";
import { useTenant } from "../tenant-context";
import type { Professional } from "../types";

interface Props {
  professionals: Professional[] | null;
  selectedId?: number;
  loading: boolean;
  error: string | null;
  onChoose: (professionalId: number | undefined) => void;
}

/** The barbers, shown in the main column of the barbers section. */
export function Barbers({ professionals, selectedId, loading, error, onChoose }: Props) {
  const { slug } = useTenant();
  return (
    <div className="showcase-main">
      <header className="section-head">
        <p className="eyebrow">Barbers</p>
        <h2 id="barbers-title">Choose your barber</h2>
        <p className="muted">
          Tap a portrait to book with that barber, or leave none selected and choose one when you pick a time.
        </p>
      </header>

      {loading && <p className="status">Loading barbers…</p>}
      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}

      {professionals && (
        <ul className="barber-grid">
          {professionals.map((person) => {
            const isSelected = selectedId === person.id;
            return (
              <li key={person.id} className={`barber${isSelected ? " is-selected" : ""}`}>
                <button
                  type="button"
                  className="barber-photo"
                  aria-pressed={isSelected}
                  aria-label={`Book with ${person.name}`}
                  onClick={() => onChoose(isSelected ? undefined : person.id)}
                >
                  {person.photo ? (
                    <img src={mediaSrc(slug, person.photo)} alt="" />
                  ) : (
                    <span className="barber-initial" aria-hidden="true">
                      {person.name.charAt(0)}
                    </span>
                  )}
                  <span className="barber-badge">{isSelected ? "Selected" : "Book"}</span>
                </button>

                <h3>{person.name}</h3>
                {person.specialties.length > 0 && (
                  <p className="barber-specialties">{person.specialties.join(" · ")}</p>
                )}
                {person.bio && <p className="barber-bio">{person.bio}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

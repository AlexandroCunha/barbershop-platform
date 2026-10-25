import type { Professional } from "../../types";
import { FieldError } from "./FieldError";

interface Props {
  professionals: Professional[] | null;
  loadError: string | null;
  professionalId?: number;
  error?: string;
  onBarberChange: (id: number) => void;
}

/** Step one: the customer chooses the barber. Choosing one moves on to the service. */
export function BarberStep({ professionals, loadError, professionalId, error, onBarberChange }: Props) {
  return (
    <fieldset>
      <legend>Choose your barber</legend>
      {!professionals && !loadError && <p className="status">Loading barbers…</p>}
      <div className="option-list">
        {professionals?.map((person) => (
          <label key={person.id} className={`option${professionalId === person.id ? " is-selected" : ""}`}>
            {/* onClick, not onChange: a barber already chosen must still move the customer on when tapped again. */}
            <input
              type="radio"
              name="barber"
              value={person.id}
              checked={professionalId === person.id}
              readOnly
              onClick={() => onBarberChange(person.id)}
            />
            <span className="option-main">
              <span className="option-title">{person.name}</span>
              {person.specialties.length > 0 && <span className="muted">{person.specialties.join(" · ")}</span>}
            </span>
          </label>
        ))}
      </div>
      <FieldError id="err-barber" message={error} />
    </fieldset>
  );
}

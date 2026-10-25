import { formatDuration, formatPrice } from "../../format";
import { useTenant } from "../../tenant-context";
import type { Service } from "../../types";
import { FieldError } from "./FieldError";

interface Props {
  services: Service[] | null;
  loadError: string | null;
  serviceId?: number;
  error?: string;
  onServiceChange: (id: number) => void;
}

/** Step one: the customer chooses the service. */
export function ServiceStep({ services, loadError, serviceId, error, onServiceChange }: Props) {
  const { business } = useTenant();

  return (
    <fieldset>
      <legend>Choose a service</legend>
      {!services && !loadError && <p className="status">Loading services…</p>}
      <div className="option-list">
        {services?.map((item) => (
          <label key={item.id} className={`option${serviceId === item.id ? " is-selected" : ""}`}>
            {/* onClick, not onChange: a service already chosen must still move the customer on when tapped again. */}
            <input
              type="radio"
              name="service"
              value={item.id}
              checked={serviceId === item.id}
              readOnly
              onClick={() => onServiceChange(item.id)}
            />
            <span className="option-main">
              <span className="option-title">{item.name}</span>
              {item.description && <span className="muted">{item.description}</span>}
            </span>
            <span className="option-side">
              <span className="option-price">{formatPrice(item.priceCents, business.currency)}</span>
              <span className="muted">{formatDuration(item.durationMinutes)}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError id="err-service" message={error} />
    </fieldset>
  );
}

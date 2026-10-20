import { formatDuration, formatPrice } from "../format";
import { useBusiness } from "../tenant-context";
import type { Service } from "../types";

interface Props {
  services: Service[] | null;
  selectedId?: number;
  loading: boolean;
  error: string | null;
  onChoose: (serviceId: number) => void;
}

/** The services as a compact menu, beside the barbers. Choosing one moves to booking. */
export function Services({ services, selectedId, loading, error, onChoose }: Props) {
  const business = useBusiness();

  return (
    <aside id="services" className="service-menu" aria-labelledby="services-title">
      <p className="eyebrow">Services</p>
      <h3 id="services-title" className="menu-title">
        Menu
      </h3>

      {loading && <p className="status">Loading services…</p>}
      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}

      {services && (
        <ul className="menu-list">
          {services.map((service) => {
            const isSelected = selectedId === service.id;
            return (
              <li key={service.id}>
                <a
                  className={`menu-item${isSelected ? " is-selected" : ""}`}
                  href="#book"
                  onClick={() => onChoose(service.id)}
                >
                  <span className="menu-item-main">
                    <span className="menu-name">{service.name}</span>
                    <span className="menu-meta">{formatDuration(service.durationMinutes)}</span>
                  </span>
                  <span className="menu-price">{formatPrice(service.priceCents, business.currency)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

import { mapsHref, whatsappNumber } from "../contact";
import { openStatus } from "../format";
import { mediaSrc } from "../media";
import { useTenant } from "../tenant-context";

export function Hero() {
  const { slug, business } = useTenant();
  const status = openStatus(business);
  const image = business.heroImage ? mediaSrc(slug, business.heroImage) : null;
  const maps = mapsHref(business);
  const whatsapp = whatsappNumber(business);

  return (
    <section id="top" className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          {business.address.city && <p className="eyebrow">{business.address.city}</p>}
          <h1>{business.tagline || business.name}</h1>
          {business.about && <p className="lede">{business.about}</p>}

          <div className="hero-actions">
            <a className="btn btn-dark" href="#book">
              Book an appointment
            </a>
          </div>

          <dl className="hero-facts">
            <div>
              <dt>Today</dt>
              <dd className={status.open ? "is-open" : undefined}>{status.label}</dd>
            </div>
            {business.address.street && (
              <div>
                <dt>Find us</dt>
                <dd>
                  {maps ? (
                    <a href={maps} target="_blank" rel="noopener noreferrer">
                      {business.address.street}
                    </a>
                  ) : (
                    business.address.street
                  )}
                </dd>
              </div>
            )}
            {whatsapp && (
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                    {business.whatsapp || business.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <figure className="hero-media">
          {image ? (
            <img src={image} alt={business.name} />
          ) : (
            <div className="hero-monogram" aria-hidden="true">
              <span>{business.name.charAt(0)}</span>
            </div>
          )}
        </figure>
      </div>
    </section>
  );
}

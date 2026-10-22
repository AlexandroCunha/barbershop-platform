import { digitsOnly } from "../contact";
import { currentDay, DAY_LABELS, WEEK_ORDER } from "../format";
import { useBusiness } from "../tenant-context";


export function Visit() {
  const business = useBusiness();
  const today = currentDay(business.timeZone);
  const { street, city, postcode, country } = business.address;
  const addressLines = [street, [postcode, city].filter(Boolean).join(" "), country].filter(Boolean);

  const contacts = [
    business.phone && { label: "Phone", value: business.phone, href: `tel:${business.phone}` },
    business.whatsapp && {
      label: "WhatsApp",
      value: business.whatsapp,
      href: `https://wa.me/${digitsOnly(business.whatsapp)}`,
    },
    business.email && { label: "Email", value: business.email, href: `mailto:${business.email}` },
    business.instagram && {
      label: "Instagram",
      value: `@${business.instagram}`,
      href: `https://instagram.com/${business.instagram}`,
    },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <section id="visit" className="block block-tinted" data-reveal aria-labelledby="visit-title">
      <div className="container visit-grid">
        <div>
          <p className="eyebrow">Visit</p>
          <h2 id="visit-title">Find us</h2>

          {addressLines.length > 0 && (
            <address className="visit-address">
              {addressLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          )}

          {business.mapsUrl && (
            <a className="link-arrow" href={business.mapsUrl} target="_blank" rel="noopener noreferrer">
              Get directions
            </a>
          )}

          {contacts.length > 0 && (
            <ul className="contact-list">
              {contacts.map((contact) => (
                <li key={contact.label}>
                  <span className="contact-label">{contact.label}</span>
                  <a href={contact.href} target={contact.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    {contact.value}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="hours-title">Opening hours</h3>
          <table className="hours">
            <tbody>
              {WEEK_ORDER.map((day) => {
                const hours = business.hours[day];
                return (
                  <tr key={day} className={day === today ? "is-today" : undefined}>
                    <th scope="row">{DAY_LABELS[day]}</th>
                    <td>{hours ? `${hours.open} – ${hours.close}` : "Closed"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

import { useTenant } from "../tenant-context";

export function Footer() {
  const { business } = useTenant();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <p className="footer-name">{business.name}</p>
          {business.tagline && <p className="footer-tagline">{business.tagline}</p>}
        </div>

        <nav aria-label="Footer">
          <a href="#services">Services</a>
          <a href="#barbers">Barbers</a>
          <a href="#book">Book</a>
          <a href="#visit">Visit</a>
        </nav>

        {business.instagram && (
          <a className="footer-social" href={`https://instagram.com/${business.instagram}`} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        )}
      </div>
      <p className="copyright">
        © {year} {business.name}
      </p>
    </footer>
  );
}

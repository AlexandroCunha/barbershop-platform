import { useState } from "react";
import { useBusiness } from "../tenant-context";
import { AccessButton } from "./AccessButton";

export function Header() {
  const business = useBusiness();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="wordmark" href="#top" onClick={close}>
          {business.name}
        </a>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>

        <nav id="site-nav" className={`site-nav${open ? " is-open" : ""}`} aria-label="Primary">
          <a href="#barbers" onClick={close}>Barbers</a>
          <a href="#visit" onClick={close}>Visit</a>
        </nav>

        <a className="btn btn-dark header-cta" href="#book">
          Book appointment
        </a>

        <AccessButton />
      </div>
    </header>
  );
}

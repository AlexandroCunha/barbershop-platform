import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** The shop whose owner area is offered. Left out where there is no shop. */
  ownerSlug?: string;
}

/**
 * A quiet entry point for the owner and the developer. It is not in the main navigation: it
 * opens a side panel from the footer, so customers see the booking page first.
 */
export function AccessMenu({ ownerSlug }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button type="button" className="access-toggle" aria-expanded={open} aria-controls="access-panel" onClick={() => setOpen(true)}>
        Access
      </button>

      {open &&
        createPortal(
          <>
            <div className="access-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
            <aside id="access-panel" className="access-panel" aria-label="Access">
              <div className="access-head">
                <p>Access</p>
                <button type="button" className="access-close" onClick={() => setOpen(false)} aria-label="Close access menu">
                  ×
                </button>
              </div>
              <nav className="access-links">
                {ownerSlug && <a href={`/${ownerSlug}/admin`}>Owner area</a>}
                {ownerSlug && <a href={`/${ownerSlug}/barber`}>Barber area</a>}
                <a href="/platform">Developer area</a>
              </nav>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}

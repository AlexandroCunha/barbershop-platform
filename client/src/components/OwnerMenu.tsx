import { useEffect, useRef, useState } from "react";
import { useTenant } from "../tenant-context";

/**
 * The owner's menu in the top-right corner of the site. It holds the way into the screen where the
 * owner customises the site. Customers see only the button, which stays out of the way.
 */
export function OwnerMenu() {
  const { slug } = useTenant();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="owner-menu" ref={menu}>
      <button
        type="button"
        className="owner-menu-toggle"
        aria-expanded={open}
        aria-controls="owner-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        Owner
      </button>
      {open && (
        <div id="owner-menu-panel" className="owner-menu-panel">
          <a href={`/${slug}/admin`}>Customise site</a>
        </div>
      )}
    </div>
  );
}

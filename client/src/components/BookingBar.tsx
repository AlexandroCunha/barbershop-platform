import { useEffect, useState } from "react";

/**
 * On phones the booking call-to-action is always one tap away. It steps aside
 * while the booking section itself is on screen.
 */
export function BookingBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById("book");
    if (!target || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => setHidden(entry?.isIntersecting ?? false), {
      threshold: 0.2,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <a className={`booking-bar${hidden ? " is-hidden" : ""}`} href="#book">
      <span>Book an appointment</span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

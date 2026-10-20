interface Props {
  items: string[];
}

/** Aim for at least this many items per half, so the strip covers very wide screens. */
const ITEMS_PER_HALF = 16;

/**
 * An endless strip of service names. The track holds two identical halves and
 * moves by exactly one half, so the loop has no gap. Decorative, so it is hidden
 * from screen readers.
 */
export function Ticker({ items }: Props) {
  if (items.length === 0) return null;

  const repeats = Math.max(2, Math.ceil(ITEMS_PER_HALF / items.length));
  const half = Array.from({ length: repeats }, () => items).flat();

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[...half, ...half].map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </div>
    </div>
  );
}

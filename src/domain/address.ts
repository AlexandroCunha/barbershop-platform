/** A shop's address can change once in this many days. */
export const ADDRESS_CHANGE_INTERVAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the owner may next change the address, or null when a change is allowed now. A shop whose
 * address has never changed may change it at once.
 */
export function nextAddressChange(lastChangedAt: Date | null, now: Date): Date | null {
  if (!lastChangedAt) return null;
  const next = new Date(lastChangedAt.getTime() + ADDRESS_CHANGE_INTERVAL_DAYS * DAY_MS);
  return next > now ? next : null;
}

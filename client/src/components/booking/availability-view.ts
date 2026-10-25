import type { Availability } from "../../types";

/** The start times on offer: the chosen barber's own, or every barber's while none is chosen. */
export function offeredTimes(availability: Availability | null, professionalId?: number): string[] {
  if (!availability) return [];
  if (professionalId === undefined) return availability.times;
  return availability.barbers.find((item) => item.professionalId === professionalId)?.times ?? [];
}

import type { Availability, Professional } from "../../types";

/** The start times on offer: the chosen barber's own, or every barber's while none is chosen. */
export function offeredTimes(availability: Availability | null, professionalId?: number): string[] {
  if (!availability) return [];
  if (professionalId === undefined) return availability.times;
  return availability.barbers.find((item) => item.professionalId === professionalId)?.times ?? [];
}

/** The barbers who have this start time free, in the shop's order. */
export function barbersFreeAt(
  availability: Availability | null,
  professionals: Professional[],
  slot: string,
): Professional[] {
  const free = new Set(
    availability?.barbers.filter((item) => item.times.includes(slot)).map((item) => item.professionalId),
  );
  return professionals.filter((person) => free.has(person.id));
}

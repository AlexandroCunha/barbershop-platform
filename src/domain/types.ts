export interface Service {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
}

export interface Professional {
  id: number;
  name: string;
  specialties: string[];
  bio: string;
  /** File name inside the shop's media folder, or null when no photo is set. */
  photo: string | null;
}

export interface Booking {
  id: string;
  serviceId: number;
  professionalId: number;
  date: string;
  startMinute: number;
  endMinute: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt: Date;
}

export type NewBooking = Omit<Booking, "id" | "createdAt">;

export interface ServicePatch {
  name?: string;
  description?: string;
  priceCents?: number;
  durationMinutes?: number;
}

export interface ProfessionalPatch {
  name?: string;
  specialties?: string[];
  bio?: string;
  /** `null` removes the photo. */
  photo?: string | null;
}

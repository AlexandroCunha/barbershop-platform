import type { Booking, NewBooking, Professional, ProfessionalPatch, Service, ServicePatch } from "../domain/types.js";

export interface ServiceRepository {
  findAll(): Promise<Service[]>;
  findById(id: number): Promise<Service | null>;
  update(id: number, patch: ServicePatch): Promise<Service | null>;
}

export interface ProfessionalRepository {
  findAll(): Promise<Professional[]>;
  findById(id: number): Promise<Professional | null>;
  update(id: number, patch: ProfessionalPatch): Promise<Professional | null>;
}

export interface BookingRepository {
  findByProfessionalAndDate(professionalId: number, isoDate: string): Promise<Booking[]>;
  create(booking: NewBooking): Promise<Booking>;
}

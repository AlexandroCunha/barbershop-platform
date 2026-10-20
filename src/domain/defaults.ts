import type { Business } from "./business.js";

/** Trial length for a new barbershop, in days. */
export const TRIAL_DAYS = 14;

/** Starting values for a new barbershop. The owner replaces them in the owner area. */
export const DEFAULT_BUSINESS: Business = {
  name: "Your Barbershop",
  tagline: "",
  about: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: { street: "", city: "", postcode: "", country: "" },
  mapsUrl: "",
  instagram: "",
  hours: {
    sunday: null,
    monday: { open: "09:00", close: "19:00" },
    tuesday: { open: "09:00", close: "19:00" },
    wednesday: { open: "09:00", close: "19:00" },
    thursday: { open: "09:00", close: "19:00" },
    friday: { open: "09:00", close: "19:00" },
    saturday: { open: "09:00", close: "18:00" },
  },
  heroImage: "",
  timeZone: "Europe/Dublin",
  currency: "EUR",
};

export const DEFAULT_SERVICES = [
  { name: "Haircut", description: "", priceCents: 2500, durationMinutes: 30 },
  { name: "Skin fade", description: "", priceCents: 3000, durationMinutes: 45 },
  { name: "Beard trim", description: "", priceCents: 1500, durationMinutes: 20 },
  { name: "Haircut and beard", description: "", priceCents: 3800, durationMinutes: 50 },
];

export const DEFAULT_PROFESSIONALS = [
  { name: "Barber 1", specialties: [], bio: "" },
  { name: "Barber 2", specialties: [], bio: "" },
];

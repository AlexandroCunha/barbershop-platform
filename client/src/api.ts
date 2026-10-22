import type {
  Availability,
  BookingInput,
  Business,
  Confirmation,
  MediaItem,
  OwnerSession,
  BarberBooking,
  BarberProfile,
  Professional,
  Service,
} from "./types";

/** Fired on the window when an owner request is refused because the session has ended. */
export const OWNER_SESSION_EXPIRED = "owner-session-expired";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

async function send<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error ?? "Something went wrong. Please try again.", response.status);
  }
  return body as T;
}

/** Owner calls: a refused session tells the page to show the sign-in form again. */
function ownerSend<T>(url: string, init: RequestInit | undefined, action: string): Promise<T> {
  return send<T>(url, init).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401 && action !== "login") {
      window.dispatchEvent(new Event(OWNER_SESSION_EXPIRED));
    }
    throw error;
  });
}

/** Everything one barbershop's site and owner area need. Build it once per shop. */
export function tenantApi(slug: string) {
  const base = `/api/t/${encodeURIComponent(slug)}`;
  const owner = `${base}/owner`;

  return {
    business: () => send<Business>(`${base}/business`),

    services: () => send<Service[]>(`${base}/services`),

    professionals: () => send<Professional[]>(`${base}/professionals`),

    availability: (serviceId: number, date: string, professionalId?: number, signal?: AbortSignal) => {
      const query = new URLSearchParams({ serviceId: String(serviceId), date });
      if (professionalId !== undefined) query.set("professionalId", String(professionalId));
      return send<Availability>(`${base}/availability?${query}`, { signal });
    },

    book: (input: BookingInput) => send<Confirmation>(`${base}/bookings`, json("POST", input)),

    /** A barber's own area. Separate from the owner's session. */
    barber: {
      login: (email: string, password: string) =>
        send<{ ok: boolean }>(`${base}/barber/login`, json("POST", { email, password })),

      logout: () => send<unknown>(`${base}/barber/logout`, { method: "POST" }),

      session: () => send<{ ok: boolean; professional: BarberProfile }>(`${base}/barber/session`),

      bookings: () => send<BarberBooking[]>(`${base}/barber/bookings`),
    },

    owner: {
      session: () => ownerSend<OwnerSession>(`${owner}/session`, undefined, "session"),

      login: (email: string, password: string) =>
        ownerSend<{ ok: boolean }>(`${owner}/login`, json("POST", { email, password }), "login"),

      logout: () => ownerSend<unknown>(`${owner}/logout`, { method: "POST" }, "logout"),

      changePassword: (currentPassword: string, newPassword: string) =>
        ownerSend<{ ok: boolean }>(`${owner}/password`, json("PUT", { currentPassword, newPassword }), "password"),

      saveBusiness: (business: Business) =>
        ownerSend<Business>(`${owner}/business`, json("PUT", business), "business"),

      /** Moves the shop to a new address. Returns the address it now has. */
      changeAddress: (slug: string) => ownerSend<{ slug: string }>(`${owner}/address`, json("PUT", { slug }), "address"),

      listMedia: () => ownerSend<MediaItem[]>(`${owner}/media`, undefined, "media"),

      uploadMedia: (file: File) =>
        ownerSend<MediaItem>(
          `${owner}/media?name=${encodeURIComponent(file.name)}`,
          { method: "POST", headers: { "Content-Type": file.type }, body: file },
          "media",
        ),

      createService: (input: { name: string; description: string; priceCents: number; durationMinutes: number }) =>
    ownerSend<Service>(`${owner}/services`, json("POST", input), "services"),

  createProfessional: (input: { name: string; specialties: string[]; bio: string }) =>
    ownerSend<Professional>(`${owner}/professionals`, json("POST", input), "professionals"),

  archiveService: (id: number) => ownerSend<unknown>(`${owner}/services/${id}`, { method: "DELETE" }, "services"),

  archiveProfessional: (id: number) =>
    ownerSend<unknown>(`${owner}/professionals/${id}`, { method: "DELETE" }, "professionals"),

  updateService: (id: number, patch: Partial<Omit<Service, "id">>) =>
        ownerSend<Service>(`${owner}/services/${id}`, json("PATCH", patch), "services"),

      updateProfessional: (id: number, patch: Partial<Omit<Professional, "id">>) =>
        ownerSend<Professional>(`${owner}/professionals/${id}`, json("PATCH", patch), "professionals"),

      /** Creates or replaces a barber's login. Their open sessions end at once. */
      setBarberLogin: (professionalId: number, email: string, password: string) =>
        ownerSend<{ email: string }>(
          `${owner}/professionals/${professionalId}/login`,
          json("PUT", { email, password }),
          "barber-login",
        ),

      removeBarberLogin: (professionalId: number) =>
        ownerSend<unknown>(`${owner}/professionals/${professionalId}/login`, { method: "DELETE" }, "barber-login"),
    },
  };
}

export type TenantApi = ReturnType<typeof tenantApi>;

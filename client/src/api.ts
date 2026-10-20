import type {
  Availability,
  BookingInput,
  Business,
  Confirmation,
  MediaItem,
  Professional,
  Service,
} from "./types";

const BASE = "/api";

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

async function readBody(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

function errorFrom(response: Response, body: { error?: string }): ApiError {
  return new ApiError(body.error ?? "Something went wrong. Please try again.", response.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw errorFrom(response, body);
  }
  return body as T;
}

/**
 * Owner requests. The session lives in an HttpOnly cookie that the browser sends
 * by itself, so no secret is kept in page code.
 */
async function ownerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE}/admin${path}`, { ...init, headers, credentials: "same-origin" });
  const body = await readBody(response);

  if (!response.ok) {
    // A refused sign-in is an answer, not an expired session.
    if (response.status === 401 && path !== "/login") {
      window.dispatchEvent(new Event(OWNER_SESSION_EXPIRED));
    }
    throw errorFrom(response, body);
  }
  return body as T;
}

export const api = {
  business: () => request<Business>("/business"),

  services: () => request<Service[]>("/services"),

  professionals: () => request<Professional[]>("/professionals"),

  availability: (serviceId: number, date: string, professionalId?: number, signal?: AbortSignal) => {
    const query = new URLSearchParams({ serviceId: String(serviceId), date });
    if (professionalId !== undefined) query.set("professionalId", String(professionalId));
    return request<Availability>(`/availability?${query}`, { signal });
  },

  book: (input: BookingInput) =>
    request<Confirmation>("/bookings", { method: "POST", body: JSON.stringify(input) }),
};

export const owner = {
  session: () => ownerRequest<{ ok: boolean }>("/session"),

  login: (token: string) =>
    ownerRequest<{ ok: boolean }>("/login", { method: "POST", body: JSON.stringify({ token }) }),

  logout: () => ownerRequest<unknown>("/logout", { method: "POST" }),

  saveBusiness: (business: Business) =>
    ownerRequest<Business>("/business", { method: "PUT", body: JSON.stringify(business) }),

  listMedia: () => ownerRequest<MediaItem[]>("/media"),

  uploadMedia: (file: File) =>
    ownerRequest<MediaItem>(`/media?name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    }),

  updateService: (id: number, patch: Partial<Omit<Service, "id">>) =>
    ownerRequest<Service>(`/services/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  updateProfessional: (id: number, patch: Partial<Omit<Professional, "id">>) =>
    ownerRequest<Professional>(`/professionals/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
};

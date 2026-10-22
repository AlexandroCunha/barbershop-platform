import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Tenant } from "../domain/tenant.js";
import type { Professional } from "../domain/types.js";
import type { MediaStorage } from "../media/media-storage.js";
import type { ProfessionalRepository, TenantRepository } from "../repositories/types.js";
import { AdminService } from "../services/admin-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

const clock: Clock = { now: () => new Date("2030-06-01T10:00:00Z"), today: () => "2030-06-01" };

function tenantWithCover(heroImage: string): Tenant {
  return {
    id: 1,
    slug: "northgate",
    name: "Northgate",
    business: { ...DEFAULT_BUSINESS, heroImage },
    licenseStatus: "active",
    trialEndsAt: null,
    paidUntil: null,
  };
}

/** Photos of one shop, kept in memory, with only the calls removal makes. */
function memoryMedia(names: string[]) {
  const files = new Set(names);
  const storage = {
    list: async () => [...files].sort(),
    delete: async (_shop: string, name: string) => {
      files.delete(name);
    },
  } as unknown as MediaStorage;
  return { storage, files };
}

function professionalsWith(people: Partial<Professional>[]): ProfessionalRepository {
  const rows = people.map((person, index) => ({ id: index + 1, name: "Barber", specialties: [], bio: "", photo: null, ...person }));
  return { findAll: async () => rows } as unknown as ProfessionalRepository;
}

function serviceFor(media: MediaStorage, professionals: ProfessionalRepository): AdminService {
  return new AdminService({} as TenantRepository, media, {} as never, professionals, clock);
}

test("an unused photo is removed", async () => {
  const { storage, files } = memoryMedia(["cut.jpg", "beard.jpg"]);
  await serviceFor(storage, professionalsWith([])).removeMedia(tenantWithCover(""), "cut.jpg");
  assert.deepEqual([...files], ["beard.jpg"]);
});

test("the site's cover photo is kept until another cover is chosen", async () => {
  const { storage, files } = memoryMedia(["cover.jpg"]);
  await assert.rejects(
    serviceFor(storage, professionalsWith([])).removeMedia(tenantWithCover("cover.jpg"), "cover.jpg"),
    (error: unknown) => error instanceof AppError && error.status === 409,
  );
  assert.deepEqual([...files], ["cover.jpg"]);
});

test("a barber's portrait is kept until another portrait is chosen", async () => {
  const { storage, files } = memoryMedia(["daniel.jpg"]);
  const professionals = professionalsWith([{ name: "Daniel", photo: "daniel.jpg" }]);
  await assert.rejects(
    serviceFor(storage, professionals).removeMedia(tenantWithCover(""), "daniel.jpg"),
    (error: unknown) => error instanceof AppError && error.status === 409 && /Daniel/.test(error.message),
  );
  assert.deepEqual([...files], ["daniel.jpg"]);
});

test("a photo that does not exist, or is not an image name, is not found", async () => {
  const { storage } = memoryMedia(["cut.jpg"]);
  const service = serviceFor(storage, professionalsWith([]));
  await assert.rejects(service.removeMedia(tenantWithCover(""), "missing.jpg"), (error: unknown) => error instanceof AppError && error.status === 404);
  await assert.rejects(service.removeMedia(tenantWithCover(""), "../cut.jpg"), (error: unknown) => error instanceof AppError && error.status === 404);
});

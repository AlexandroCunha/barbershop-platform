import type { Business } from "../domain/business.js";
import type { Professional, ProfessionalPatch, Service, ServicePatch } from "../domain/types.js";
import { nextAddressChange } from "../domain/address.js";
import { isValidSlug } from "../domain/slug.js";
import type { Tenant } from "../domain/tenant.js";
import type { MediaStorage } from "../media/media-storage.js";
import { savePhoto } from "../media/photo-upload.js";
import type {
  NewProfessional,
  NewService,
  ProfessionalRepository,
  ServiceRepository,
  TenantRepository,
} from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

/** What an owner may change about their own shop. */
export class AdminService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly media: MediaStorage,
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly clock: Clock,
  ) {}

  async saveBusiness(tenant: Tenant, business: Business): Promise<Business> {
    await this.tenants.updateBusiness(tenant.id, business);
    return business;
  }

  /**
   * The owner moves the shop to a new address, once in each period. The photos move with it, and the
   * old address keeps redirecting, so links that were already shared still work.
   */
  async changeAddress(tenant: Tenant, requested: string): Promise<Tenant> {
    const now = this.clock.now();
    const slug = requested.trim().toLowerCase();
    if (!isValidSlug(slug)) {
      throw new AppError(400, "The address must be 2-40 letters, digits or dashes, and not a reserved word");
    }
    if (slug === tenant.slug) {
      throw new AppError(400, "That is already your address");
    }

    const next = nextAddressChange(await this.tenants.lastAddressChange(tenant.id), now);
    if (next) {
      const when = next.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      throw new AppError(429, `You can change the address again after ${when}.`);
    }
    if (await this.tenants.addressInUse(slug)) {
      throw new AppError(409, "That address is already taken. Choose another.");
    }

    await this.media.rename(tenant.slug, slug);
    try {
      return await this.tenants.changeSlug(tenant.id, tenant.slug, slug, now);
    } catch (error) {
      // The address did not change, so the photos go back where they were.
      await this.media.rename(slug, tenant.slug);
      throw error;
    }
  }

  /** Each shop's photos are kept under its own address. */
  listMedia(tenant: Tenant): Promise<string[]> {
    return this.media.list(tenant.slug);
  }

  uploadMedia(tenant: Tenant, originalName: string, contentType: string, data: Buffer): Promise<string> {
    return savePhoto(this.media, tenant.slug, originalName, contentType, data);
  }

  createService(tenant: Tenant, input: NewService): Promise<Service> {
    return this.services.create(tenant.id, input);
  }

  createProfessional(tenant: Tenant, input: NewProfessional): Promise<Professional> {
    return this.professionals.create(tenant.id, input);
  }

  async archiveService(tenant: Tenant, id: number): Promise<void> {
    if (!(await this.services.archive(tenant.id, id))) {
      throw new AppError(404, "Service not found");
    }
  }

  async archiveProfessional(tenant: Tenant, id: number): Promise<void> {
    if (!(await this.professionals.archive(tenant.id, id))) {
      throw new AppError(404, "Professional not found");
    }
  }

  async updateService(tenant: Tenant, id: number, patch: ServicePatch): Promise<Service> {
    const service = await this.services.update(tenant.id, id, patch);
    if (!service) {
      throw new AppError(404, "Service not found");
    }
    return service;
  }

  async updateProfessional(tenant: Tenant, id: number, patch: ProfessionalPatch): Promise<Professional> {
    const professional = await this.professionals.update(tenant.id, id, patch);
    if (!professional) {
      throw new AppError(404, "Professional not found");
    }
    return professional;
  }
}

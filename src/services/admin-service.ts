import path from "node:path";
import { parseBusiness, type Business } from "../domain/business.js";
import type { Professional, ProfessionalPatch, Service, ServicePatch } from "../domain/types.js";
import type { Tenant } from "../domain/tenant.js";
import { MediaStore } from "../media/media-store.js";
import type {
  NewProfessional,
  NewService,
  ProfessionalRepository,
  ServiceRepository,
  TenantRepository,
} from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";

/** What an owner may change about their own shop. */
export class AdminService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly mediaRoot: string,
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
  ) {}

  async saveBusiness(tenant: Tenant, input: unknown): Promise<Business> {
    const business = parseBusiness(input);
    await this.tenants.updateBusiness(tenant.id, business);
    return business;
  }

  private mediaFor(tenant: Tenant): MediaStore {
    // Each shop's photos live in their own folder, named after its address.
    return new MediaStore(path.join(this.mediaRoot, tenant.slug));
  }

  listMedia(tenant: Tenant): Promise<string[]> {
    return this.mediaFor(tenant).list();
  }

  uploadMedia(tenant: Tenant, originalName: string, contentType: string, data: Buffer): Promise<string> {
    return this.mediaFor(tenant).save(originalName, contentType, data);
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

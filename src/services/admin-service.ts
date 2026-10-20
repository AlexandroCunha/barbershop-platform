import type { BusinessStore } from "../content/business-store.js";
import { parseBusiness, type Business } from "../domain/business.js";
import type { Professional, ProfessionalPatch, Service, ServicePatch } from "../domain/types.js";
import type { MediaStore } from "../media/media-store.js";
import type { ProfessionalRepository, ServiceRepository } from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";

/** Use cases behind the owner's area. */
export class AdminService {
  constructor(
    private readonly business: BusinessStore,
    private readonly media: MediaStore,
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
  ) {}

  async saveBusiness(input: unknown): Promise<Business> {
    const business = parseBusiness(input);
    await this.business.write(business);
    return business;
  }

  listMedia(): Promise<string[]> {
    return this.media.list();
  }

  uploadMedia(originalName: string, contentType: string, data: Buffer): Promise<string> {
    return this.media.save(originalName, contentType, data);
  }

  async updateService(id: number, patch: ServicePatch): Promise<Service> {
    const service = await this.services.update(id, patch);
    if (!service) {
      throw new AppError(404, "Service not found");
    }
    return service;
  }

  async updateProfessional(id: number, patch: ProfessionalPatch): Promise<Professional> {
    const professional = await this.professionals.update(id, patch);
    if (!professional) {
      throw new AppError(404, "Professional not found");
    }
    return professional;
  }
}

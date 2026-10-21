import type { Request, Response } from "express";
import { parseBusiness } from "../domain/business.js";
import { mediaUrl } from "../domain/media-name.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import { MEDIA_CONTENT_TYPES } from "../media/media-store.js";
import type { AdminService } from "../services/admin-service.js";
import { AppError } from "../utils/app-error.js";
import {
  parseNewProfessional,
  parseNewService,
  parseProfessionalId,
  parseProfessionalPatch,
  parseServiceId,
  parseServicePatch,
} from "../validations/admin.js";

/** The owner's content endpoints for their own shop. */
export class AdminController {
  constructor(private readonly service: AdminService) {}

  saveBusiness = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.saveBusiness(tenantOf(req), parseBusiness(req.body)));
  };

  listMedia = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const names = await this.service.listMedia(tenant);
    res.json(names.map((name) => ({ name, url: mediaUrl(tenant.slug, name) })));
  };

  /** The request body is the raw image; the file name arrives in the query string. */
  uploadMedia = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!MEDIA_CONTENT_TYPES.includes(contentType)) {
      throw new AppError(415, "Upload a JPG, PNG or WebP image");
    }

    const originalName = typeof req.query.name === "string" ? req.query.name : "photo";
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const name = await this.service.uploadMedia(tenant, originalName, contentType, data);

    res.status(201).json({ name, url: mediaUrl(tenant.slug, name) });
  };

  createService = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.createService(tenantOf(req), parseNewService(req.body)));
  };

  createProfessional = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.createProfessional(tenantOf(req), parseNewProfessional(req.body)));
  };

  archiveService = async (req: Request, res: Response): Promise<void> => {
    await this.service.archiveService(tenantOf(req), parseServiceId(String(req.params.id)));
    res.status(204).end();
  };

  archiveProfessional = async (req: Request, res: Response): Promise<void> => {
    await this.service.archiveProfessional(tenantOf(req), parseProfessionalId(String(req.params.id)));
    res.status(204).end();
  };

  updateService = async (req: Request, res: Response): Promise<void> => {
    const id = parseServiceId(String(req.params.id));
    res.json(await this.service.updateService(tenantOf(req), id, parseServicePatch(req.body)));
  };

  updateProfessional = async (req: Request, res: Response): Promise<void> => {
    const id = parseProfessionalId(String(req.params.id));
    res.json(await this.service.updateProfessional(tenantOf(req), id, parseProfessionalPatch(req.body)));
  };
}

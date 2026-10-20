import type { Request, Response } from "express";
import { mediaUrl } from "../domain/media-name.js";
import { MEDIA_CONTENT_TYPES } from "../media/media-store.js";
import type { AdminService } from "../services/admin-service.js";
import { AppError } from "../utils/app-error.js";
import {
  parseProfessionalId,
  parseProfessionalPatch,
  parseServiceId,
  parseServicePatch,
} from "../validations/admin.js";

/** The owner's content endpoints. Every route here sits behind requireOwner. */
export class AdminController {
  constructor(private readonly service: AdminService) {}

  saveBusiness = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.saveBusiness(req.body));
  };

  listMedia = async (_req: Request, res: Response): Promise<void> => {
    const names = await this.service.listMedia();
    res.json(names.map((name) => ({ name, url: mediaUrl(name) })));
  };

  /** The request body is the raw image; the file name arrives in the query string. */
  uploadMedia = async (req: Request, res: Response): Promise<void> => {
    const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!MEDIA_CONTENT_TYPES.includes(contentType)) {
      throw new AppError(415, "Upload a JPG, PNG or WebP image");
    }

    const originalName = typeof req.query.name === "string" ? req.query.name : "photo";
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const name = await this.service.uploadMedia(originalName, contentType, data);

    res.status(201).json({ name, url: mediaUrl(name) });
  };

  updateService = async (req: Request, res: Response): Promise<void> => {
    const id = parseServiceId(String(req.params.id));
    res.json(await this.service.updateService(id, parseServicePatch(req.body)));
  };

  updateProfessional = async (req: Request, res: Response): Promise<void> => {
    const id = parseProfessionalId(String(req.params.id));
    res.json(await this.service.updateProfessional(id, parseProfessionalPatch(req.body)));
  };
}

import type { NextFunction, Request, RequestHandler, Response } from "express";
import { hasMediaExtension, isMediaFileName } from "../domain/media-name.js";
import { isValidSlug } from "../domain/slug.js";
import type { MediaStorage } from "../media/media-storage.js";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Streams one photo from storage. Photo names are never reused (an upload never overwrites), so
 * the response can be cached for good, and a CDN placed in front of /media serves most requests.
 */
export function serveMedia(storage: MediaStorage): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slug = String(req.params.slug ?? "");
    const file = String(req.params.file ?? "");
    if (!isValidSlug(slug) || !isMediaFileName(file) || !hasMediaExtension(file)) {
      res.status(404).end();
      return;
    }

    try {
      const photo = await storage.get(slug, file);
      if (!photo) {
        res.status(404).end();
        return;
      }

      res.setHeader("Content-Type", photo.contentType);
      res.setHeader("Content-Length", String(photo.size));
      res.setHeader("Cache-Control", `public, max-age=${ONE_YEAR_SECONDS}, immutable`);

      photo.body.on("error", (error) => res.destroy(error));
      photo.body.pipe(res);
    } catch (error) {
      next(error);
    }
  };
}

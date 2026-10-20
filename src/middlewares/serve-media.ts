import path from "node:path";
import type { Request, RequestHandler, Response } from "express";
import { hasMediaExtension, isMediaFileName } from "../domain/media-name.js";
import { isValidSlug } from "../domain/slug.js";

/** Serves one photo from one shop's folder. Names are checked before they reach the disk. */
export function serveMedia(mediaRoot: string): RequestHandler {
  return (req: Request, res: Response): void => {
    const slug = String(req.params.slug ?? "");
    const file = String(req.params.file ?? "");
    if (!isValidSlug(slug) || !isMediaFileName(file) || !hasMediaExtension(file)) {
      res.status(404).end();
      return;
    }

    res.sendFile(file, { root: path.join(mediaRoot, slug), dotfiles: "deny" }, (error) => {
      if (error && !res.headersSent) {
        res.status(404).end();
      }
    });
  };
}

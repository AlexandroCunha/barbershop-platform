import path from "node:path";
import { AppError } from "../utils/app-error.js";
import { PHOTO_EXTENSIONS, type MediaStorage } from "./media-storage.js";

/** Stops after this many "name-N" tries, so a crowded shop cannot loop forever. */
const MAX_NAME_ATTEMPTS = 100;

/** Checks the file's signature bytes, so a renamed file cannot pass as an image. */
export function matchesContentType(contentType: string, data: Buffer): boolean {
  switch (contentType) {
    case "image/jpeg":
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/png":
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
    default:
      return false;
  }
}

/** "Hero Shot!" -> "hero-shot". Only lowercase letters, digits and single dashes remain. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Stores an uploaded photo for one shop under a simple name: "hero-shot.jpg", then
 * "hero-shot-2.jpg" if that name is taken. A photo is never overwritten.
 */
export async function savePhoto(
  storage: MediaStorage,
  shop: string,
  originalName: string,
  contentType: string,
  data: Buffer,
): Promise<string> {
  const extension = PHOTO_EXTENSIONS[contentType];
  if (!extension) {
    throw new AppError(415, "Upload a JPG, PNG or WebP image");
  }
  if (data.length === 0 || !matchesContentType(contentType, data)) {
    throw new AppError(400, "The file is not a valid image of that type");
  }

  const base = slugify(path.basename(originalName, path.extname(originalName))) || "photo";

  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    const name = attempt === 1 ? `${base}${extension}` : `${base}-${attempt}${extension}`;
    if (await storage.putIfAbsent(shop, name, contentType, data)) {
      return name;
    }
  }

  throw new AppError(409, "Too many photos share this name. Rename the file and try again.");
}

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasMediaExtension, isMediaFileName } from "../domain/media-name.js";
import { AppError } from "../utils/app-error.js";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const MEDIA_CONTENT_TYPES = Object.keys(EXTENSIONS);

/** Stops after this many "name-N" tries, so a crowded folder cannot loop forever. */
const MAX_NAME_ATTEMPTS = 100;

/** Checks the file's signature bytes, so a renamed file cannot pass as an image. */
function matchesContentType(contentType: string, data: Buffer): boolean {
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
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * The folder where the owner's photos live. Names stay simple: "hero-shot.jpg",
 * then "hero-shot-2.jpg" if that name is taken. Files are served under /media.
 */
export class MediaStore {
  constructor(private readonly dir: string) {}

  /** Image files in the folder, sorted by name. Files with unusual names are left out. */
  async list(): Promise<string[]> {
    await mkdir(this.dir, { recursive: true });
    const names = await readdir(this.dir);
    return names.filter((name) => isMediaFileName(name) && hasMediaExtension(name)).sort();
  }

  async save(originalName: string, contentType: string, data: Buffer): Promise<string> {
    const extension = EXTENSIONS[contentType];
    if (!extension) {
      throw new AppError(415, "Upload a JPG, PNG or WebP image");
    }
    if (data.length === 0 || !matchesContentType(contentType, data)) {
      throw new AppError(400, "The file is not a valid image of that type");
    }

    const base = slugify(path.basename(originalName, path.extname(originalName))) || "photo";
    await mkdir(this.dir, { recursive: true });

    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
      const name = attempt === 1 ? `${base}${extension}` : `${base}-${attempt}${extension}`;
      try {
        // "wx" fails if the file exists, so a photo is never overwritten.
        await writeFile(path.join(this.dir, name), data, { flag: "wx" });
        return name;
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
          throw error;
        }
      }
    }

    throw new AppError(409, "Too many photos share this name. Rename the file and try again.");
  }
}

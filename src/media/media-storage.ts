import type { Readable } from "node:stream";

/** Where a shop's photos are kept. Local disk for one server, S3-compatible storage for many. */
export interface MediaStorage {
  /** The photo file names of one shop, sorted. Files with unusual names are left out. */
  list(shop: string): Promise<string[]>;
  /** Stores the bytes under `name` unless that name is already taken. Returns false when it is taken. */
  putIfAbsent(shop: string, name: string, contentType: string, data: Buffer): Promise<boolean>;
  /** The photo, or null when there is none under that name. The caller must consume or destroy the body. */
  get(shop: string, name: string): Promise<StoredPhoto | null>;
  /** Moves every photo of one shop to another shop name. Nothing is moved if the target name is taken. */
  rename(from: string, to: string): Promise<void>;
}

export interface StoredPhoto {
  body: Readable;
  contentType: string;
  size: number;
}

/** Image types the owner may upload, each with the extension it is stored under. */
export const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const MEDIA_CONTENT_TYPES = Object.keys(PHOTO_EXTENSIONS);

const SERVED_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** The content type a photo is served with, judged by its file name. Undefined for other names. */
export function contentTypeOf(name: string): string | undefined {
  const lower = name.toLowerCase();
  return SERVED_CONTENT_TYPES[lower.slice(lower.lastIndexOf("."))];
}

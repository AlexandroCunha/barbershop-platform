import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasMediaExtension, isMediaFileName } from "../domain/media-name.js";
import type { MediaStorage, StoredPhoto } from "./media-storage.js";
import { contentTypeOf } from "./media-storage.js";

/** Photos on the local disk, one folder per shop under `root`. Good for one server. */
export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly root: string) {}

  async list(shop: string): Promise<string[]> {
    const dir = this.dirOf(shop);
    await mkdir(dir, { recursive: true });
    const names = await readdir(dir);
    return names.filter((name) => isMediaFileName(name) && hasMediaExtension(name)).sort();
  }

  async putIfAbsent(shop: string, name: string, _contentType: string, data: Buffer): Promise<boolean> {
    await mkdir(this.dirOf(shop), { recursive: true });
    try {
      // "wx" fails if the file exists, so a photo is never overwritten.
      await writeFile(path.join(this.dirOf(shop), name), data, { flag: "wx" });
      return true;
    } catch (error) {
      if (isErrorCode(error, "EEXIST")) return false;
      throw error;
    }
  }

  async get(shop: string, name: string): Promise<StoredPhoto | null> {
    const contentType = contentTypeOf(name);
    if (!isMediaFileName(name) || !hasMediaExtension(name) || !contentType) return null;

    const file = path.join(this.dirOf(shop), name);
    try {
      const info = await stat(file);
      if (!info.isFile()) return null;
      return { body: createReadStream(file), contentType, size: info.size };
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) return null;
      throw error;
    }
  }

  private dirOf(shop: string): string {
    return path.join(this.root, shop);
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

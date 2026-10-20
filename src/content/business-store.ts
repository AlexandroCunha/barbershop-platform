import { constants, copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { parseBusiness, type Business } from "../domain/business.js";

/** Read-only view used by the booking rules and the public site. */
export interface BusinessProvider {
  read(): Promise<Business>;
}

/** Keeps the business profile in a JSON file the owner can also edit by hand. */
export class BusinessStore implements BusinessProvider {
  constructor(private readonly file: string) {}

  async read(): Promise<Business> {
    return parseBusiness(JSON.parse(await readFile(this.file, "utf8")));
  }

  /** Writes to a temporary file first, so a crash never leaves a half-written profile behind. */
  async write(business: Business): Promise<void> {
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, `${JSON.stringify(business, null, 2)}\n`);
    await rename(temporary, this.file);
  }
}

/**
 * Creates the profile from the template on first start. An existing profile is
 * never overwritten: COPYFILE_EXCL makes the copy fail instead.
 */
export async function ensureBusinessFile(file: string, template: string): Promise<void> {
  try {
    await copyFile(template, file, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
      throw error;
    }
  }
}

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { hasMediaExtension, isMediaFileName } from "../domain/media-name.js";
import type { MediaStorage, StoredPhoto } from "./media-storage.js";
import { contentTypeOf } from "./media-storage.js";

/** The part of the S3 client this storage uses. A test can supply a stand-in with only `send`. */
export type S3Sender = Pick<S3Client, "send">;

export interface S3Settings {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Photos in an S3-compatible bucket (Cloudflare R2, AWS S3, MinIO and others). Keys are
 * "<shop>/<file name>". Several servers can share one bucket, which is what makes scaling out possible.
 */
export class S3MediaStorage implements MediaStorage {
  constructor(
    private readonly s3: S3Sender,
    private readonly bucket: string,
  ) {}

  async list(shop: string): Promise<string[]> {
    const prefix = `${shop}/`;
    const names: string[] = [];
    let token: string | undefined;

    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const item of page.Contents ?? []) {
        const name = item.Key?.slice(prefix.length) ?? "";
        if (isMediaFileName(name) && hasMediaExtension(name)) names.push(name);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return names.sort();
  }

  async putIfAbsent(shop: string, name: string, contentType: string, data: Buffer): Promise<boolean> {
    try {
      // IfNoneMatch makes the store refuse the write when the key already exists, so two
      // servers uploading the same name cannot overwrite each other.
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: keyOf(shop, name),
          Body: data,
          ContentType: contentType,
          IfNoneMatch: "*",
        }),
      );
      return true;
    } catch (error) {
      if (hasStatus(error, 412)) return false;
      throw error;
    }
  }

  async get(shop: string, name: string): Promise<StoredPhoto | null> {
    const contentType = contentTypeOf(name);
    if (!isMediaFileName(name) || !hasMediaExtension(name) || !contentType) return null;

    try {
      const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: keyOf(shop, name) }));
      if (!response.Body) return null;
      return {
        body: response.Body as Readable,
        contentType: response.ContentType ?? contentType,
        size: response.ContentLength ?? 0,
      };
    } catch (error) {
      if (hasStatus(error, 404) || (error instanceof Error && error.name === "NoSuchKey")) return null;
      throw error;
    }
  }
}

/** Builds the storage from settings. Credentials come from the environment, never from code. */
export function createS3MediaStorage(settings: S3Settings): S3MediaStorage {
  const config: S3ClientConfig = {
    region: settings.region,
    endpoint: settings.endpoint,
    // Path-style addressing works with every S3-compatible provider.
    forcePathStyle: true,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  };
  return new S3MediaStorage(new S3Client(config), settings.bucket);
}

const keyOf = (shop: string, name: string): string => `${shop}/${name}`;

function hasStatus(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === status
  );
}

import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { LocalMediaStorage } from "../media/local-media-storage.js";
import type { MediaStorage, StoredPhoto } from "../media/media-storage.js";
import { contentTypeOf } from "../media/media-storage.js";
import { savePhoto, slugify } from "../media/photo-upload.js";
import { S3MediaStorage, type S3Sender } from "../media/s3-media-storage.js";
import { AppError } from "../utils/app-error.js";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

const workDir = await mkdtemp(path.join(tmpdir(), "barbearia-media-"));
after(() => rm(workDir, { recursive: true, force: true }));

async function readAll(photo: StoredPhoto): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of photo.body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** An in-memory MediaStorage, so upload rules can be tested without a disk or a bucket. */
class MemoryMedia implements MediaStorage {
  readonly files = new Map<string, Buffer>();

  async list(shop: string): Promise<string[]> {
    return [...this.files.keys()].filter((key) => key.startsWith(`${shop}/`)).map((key) => key.slice(shop.length + 1)).sort();
  }

  async putIfAbsent(shop: string, name: string, _contentType: string, data: Buffer): Promise<boolean> {
    if (this.files.has(`${shop}/${name}`)) return false;
    this.files.set(`${shop}/${name}`, data);
    return true;
  }

  async get(): Promise<StoredPhoto | null> {
    return null;
  }
}

test("local storage: saves a photo, refuses to overwrite it, and lists only image files", async () => {
  const storage = new LocalMediaStorage(path.join(workDir, "local"));
  assert.equal(await storage.putIfAbsent("northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), true);
  assert.equal(await storage.putIfAbsent("northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), false);

  await writeFile(path.join(workDir, "local", "northgate", "notes.txt"), "not a photo");
  assert.deepEqual(await storage.list("northgate"), ["cut.jpg"]);
  assert.deepEqual(await readdir(path.join(workDir, "local", "northgate")), ["cut.jpg", "notes.txt"]);
});

test("local storage: returns a photo with its content type and size, and nothing for unsafe names", async () => {
  const storage = new LocalMediaStorage(path.join(workDir, "serve"));
  await storage.putIfAbsent("northgate", "hero.png", "image/png", PNG_BYTES);

  const photo = await storage.get("northgate", "hero.png");
  assert.ok(photo);
  assert.equal(photo.contentType, "image/png");
  assert.equal(photo.size, PNG_BYTES.length);
  assert.deepEqual(await readAll(photo), PNG_BYTES);

  assert.equal(await storage.get("northgate", "missing.png"), null);
  assert.equal(await storage.get("northgate", "../secrets.png"), null);
  assert.equal(await storage.get("northgate", "notes.txt"), null);
});

test("photo upload: stores under a simple name, adding a counter instead of overwriting", async () => {
  const media = new MemoryMedia();
  assert.equal(await savePhoto(media, "northgate", "Hero Shot!.PNG", "image/png", PNG_BYTES), "hero-shot.png");
  assert.equal(await savePhoto(media, "northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), "cut.jpg");
  assert.equal(await savePhoto(media, "northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), "cut-2.jpg");
});

test("photo upload: photos of different shops never collide", async () => {
  const media = new MemoryMedia();
  assert.equal(await savePhoto(media, "northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), "cut.jpg");
  assert.equal(await savePhoto(media, "eastside", "cut.jpg", "image/jpeg", JPEG_BYTES), "cut.jpg");
});

test("photo upload: refuses bytes that do not match the declared type", async () => {
  const media = new MemoryMedia();
  await assert.rejects(savePhoto(media, "northgate", "fake.png", "image/png", Buffer.from("not an image")), AppError);
  await assert.rejects(savePhoto(media, "northgate", "empty.jpg", "image/jpeg", Buffer.alloc(0)), AppError);
  await assert.rejects(savePhoto(media, "northgate", "doc.pdf", "application/pdf", PNG_BYTES), AppError);
});

test("names and content types are derived safely", () => {
  assert.equal(slugify("  Barber #1 — Luca  "), "barber-1-luca");
  assert.equal(contentTypeOf("cut.JPG"), "image/jpeg");
  assert.equal(contentTypeOf("cut.svg"), undefined);
});

/** Stands in for the S3 client: keeps objects in memory and answers with the same status codes as S3. */
class FakeS3 {
  readonly objects = new Map<string, { body: Buffer; contentType?: string }>();
  pageSize = 2;

  async send(command: unknown): Promise<unknown> {
    if (command instanceof PutObjectCommand) {
      const { Key, Body, ContentType, IfNoneMatch } = command.input;
      if (IfNoneMatch === "*" && this.objects.has(Key!)) {
        throw httpError("PreconditionFailed", 412);
      }
      this.objects.set(Key!, { body: Buffer.from(Body as Buffer), contentType: ContentType });
      return {};
    }

    if (command instanceof GetObjectCommand) {
      const object = this.objects.get(command.input.Key!);
      if (!object) throw httpError("NoSuchKey", 404);
      return { Body: Readable.from([object.body]), ContentType: object.contentType, ContentLength: object.body.length };
    }

    if (command instanceof ListObjectsV2Command) {
      const { Prefix = "", ContinuationToken } = command.input;
      const keys = [...this.objects.keys()].filter((key) => key.startsWith(Prefix)).sort();
      const start = ContinuationToken ? Number(ContinuationToken) : 0;
      const page = keys.slice(start, start + this.pageSize);
      const next = start + this.pageSize;
      const truncated = next < keys.length;
      return {
        Contents: page.map((Key) => ({ Key })),
        IsTruncated: truncated,
        NextContinuationToken: truncated ? String(next) : undefined,
      };
    }

    throw new Error(`unexpected command: ${String(command)}`);
  }
}

function httpError(name: string, status: number): Error {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });
}

test("S3 storage: writes with a conditional put, so an existing photo is never overwritten", async () => {
  const fake = new FakeS3();
  const storage = new S3MediaStorage(fake as unknown as S3Sender, "photos");

  assert.equal(await storage.putIfAbsent("northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), true);
  assert.equal(await storage.putIfAbsent("northgate", "cut.jpg", "image/jpeg", JPEG_BYTES), false);
  assert.ok(fake.objects.has("northgate/cut.jpg"));
});

test("S3 storage: lists every page of a shop's photos and leaves other shops out", async () => {
  const fake = new FakeS3();
  const storage = new S3MediaStorage(fake as unknown as S3Sender, "photos");
  for (const name of ["c.jpg", "a.png", "b.webp"]) {
    await storage.putIfAbsent("northgate", name, "image/jpeg", JPEG_BYTES);
  }
  await storage.putIfAbsent("eastside", "z.jpg", "image/jpeg", JPEG_BYTES);

  assert.deepEqual(await storage.list("northgate"), ["a.png", "b.webp", "c.jpg"]);
});

test("S3 storage: reads a photo back with its type, and reports a missing one as null", async () => {
  const fake = new FakeS3();
  const storage = new S3MediaStorage(fake as unknown as S3Sender, "photos");
  await storage.putIfAbsent("northgate", "hero.png", "image/png", PNG_BYTES);

  const photo = await storage.get("northgate", "hero.png");
  assert.ok(photo);
  assert.equal(photo.contentType, "image/png");
  assert.deepEqual(await readAll(photo), PNG_BYTES);
  assert.equal(await storage.get("northgate", "missing.png"), null);
});

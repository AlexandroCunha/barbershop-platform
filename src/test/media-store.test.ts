import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { MediaStore } from "../media/media-store.js";
import { hasMediaExtension, isMediaFileName, mediaUrl } from "../domain/media-name.js";
import { AppError } from "../utils/app-error.js";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

const workDir = await mkdtemp(path.join(tmpdir(), "barbearia-media-"));
after(() => rm(workDir, { recursive: true, force: true }));

test("saves a photo under a simple, lowercase name", async () => {
  const store = new MediaStore(path.join(workDir, "simple"));
  const name = await store.save("Hero Shot!.PNG", "image/png", PNG_BYTES);
  assert.equal(name, "hero-shot.png");
});

test("adds a counter instead of overwriting a photo with the same name", async () => {
  const store = new MediaStore(path.join(workDir, "counter"));
  const first = await store.save("cut.jpg", "image/jpeg", JPEG_BYTES);
  const second = await store.save("cut.jpg", "image/jpeg", JPEG_BYTES);
  assert.equal(first, "cut.jpg");
  assert.equal(second, "cut-2.jpg");
  assert.deepEqual(await readdir(path.join(workDir, "counter")), ["cut-2.jpg", "cut.jpg"]);
});

test("refuses bytes that do not match the declared image type", async () => {
  const store = new MediaStore(path.join(workDir, "bad"));
  await assert.rejects(store.save("fake.png", "image/png", Buffer.from("not an image")), AppError);
  await assert.rejects(store.save("empty.jpg", "image/jpeg", Buffer.alloc(0)), AppError);
});

test("lists only image files with safe names", async () => {
  const dir = path.join(workDir, "listing");
  const store = new MediaStore(dir);
  await store.list();
  await writeFile(path.join(dir, "barber-one.webp"), Buffer.from("RIFF0000WEBP"));
  await writeFile(path.join(dir, "notes.txt"), "not a photo");
  await writeFile(path.join(dir, "README.md"), "instructions");
  assert.deepEqual(await store.list(), ["barber-one.webp"]);
});

test("file names are checked before they reach the database or the URL", () => {
  assert.equal(isMediaFileName("hero-shot.jpg"), true);
  assert.equal(isMediaFileName("My Photo (2).jpg"), true);
  assert.equal(isMediaFileName("../secrets.jpg"), false);
  assert.equal(isMediaFileName("a/b.jpg"), false);
  assert.equal(hasMediaExtension("cut.JPG"), true);
  assert.equal(hasMediaExtension("cut.svg"), false);
  assert.equal(mediaUrl("My Photo.jpg"), "/media/My%20Photo.jpg");
});

import path from "node:path";

/** Paths are relative to the project root, where the server is started from. */
export const CONTENT_FILE = path.resolve("content/business.json");
export const CONTENT_TEMPLATE = path.resolve("content/business.example.json");
export const MEDIA_DIR = path.resolve("media");
/** Built by Vite into dist-client/. Run `npm run build` before `npm start`. */
export const CLIENT_DIR = path.resolve("dist-client");

import path from "node:path";

/** Paths are relative to the project root, where the server is started from. */
export const MEDIA_DIR = path.resolve("media");
/** Built by Vite into dist-client/. Run `npm run build` before `npm start`. */
export const CLIENT_DIR = path.resolve("dist-client");

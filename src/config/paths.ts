import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The project root, found from where this file lives (src/config or dist/config), so every
 * path works whatever folder the server or a script is started from.
 */
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Photos kept on local disk when MEDIA_STORAGE is "local". */
export const MEDIA_DIR = path.join(PROJECT_ROOT, "media");
/** Built by Vite into dist-client/. Run `npm run build` before `npm start`. */
export const CLIENT_DIR = path.join(PROJECT_ROOT, "dist-client");
/** SQL migrations, applied in name order by `npm run db:migrate`. */
export const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "db", "migrations");

import type { DbPool } from "../db/pool.js";
import { AppError } from "../utils/app-error.js";
import type { DeveloperAccount, DeveloperRepository } from "./types.js";

interface DeveloperRow {
  id: number;
  email: string;
  password_hash: string;
}

const UNIQUE_VIOLATION = "23505";

const toDeveloper = (row: DeveloperRow): DeveloperAccount => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
});

export class PgDeveloperRepository implements DeveloperRepository {
  constructor(private readonly db: DbPool) {}

  async findByEmail(email: string): Promise<DeveloperAccount | null> {
    const { rows } = await this.db.query<DeveloperRow>(
      `SELECT id, email, password_hash FROM developers WHERE email = $1`,
      [email],
    );
    return rows[0] ? toDeveloper(rows[0]) : null;
  }

  async create(email: string, passwordHash: string): Promise<DeveloperAccount> {
    try {
      const { rows } = await this.db.query<DeveloperRow>(
        `INSERT INTO developers (email, password_hash) VALUES ($1, $2) RETURNING id, email, password_hash`,
        [email, passwordHash],
      );
      return toDeveloper(rows[0]!);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === UNIQUE_VIOLATION) {
        throw new AppError(409, "A developer with this email already exists");
      }
      throw error;
    }
  }
}

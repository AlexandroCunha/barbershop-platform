import pg from "pg";

const { Pool } = pg;

export type DbPool = InstanceType<typeof Pool>;

export function createPool(connectionString: string): DbPool {
  return new Pool({ connectionString });
}

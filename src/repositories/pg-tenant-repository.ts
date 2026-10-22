import type { DbPool } from "../db/pool.js";
import { parseBusiness, type Business } from "../domain/business.js";
import type { LicenseStatus, Tenant } from "../domain/tenant.js";
import { AppError } from "../utils/app-error.js";
import type { LicenseUpdate, NewTenant, TenantRepository } from "./types.js";

interface TenantRow {
  id: number;
  slug: string;
  name: string;
  business: unknown;
  license_status: LicenseStatus;
  trial_ends_at: Date | null;
  paid_until: Date | null;
}

const COLUMNS = "id, slug, name, business, license_status, trial_ends_at, paid_until";
const UNIQUE_VIOLATION = "23505";

const toTenant = (row: TenantRow): Tenant => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  business: parseBusiness(row.business),
  licenseStatus: row.license_status,
  trialEndsAt: row.trial_ends_at,
  paidUntil: row.paid_until,
});

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION;
}

export class PgTenantRepository implements TenantRepository {
  constructor(private readonly db: DbPool) {}

  async findBySlug(slug: string): Promise<Tenant | null> {
    const { rows } = await this.db.query<TenantRow>(`SELECT ${COLUMNS} FROM tenants WHERE slug = $1`, [slug]);
    return rows[0] ? toTenant(rows[0]) : null;
  }

  async findById(id: number): Promise<Tenant | null> {
    const { rows } = await this.db.query<TenantRow>(`SELECT ${COLUMNS} FROM tenants WHERE id = $1`, [id]);
    return rows[0] ? toTenant(rows[0]) : null;
  }

  async listAll(): Promise<Tenant[]> {
    const { rows } = await this.db.query<TenantRow>(`SELECT ${COLUMNS} FROM tenants ORDER BY id`);
    return rows.map(toTenant);
  }

  async findFirstSlug(): Promise<string | null> {
    const { rows } = await this.db.query<{ slug: string }>(`SELECT slug FROM tenants ORDER BY id LIMIT 1`);
    return rows[0]?.slug ?? null;
  }

  async create(input: NewTenant): Promise<Tenant> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query<TenantRow>(
        `INSERT INTO tenants (slug, name, business, license_status, trial_ends_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [input.slug, input.name, JSON.stringify(input.business), input.licenseStatus, input.trialEndsAt],
      );
      const tenant = rows[0]!;

      await client.query(
        "INSERT INTO tenant_owners (tenant_id, email, password_hash) VALUES ($1, $2, $3)",
        [tenant.id, input.ownerEmail, input.ownerPasswordHash],
      );

      for (const service of input.services) {
        await client.query(
          `INSERT INTO services (tenant_id, name, description, price_cents, duration_minutes)
           VALUES ($1, $2, $3, $4, $5)`,
          [tenant.id, service.name, service.description, service.priceCents, service.durationMinutes],
        );
      }

      for (const person of input.professionals) {
        await client.query(
          "INSERT INTO professionals (tenant_id, name, specialties, bio) VALUES ($1, $2, $3, $4)",
          [tenant.id, person.name, person.specialties, person.bio],
        );
      }

      await client.query("COMMIT");
      return toTenant(tenant);
    } catch (error) {
      await client.query("ROLLBACK");
      if (isUniqueViolation(error)) {
        throw new AppError(409, "That address or owner email is already in use");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async lastAddressChange(id: number): Promise<Date | null> {
    const { rows } = await this.db.query<{ address_changed_at: Date | null }>(
      `SELECT address_changed_at FROM tenants WHERE id = $1`,
      [id],
    );
    return rows[0]?.address_changed_at ?? null;
  }

  async addressInUse(slug: string): Promise<boolean> {
    const { rows } = await this.db.query<{ taken: boolean }>(
      `SELECT (EXISTS (SELECT 1 FROM tenants WHERE slug = $1)
            OR EXISTS (SELECT 1 FROM shop_address_history WHERE old_slug = $1)) AS taken`,
      [slug],
    );
    return rows[0]?.taken ?? false;
  }

  async findRedirect(oldSlug: string): Promise<string | null> {
    const { rows } = await this.db.query<{ slug: string }>(
      `SELECT t.slug FROM shop_address_history h JOIN tenants t ON t.id = h.tenant_id WHERE h.old_slug = $1`,
      [oldSlug],
    );
    return rows[0]?.slug ?? null;
  }

  async changeSlug(id: number, oldSlug: string, newSlug: string, now: Date): Promise<Tenant> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO shop_address_history (old_slug, tenant_id, changed_at) VALUES ($1, $2, $3)`,
        [oldSlug, id, now],
      );
      const { rows } = await client.query<TenantRow>(
        `UPDATE tenants SET slug = $2, address_changed_at = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, newSlug, now],
      );
      await client.query("COMMIT");
      return toTenant(rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      if (isUniqueViolation(error)) {
        throw new AppError(409, "That address is already taken. Choose another.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBusiness(id: number, business: Business): Promise<void> {
    await this.db.query("UPDATE tenants SET business = $2 WHERE id = $1", [id, JSON.stringify(business)]);
  }

  async updateLicense(id: number, update: LicenseUpdate): Promise<Tenant | null> {
    const { rows } = await this.db.query<TenantRow>(
      `UPDATE tenants SET license_status = $2, trial_ends_at = $3, paid_until = $4
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, update.licenseStatus, update.trialEndsAt, update.paidUntil],
    );
    return rows[0] ? toTenant(rows[0]) : null;
  }
}

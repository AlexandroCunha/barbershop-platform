-- Multi-tenant schema. Every barbershop (tenant) owns its own services, barbers,
-- bookings and owner accounts. Rows are always read and written with tenant_id.

CREATE TABLE IF NOT EXISTS tenants (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  business       JSONB NOT NULL,
  license_status TEXT NOT NULL DEFAULT 'trial' CHECK (license_status IN ('trial', 'active', 'suspended')),
  trial_ends_at  TIMESTAMPTZ,
  paid_until     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_owners (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS services (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS professionals (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  bio         TEXT NOT NULL DEFAULT '',
  photo       TEXT,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  service_id      INTEGER NOT NULL REFERENCES services (id),
  professional_id INTEGER NOT NULL REFERENCES professionals (id),
  booking_date    DATE NOT NULL,
  start_minute    SMALLINT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute      SMALLINT NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, booking_date, start_minute)
);

CREATE INDEX IF NOT EXISTS bookings_tenant_date_idx ON bookings (tenant_id, booking_date);

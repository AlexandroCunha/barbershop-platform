-- Barber logins. Each barber can have one login for their own shop. It opens a separate
-- area that shows only their upcoming bookings, and it never reaches owner or developer areas.

CREATE TABLE IF NOT EXISTS barber_accounts (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  professional_id INTEGER NOT NULL UNIQUE REFERENCES professionals (id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS barber_account_id INTEGER REFERENCES barber_accounts (id) ON DELETE CASCADE;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_kind_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_kind_check CHECK (
  (kind = 'owner' AND owner_id IS NOT NULL AND tenant_id IS NOT NULL AND developer_id IS NULL AND barber_account_id IS NULL)
  OR
  (kind = 'platform' AND developer_id IS NOT NULL AND owner_id IS NULL AND tenant_id IS NULL AND barber_account_id IS NULL)
  OR
  (kind = 'barber' AND barber_account_id IS NOT NULL AND tenant_id IS NOT NULL AND owner_id IS NULL AND developer_id IS NULL)
);

CREATE INDEX IF NOT EXISTS sessions_barber_idx ON sessions (barber_account_id);

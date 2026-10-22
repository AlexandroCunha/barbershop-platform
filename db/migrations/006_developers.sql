-- Developer accounts for the platform area. Each developer signs in with an email and a
-- password, replacing the shared platform token. Passwords are stored as hashes only.

CREATE TABLE IF NOT EXISTS developers (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform sessions from the shared token have no developer behind them, so they are ended.
DELETE FROM sessions WHERE kind = 'platform';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS developer_id INTEGER REFERENCES developers (id) ON DELETE CASCADE;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_check;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_kind_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_kind_check CHECK (
  (kind = 'owner' AND owner_id IS NOT NULL AND tenant_id IS NOT NULL AND developer_id IS NULL)
  OR
  (kind = 'platform' AND developer_id IS NOT NULL AND owner_id IS NULL AND tenant_id IS NULL)
);

CREATE INDEX IF NOT EXISTS sessions_developer_idx ON sessions (developer_id);

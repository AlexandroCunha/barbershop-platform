-- Server-side session records. A session token is honoured only while its record
-- exists, is not revoked and has not expired, so signing out ends it at once.

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('owner', 'platform')),
  tenant_id  INTEGER REFERENCES tenants (id) ON DELETE CASCADE,
  owner_id   INTEGER REFERENCES tenant_owners (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  -- Owner sessions name their owner and shop; platform sessions name neither.
  CHECK ((kind = 'owner') = (owner_id IS NOT NULL AND tenant_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS sessions_owner_idx ON sessions (owner_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

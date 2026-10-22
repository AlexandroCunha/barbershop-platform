-- Bookings can be cancelled or moved. A cancelled booking keeps its row for the records, but its
-- time is free again, so the overlap and uniqueness rules only apply to bookings that are still on.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_professional_id_booking_date_start_minute_key;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    booking_date WITH =,
    int4range(start_minute, end_minute) WITH &&
  ) WHERE (cancelled_at IS NULL);

-- A password reset link. Only a hash of the token is stored, and the link works once.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash        TEXT PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  owner_id          INTEGER REFERENCES tenant_owners (id) ON DELETE CASCADE,
  barber_account_id INTEGER REFERENCES barber_accounts (id) ON DELETE CASCADE,
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,
  CHECK ((owner_id IS NULL) <> (barber_account_id IS NULL))
);
CREATE INDEX IF NOT EXISTS password_resets_expires_idx ON password_resets (expires_at);

-- E-mails waiting to be sent. Each row is written in the same transaction as the change it reports,
-- so a message is never lost and never sent for a change that did not happen.
CREATE TABLE IF NOT EXISTS notifications (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  booking_id   UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('confirmation', 'reminder', 'cancellation', 'moved')),
  to_address   TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  send_at      TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ,
  attempts     INTEGER NOT NULL DEFAULT 0,
  retry_at     TIMESTAMPTZ
);

-- One confirmation, one reminder and one cancellation per booking. Moves can happen more than once.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_once_per_booking_idx
  ON notifications (booking_id, kind) WHERE kind IN ('confirmation', 'reminder', 'cancellation');
CREATE INDEX IF NOT EXISTS notifications_due_idx ON notifications (send_at) WHERE sent_at IS NULL AND failed_at IS NULL;

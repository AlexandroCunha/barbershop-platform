-- Owners remove services and barbers by archiving them. Past bookings keep pointing at them.
ALTER TABLE services ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

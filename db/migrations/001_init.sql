-- Initial schema. The starting rows are neutral placeholders: rename them and
-- set real prices and photos from the /admin area.

CREATE TABLE IF NOT EXISTS services (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  description      TEXT NOT NULL DEFAULT '',
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0)
);

CREATE TABLE IF NOT EXISTS professionals (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  bio         TEXT NOT NULL DEFAULT '',
  photo       TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      INTEGER NOT NULL REFERENCES services (id),
  professional_id INTEGER NOT NULL REFERENCES professionals (id),
  booking_date    DATE NOT NULL,
  start_minute    SMALLINT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute      SMALLINT NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, booking_date, start_minute)
);

INSERT INTO services (name, description, price_cents, duration_minutes) VALUES
  ('Haircut',            '', 2500, 30),
  ('Skin fade',          '', 3000, 45),
  ('Beard trim',         '', 1500, 20),
  ('Haircut and beard',  '', 3800, 50)
ON CONFLICT (name) DO NOTHING;

INSERT INTO professionals (name, specialties, bio) VALUES
  ('Barber 1', ARRAY[]::TEXT[], ''),
  ('Barber 2', ARRAY[]::TEXT[], '')
ON CONFLICT (name) DO NOTHING;

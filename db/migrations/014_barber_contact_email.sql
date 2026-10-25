-- The address where a barber hears about each new booking. Kept apart from the barber's login, and empty when none is set.
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';

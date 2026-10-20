-- Mobile phone for the customer, so the shop can reach them about a booking.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';

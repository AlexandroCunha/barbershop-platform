-- A barber can never have two bookings that overlap in time, even when two requests
-- race each other. The database enforces it, not only the application.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    booking_date WITH =,
    int4range(start_minute, end_minute) WITH &&
  );

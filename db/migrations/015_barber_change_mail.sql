-- A barber is also told when a booking in their chair is cancelled or moved.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('confirmation', 'reminder', 'cancellation', 'moved', 'barber-booking', 'barber-cancellation', 'barber-moved'));

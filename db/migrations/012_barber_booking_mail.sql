-- A new kind of e-mail: a barber is told about each booking in their chair.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('confirmation', 'reminder', 'cancellation', 'moved', 'barber-booking'));

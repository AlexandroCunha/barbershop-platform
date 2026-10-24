-- The HTML version of each e-mail, stored until it is sent and then cleared with the rest of the message.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS html TEXT NOT NULL DEFAULT '';

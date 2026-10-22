-- A barber's own working hours. A barber with no rows here follows the shop's opening hours.
-- Every weekday has a row once the hours are set; open_minute and close_minute are both null on a day off.
-- weekday uses the same numbering as the server's DAYS list: 0 = Sunday.

CREATE TABLE IF NOT EXISTS barber_hours (
  professional_id INTEGER NOT NULL REFERENCES professionals (id) ON DELETE CASCADE,
  weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_minute     SMALLINT,
  close_minute    SMALLINT,
  PRIMARY KEY (professional_id, weekday),
  CHECK (
    (open_minute IS NULL AND close_minute IS NULL)
    OR (open_minute >= 0 AND close_minute > open_minute AND close_minute <= 1440)
  )
);

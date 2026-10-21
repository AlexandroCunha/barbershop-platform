-- Request counters for rate limits, shared by every instance of the app. Each row is one
-- client's fixed window for one limit (for example "sign-in" or "booking").

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket   TEXT NOT NULL,
  client   TEXT NOT NULL,
  count    INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket, client)
);

CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);

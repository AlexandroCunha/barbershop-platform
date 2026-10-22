-- The developer area is removed from the application. Shops are created and licensed from the
-- command line instead (npm run shop), so no developer accounts or platform sessions are kept.

DELETE FROM sessions WHERE kind = 'platform';

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_kind_check;
ALTER TABLE sessions DROP COLUMN IF EXISTS developer_id;
ALTER TABLE sessions ADD CONSTRAINT sessions_kind_check CHECK (
  (kind = 'owner' AND owner_id IS NOT NULL AND tenant_id IS NOT NULL AND barber_account_id IS NULL)
  OR
  (kind = 'barber' AND barber_account_id IS NOT NULL AND tenant_id IS NOT NULL AND owner_id IS NULL)
);

DROP TABLE IF EXISTS developers;

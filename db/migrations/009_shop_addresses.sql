-- Shop addresses can change. The old address is kept here and redirects to the current one, so
-- links that were already shared keep working. The last change is recorded to limit how often it
-- can happen.

CREATE TABLE IF NOT EXISTS shop_address_history (
  old_slug   TEXT PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_address_history_tenant_idx ON shop_address_history (tenant_id);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_changed_at TIMESTAMPTZ;

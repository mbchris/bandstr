ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "default_band_id" integer REFERENCES "bands"("id") ON DELETE SET NULL;

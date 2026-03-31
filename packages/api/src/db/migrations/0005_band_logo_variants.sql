ALTER TABLE "bands"
  ADD COLUMN IF NOT EXISTS "logo_dark" text,
  ADD COLUMN IF NOT EXISTS "logo_bright" text;

UPDATE "bands"
SET
  "logo_dark" = COALESCE("logo_dark", "logo"),
  "logo_bright" = COALESCE("logo_bright", "logo")
WHERE "logo" IS NOT NULL;

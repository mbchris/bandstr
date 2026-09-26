ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;

ALTER TABLE "songs" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;

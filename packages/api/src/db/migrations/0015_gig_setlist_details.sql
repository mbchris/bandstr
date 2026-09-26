ALTER TABLE "gig_setlists" ADD COLUMN IF NOT EXISTS "location" text;
ALTER TABLE "gig_setlists" ADD COLUMN IF NOT EXISTS "gig_date" text;
ALTER TABLE "gig_setlists" ADD COLUMN IF NOT EXISTS "gig_time" text;
ALTER TABLE "gig_setlists" ADD COLUMN IF NOT EXISTS "notes" text;

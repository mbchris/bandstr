-- Scale existing votes from 0..3 to 0..9 (0->0, 1->3, 2->6, 3->9)
UPDATE "votes" SET "score" = "score" * 3 WHERE "score" BETWEEN 1 AND 3;
--> statement-breakpoint
ALTER TABLE "bands"
  ADD COLUMN IF NOT EXISTS "default_rehearsal_start_time" text DEFAULT '20:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "default_rehearsal_end_time" text DEFAULT '23:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "default_gig_start_time" text DEFAULT '20:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "default_gig_end_time" text DEFAULT '23:00' NOT NULL;

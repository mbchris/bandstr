ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "gig_setlist_id" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_gig_setlist_id_gig_setlists_id_fk'
  ) THEN
    ALTER TABLE "calendar_events"
      ADD CONSTRAINT "calendar_events_gig_setlist_id_gig_setlists_id_fk"
      FOREIGN KEY ("gig_setlist_id") REFERENCES "public"."gig_setlists"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_gig_setlist_idx" ON "calendar_events" USING btree ("gig_setlist_id");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gig_setlists' AND column_name = 'calendar_event_id'
  ) THEN
    UPDATE "calendar_events" ce
    SET "gig_setlist_id" = gs."id"
    FROM "gig_setlists" gs
    WHERE gs."calendar_event_id" = ce."id"
      AND ce."type" = 'gig'
      AND ce."gig_setlist_id" IS NULL;
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "gig_setlists_band_calendar_event_idx";
--> statement-breakpoint
ALTER TABLE "gig_setlists" DROP CONSTRAINT IF EXISTS "gig_setlists_calendar_event_id_calendar_events_id_fk";
--> statement-breakpoint
ALTER TABLE "gig_setlists" DROP COLUMN IF EXISTS "calendar_event_id";

UPDATE "gig_setlists"
SET "calendar_event_id" = NULL
WHERE "calendar_event_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "calendar_events" ce
    WHERE ce."id" = "gig_setlists"."calendar_event_id"
      AND ce."band_id" = "gig_setlists"."band_id"
      AND ce."type" = 'gig'
  );
--> statement-breakpoint
INSERT INTO "gig_setlists" ("band_id", "title", "calendar_event_id", "gig_date", "gig_time", "notes", "created_at")
SELECT
  ce."band_id",
  ce."title",
  ce."id",
  to_char(ce."start_time", 'YYYY-MM-DD'),
  to_char(ce."start_time", 'HH24:MI'),
  ce."description",
  ce."created_at"
FROM "calendar_events" ce
LEFT JOIN "gig_setlists" gs ON ce."id" = gs."calendar_event_id"
WHERE ce."type" = 'gig' AND gs."id" IS NULL;

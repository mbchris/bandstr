CREATE TABLE "gig_setlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_id" integer NOT NULL,
	"title" text NOT NULL,
	"calendar_event_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gig_setlists" ADD CONSTRAINT "gig_setlists_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_setlists" ADD CONSTRAINT "gig_setlists_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gig_setlists_band_idx" ON "gig_setlists" USING btree ("band_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gig_setlists_band_calendar_event_idx" ON "gig_setlists" USING btree ("band_id","calendar_event_id");--> statement-breakpoint

INSERT INTO "gig_setlists" ("id", "band_id", "title", "calendar_event_id")
SELECT ce."id", ce."band_id", COALESCE(NULLIF(TRIM(ce."title"), ''), CONCAT('Gig Setlist #', ce."id"::text)), ce."id"
FROM "calendar_events" ce
WHERE ce."type" = 'gig'
   OR EXISTS (
     SELECT 1
     FROM "gig_songs" gs
     WHERE gs."gig_id" = ce."id"
   );
--> statement-breakpoint

SELECT setval(
  pg_get_serial_sequence('gig_setlists', 'id'),
  COALESCE((SELECT MAX("id") FROM "gig_setlists"), 1),
  true
);
--> statement-breakpoint

ALTER TABLE "gig_songs" DROP CONSTRAINT IF EXISTS "gig_songs_gig_id_calendar_events_id_fk";--> statement-breakpoint
ALTER TABLE "gig_songs" ADD CONSTRAINT "gig_songs_gig_id_gig_setlists_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gig_setlists"("id") ON DELETE cascade ON UPDATE no action;

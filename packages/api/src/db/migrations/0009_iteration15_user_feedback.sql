CREATE TABLE "rehearsal_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_id" integer NOT NULL,
	"rehearsal_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_setlist_songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"song_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rehearsal_attendance" ADD CONSTRAINT "rehearsal_attendance_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal_attendance" ADD CONSTRAINT "rehearsal_attendance_rehearsal_id_calendar_events_id_fk" FOREIGN KEY ("rehearsal_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal_attendance" ADD CONSTRAINT "rehearsal_attendance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setlist_songs" ADD CONSTRAINT "user_setlist_songs_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setlist_songs" ADD CONSTRAINT "user_setlist_songs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setlist_songs" ADD CONSTRAINT "user_setlist_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rehearsal_attendance_band_rehearsal_user_idx" ON "rehearsal_attendance" USING btree ("band_id","rehearsal_id","user_id");--> statement-breakpoint
CREATE INDEX "rehearsal_attendance_band_rehearsal_idx" ON "rehearsal_attendance" USING btree ("band_id","rehearsal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_setlist_songs_band_user_song_idx" ON "user_setlist_songs" USING btree ("band_id","user_id","song_id");--> statement-breakpoint
CREATE INDEX "user_setlist_songs_band_user_position_idx" ON "user_setlist_songs" USING btree ("band_id","user_id","position");

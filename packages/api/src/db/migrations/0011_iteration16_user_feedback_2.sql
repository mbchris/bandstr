CREATE TABLE "rehearsal_time_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "band_id" integer NOT NULL,
  "rehearsal_id" integer NOT NULL,
  "proposer_user_id" text NOT NULL,
  "proposed_start_time" timestamp NOT NULL,
  "proposed_end_time" timestamp NOT NULL,
  "comment" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "decided_by_user_id" text,
  "decision_comment" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rehearsal_time_proposals" ADD CONSTRAINT "rehearsal_time_proposals_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rehearsal_time_proposals" ADD CONSTRAINT "rehearsal_time_proposals_rehearsal_id_calendar_events_id_fk" FOREIGN KEY ("rehearsal_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rehearsal_time_proposals" ADD CONSTRAINT "rehearsal_time_proposals_proposer_user_id_user_id_fk" FOREIGN KEY ("proposer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rehearsal_time_proposals" ADD CONSTRAINT "rehearsal_time_proposals_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "rehearsal_time_proposals_band_rehearsal_idx" ON "rehearsal_time_proposals" USING btree ("band_id","rehearsal_id","created_at");
--> statement-breakpoint
CREATE INDEX "rehearsal_time_proposals_rehearsal_status_idx" ON "rehearsal_time_proposals" USING btree ("rehearsal_id","status");

CREATE TABLE "user_notification_settings" (
  "user_id" text PRIMARY KEY NOT NULL,
  "notify_absence" boolean DEFAULT true NOT NULL,
  "notify_gig" boolean DEFAULT true NOT NULL,
  "notify_rehearsal" boolean DEFAULT true NOT NULL,
  "notify_song_suggestion" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "pending_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "band_id" integer NOT NULL,
  "event_type" text NOT NULL,
  "entity_key" text NOT NULL,
  "actor_user_id" text,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "link_path" text NOT NULL,
  "link_query" text,
  "due_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_notifications_band_event_entity_idx" ON "pending_notifications" USING btree ("band_id","event_type","entity_key");
--> statement-breakpoint
CREATE INDEX "pending_notifications_band_due_idx" ON "pending_notifications" USING btree ("band_id","due_at");

CREATE TABLE "user_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "band_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "link_path" text NOT NULL,
  "link_query" text,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "read_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_notifications_user_band_created_idx" ON "user_notifications" USING btree ("user_id","band_id","created_at");
--> statement-breakpoint
CREATE INDEX "user_notifications_user_band_read_idx" ON "user_notifications" USING btree ("user_id","band_id","is_read");

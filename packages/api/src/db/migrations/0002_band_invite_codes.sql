CREATE TABLE "band_invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_id" integer NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"used_by" text,
	"invalidated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp,
	"invalidated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "band_invite_codes" ADD CONSTRAINT "band_invite_codes_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "band_invite_codes" ADD CONSTRAINT "band_invite_codes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "band_invite_codes" ADD CONSTRAINT "band_invite_codes_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "band_invite_codes" ADD CONSTRAINT "band_invite_codes_invalidated_by_user_id_fk" FOREIGN KEY ("invalidated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "band_invite_codes_code_idx" ON "band_invite_codes" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "band_invite_codes_band_idx" ON "band_invite_codes" USING btree ("band_id","created_at");

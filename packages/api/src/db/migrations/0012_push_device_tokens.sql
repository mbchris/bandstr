CREATE TABLE "user_push_devices" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "token_type" text NOT NULL,
  "token" text NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_push_devices_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "user_push_devices" ADD CONSTRAINT "user_push_devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_push_devices_user_idx" ON "user_push_devices" USING btree ("user_id","is_enabled");
--> statement-breakpoint
CREATE INDEX "user_push_devices_token_type_idx" ON "user_push_devices" USING btree ("token_type","is_enabled");

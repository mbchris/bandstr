ALTER TABLE "bands"
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS "subscription_interval" text,
  ADD COLUMN IF NOT EXISTS "subscription_current_period_end" timestamp,
  ADD COLUMN IF NOT EXISTS "subscription_cancel_at_period_end" boolean DEFAULT false NOT NULL;

UPDATE "bands"
SET "plan" = 'pro'
WHERE "plan" = 'band';

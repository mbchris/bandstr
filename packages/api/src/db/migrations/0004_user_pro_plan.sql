ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "dev_pro_plan" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "dev_pro_plan_assigned_at" timestamp;

import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { db, pool } from './index.js'

const MIGRATIONS_FOLDER = fileURLToPath(new URL('./migrations', import.meta.url))

type JournalEntry = {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

type MigrationJournal = {
  version: string
  dialect: string
  entries: JournalEntry[]
}

async function publicTableExists(tableName: string) {
  const result = await pool.query<{ table_ref: string | null }>(
    `select to_regclass($1)::text as table_ref`,
    [`public.${tableName}`],
  )
  return Boolean(result.rows[0]?.table_ref)
}

async function baselineLegacySchemaIfNeeded() {
  const trackingTableResult = await pool.query<{ table_ref: string | null }>(`
    select to_regclass('drizzle.__drizzle_migrations')::text as table_ref
  `)
  const hasTrackingTable = Boolean(trackingTableResult.rows[0]?.table_ref)
  const trackingRowCount = hasTrackingTable
    ? Number((await pool.query<{ count: string }>(`select count(*)::text as count from drizzle.__drizzle_migrations`)).rows[0]?.count ?? '0')
    : 0
  if (hasTrackingTable && trackingRowCount > 0) return

  const appTableCountResult = await pool.query<{ count: string }>(`
    select count(*)::text as count
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name <> '__drizzle_migrations'
  `)
  const appTableCount = Number(appTableCountResult.rows[0]?.count ?? '0')
  if (appTableCount === 0) return

  const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url)
  const journalRaw = await readFile(journalPath, 'utf8')
  const journal = JSON.parse(journalRaw) as MigrationJournal
  const initialMigration = journal.entries[0]
  if (!initialMigration) return

  const initialMigrationPath = new URL(`./migrations/${initialMigration.tag}.sql`, import.meta.url)
  const initialMigrationSql = await readFile(initialMigrationPath, 'utf8')
  const initialMigrationHash = createHash('sha256').update(initialMigrationSql).digest('hex')

  await pool.query(`
    create schema if not exists drizzle;
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    );
  `)

  await pool.query(
    `
      insert into drizzle.__drizzle_migrations (hash, created_at)
      select $1, $2
      where not exists (
        select 1
        from drizzle.__drizzle_migrations
        where created_at = $2
      )
    `,
    [initialMigrationHash, initialMigration.when],
  )

  console.log(
    `Detected legacy schema without Drizzle tracking; baselined ${initialMigration.tag} and continuing with pending migrations.`,
  )
}

async function ensureBandsMonetizationColumns() {
  if (!(await publicTableExists('bands'))) return

  await pool.query(`
    ALTER TABLE "bands"
      ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
      ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'none' NOT NULL,
      ADD COLUMN IF NOT EXISTS "subscription_interval" text,
      ADD COLUMN IF NOT EXISTS "subscription_current_period_end" timestamp,
      ADD COLUMN IF NOT EXISTS "subscription_cancel_at_period_end" boolean DEFAULT false NOT NULL;
  `)

  await pool.query(`
    UPDATE "bands"
    SET "plan" = 'pro'
    WHERE "plan" = 'band';
  `)
}

async function ensureUserProPlanColumns() {
  if (!(await publicTableExists('user'))) return

  await pool.query(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "dev_pro_plan" boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS "dev_pro_plan_assigned_at" timestamp;
  `)
}

async function ensureBandLogoVariantColumns() {
  if (!(await publicTableExists('bands'))) return

  await pool.query(`
    ALTER TABLE "bands"
      ADD COLUMN IF NOT EXISTS "logo_dark" text,
      ADD COLUMN IF NOT EXISTS "logo_bright" text;
  `)
}

async function ensureUserSubscriptionColumns() {
  if (!(await publicTableExists('user'))) return

  await pool.query(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
      ADD COLUMN IF NOT EXISTS "subscription_plan" text NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS "subscription_status" text NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "subscription_interval" text,
      ADD COLUMN IF NOT EXISTS "subscription_current_period_end" timestamp,
      ADD COLUMN IF NOT EXISTS "subscription_cancel_at_period_end" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "subscription_provider" text NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "subscription_provider_ref" text;
  `)
}

async function ensureSubscriptionProviderColumns() {
  if (!(await publicTableExists('bands'))) return

  await pool.query(`
    ALTER TABLE "bands"
      ADD COLUMN IF NOT EXISTS "subscription_provider" text NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "subscription_provider_ref" text;
  `)

  // Backfill provider from existing stripe_subscription_id values (handle the gplay:/apple: prefix hack)
  await pool.query(`
    UPDATE "bands"
    SET
      "subscription_provider" = CASE
        WHEN "stripe_subscription_id" LIKE 'gplay:%'  THEN 'google_play'
        WHEN "stripe_subscription_id" LIKE 'apple:%'  THEN 'app_store'
        WHEN "stripe_subscription_id" IS NOT NULL      THEN 'stripe'
        WHEN "plan" = 'pro-zero'                       THEN 'manual'
        ELSE 'none'
      END,
      "subscription_provider_ref" = CASE
        WHEN "stripe_subscription_id" LIKE 'gplay:%' THEN SUBSTRING("stripe_subscription_id" FROM 7)
        WHEN "stripe_subscription_id" LIKE 'apple:%' THEN SUBSTRING("stripe_subscription_id" FROM 7)
        WHEN "stripe_subscription_id" IS NOT NULL     THEN "stripe_subscription_id"
        ELSE NULL
      END
    WHERE "subscription_provider" = 'none'
      AND ("stripe_subscription_id" IS NOT NULL OR "plan" = 'pro-zero');
  `)

  // Clean up the prefixed values left in stripe_subscription_id
  await pool.query(`
    UPDATE "bands"
    SET "stripe_subscription_id" = NULL
    WHERE "stripe_subscription_id" LIKE 'gplay:%'
       OR "stripe_subscription_id" LIKE 'apple:%';
  `)
}

async function ensureUserDefaultBandColumn() {
  if (!(await publicTableExists('user'))) return

  await pool.query(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "default_band_id" integer REFERENCES "bands"("id") ON DELETE SET NULL;
  `)
}

async function ensureSongArchiveColumn() {
  if (!(await publicTableExists('songs'))) return

  await pool.query(`
    ALTER TABLE "songs"
      ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
  `)
}

async function ensureGigSetlistDetailsColumns() {
  if (!(await publicTableExists('gig_setlists'))) return

  await pool.query(`
    ALTER TABLE "gig_setlists"
      ADD COLUMN IF NOT EXISTS "location" text,
      ADD COLUMN IF NOT EXISTS "gig_date" text,
      ADD COLUMN IF NOT EXISTS "gig_time" text,
      ADD COLUMN IF NOT EXISTS "notes" text;
  `)
}

async function ensureGigSetlistsCalendarConsistency() {
  if (!(await publicTableExists('gig_setlists')) || !(await publicTableExists('calendar_events'))) return

  // 1. Remove invalid links: calendar_event_id pointing to non-existent or non-gig events
  await pool.query(`
    UPDATE "gig_setlists"
    SET "calendar_event_id" = NULL
    WHERE "calendar_event_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "calendar_events" ce
        WHERE ce."id" = "gig_setlists"."calendar_event_id"
          AND ce."band_id" = "gig_setlists"."band_id"
          AND ce."type" = 'gig'
      );
  `)

  // 2. Ensure every calendar entry of type 'gig' has a gig setlist
  await pool.query(`
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
  `)
}

async function waitForDatabase(maxRetries = 10, delayMs = 2000): Promise<void> {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (err: any) {
      attempt++
      if (attempt >= maxRetries) {
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${err.message}`)
      }
      console.log(`Database not ready (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delayMs / 1000}s...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function runMigrations(options: { closePoolOnDone?: boolean; maxRetries?: number; retryDelayMs?: number } = {}) {
  const { closePoolOnDone = false, maxRetries = 10, retryDelayMs = 2000 } = options
  const started = Date.now()
  try {
    await waitForDatabase(maxRetries, retryDelayMs)
    await baselineLegacySchemaIfNeeded()
    await ensureBandsMonetizationColumns()
    await ensureUserProPlanColumns()
    await ensureBandLogoVariantColumns()
    await ensureUserDefaultBandColumn()
    await ensureSubscriptionProviderColumns()
    await ensureUserSubscriptionColumns()
    await ensureSongArchiveColumn()
    await ensureGigSetlistDetailsColumns()
    await ensureGigSetlistsCalendarConsistency()
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    const ms = Date.now() - started
    console.log(`DB migrations applied in ${ms}ms`)
  } catch (error) {
    console.error('DB migration failed', error)
    throw error
  } finally {
    if (closePoolOnDone) {
      await pool.end().catch(() => undefined)
    }
  }
}

// Standalone migration script execution.
if (process.argv[1] && process.argv[1].includes('migrate')) {
  try {
    await runMigrations({ closePoolOnDone: true })
  } catch (error) {
    console.error('Fatal migration error:', error)
    process.exit(1)
  }
}


import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { db, pool } from './index.js'

const MIGRATIONS_FOLDER = new URL('./migrations', import.meta.url).pathname

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

export async function runMigrations(options: { closePoolOnDone?: boolean } = {}) {
  const { closePoolOnDone = false } = options
  const started = Date.now()
  try {
    await baselineLegacySchemaIfNeeded()
    await ensureBandsMonetizationColumns()
    await ensureUserProPlanColumns()
    await ensureBandLogoVariantColumns()
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

// Keep standalone migration script behavior.
if ((process.argv[1] ?? '').includes('/db/migrate')) {
  void runMigrations({ closePoolOnDone: true }).catch(() => {
    process.exitCode = 1
  })
}

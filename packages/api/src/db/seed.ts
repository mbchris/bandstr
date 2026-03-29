import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './index.js'
const LEGACY_SEED_BAND_SLUG = 'legacy-imported-band'

function resolveSeedFilePath(): string {
  const fromCwd = resolve(process.cwd(), 'scripts', 'seed_example.sql')
  if (existsSync(fromCwd)) return fromCwd

  const currentDir = resolve(fileURLToPath(new URL('.', import.meta.url)))
  const fromModule = resolve(currentDir, '../../../..', 'scripts', 'seed_example.sql')
  if (existsSync(fromModule)) return fromModule

  throw new Error('Could not find scripts/seed_example.sql')
}

async function main(): Promise<void> {
  const seedPath = resolveSeedFilePath()
  const sql = readFileSync(seedPath, 'utf8')

  if (!sql.trim()) {
    throw new Error(`Seed file is empty: ${seedPath}`)
  }

  console.log(`Running seed SQL from ${seedPath}`)
  await pool.query(sql)
  await normalizeSeedTimestamps()
  console.log('Database seeding complete.')
}

async function normalizeSeedTimestamps(): Promise<void> {
  // Keep example content, but recalculate time data from "now"
  // so seeded rehearsals/gigs/events are always in upcoming weeks.
  await pool.query(
    `
    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    )
    UPDATE bands b
    SET created_at = now()
    FROM target_band tb
    WHERE b.id = tb.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    )
    UPDATE band_members bm
    SET joined_at = now() - (COALESCE(bm.sort_order, 0) * interval '1 day')
    FROM target_band tb
    WHERE bm.band_id = tb.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    ),
    base AS (
      SELECT CASE
        WHEN (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
        ) <= now()
        THEN (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
          + interval '7 day'
        )
        ELSE (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
        )
      END AS next_rehearsal
    ),
    rehearsal_rows AS (
      SELECT ce.id, row_number() OVER (ORDER BY ce.id) AS rn
      FROM calendar_events ce
      JOIN target_band tb ON tb.id = ce.band_id
      WHERE ce.type = 'rehearsal'
    )
    UPDATE calendar_events ce
    SET
      start_time = base.next_rehearsal + ((rr.rn - 1) * interval '7 day'),
      end_time = base.next_rehearsal + ((rr.rn - 1) * interval '7 day') + interval '3 hour',
      created_at = now() - ((12 - rr.rn) * interval '1 day')
    FROM rehearsal_rows rr
    CROSS JOIN base
    WHERE ce.id = rr.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    ),
    base AS (
      SELECT CASE
        WHEN (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
        ) <= now()
        THEN (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
          + interval '7 day'
        )
        ELSE (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
        )
      END AS next_rehearsal
    ),
    gig_rows AS (
      SELECT ce.id, row_number() OVER (ORDER BY ce.id) AS rn
      FROM calendar_events ce
      JOIN target_band tb ON tb.id = ce.band_id
      WHERE ce.type = 'gig'
    )
    UPDATE calendar_events ce
    SET
      start_time = base.next_rehearsal + ((gr.rn + 2) * interval '14 day') + interval '1 day',
      end_time = base.next_rehearsal + ((gr.rn + 2) * interval '14 day') + interval '1 day' + interval '3 hour',
      created_at = now() - ((6 - gr.rn) * interval '1 day')
    FROM gig_rows gr
    CROSS JOIN base
    WHERE ce.id = gr.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    ),
    base AS (
      SELECT CASE
        WHEN (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
        ) <= now()
        THEN (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
          + interval '7 day'
        )
        ELSE (
          date_trunc('day', now())
          + (((4 - EXTRACT(DOW FROM now())::int + 7) % 7) * interval '1 day')
          + interval '20 hour'
        )
      END AS next_rehearsal
    ),
    event_rows AS (
      SELECT ce.id, row_number() OVER (ORDER BY ce.id) AS rn
      FROM calendar_events ce
      JOIN target_band tb ON tb.id = ce.band_id
      WHERE ce.type = 'event'
    )
    UPDATE calendar_events ce
    SET
      start_time = base.next_rehearsal + ((er.rn + 4) * interval '14 day') + interval '2 day',
      end_time = base.next_rehearsal + ((er.rn + 4) * interval '14 day') + interval '4 day',
      created_at = now() - ((4 - er.rn) * interval '1 day')
    FROM event_rows er
    CROSS JOIN base
    WHERE ce.id = er.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    ),
    rehearsals AS (
      SELECT
        ce.id,
        ce.start_time,
        row_number() OVER (ORDER BY ce.start_time, ce.id) AS rn
      FROM calendar_events ce
      JOIN target_band tb ON tb.id = ce.band_id
      WHERE ce.type = 'rehearsal'
    ),
    unavailability_rows AS (
      SELECT
        ce.id,
        row_number() OVER (ORDER BY ce.id) AS rn
      FROM calendar_events ce
      JOIN target_band tb ON tb.id = ce.band_id
      WHERE ce.type = 'unavailability'
    )
    UPDATE calendar_events ce
    SET
      start_time = r.start_time - interval '1 hour',
      end_time = r.start_time + interval '2 hour',
      created_at = now() - interval '2 day'
    FROM unavailability_rows ur
    JOIN rehearsals r ON r.rn = ur.rn
    WHERE ce.id = ur.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    ),
    song_rows AS (
      SELECT s.id, row_number() OVER (ORDER BY s.id) AS rn
      FROM songs s
      JOIN target_band tb ON tb.id = s.band_id
    )
    UPDATE songs s
    SET created_at = now() - ((SELECT COUNT(*) FROM song_rows) - sr.rn) * interval '12 hour'
    FROM song_rows sr
    WHERE s.id = sr.id;

    WITH target_band AS (
      SELECT id
      FROM bands
      WHERE slug = $1
      LIMIT 1
    ),
    vote_rows AS (
      SELECT v.id, row_number() OVER (ORDER BY v.id) AS rn
      FROM votes v
      JOIN target_band tb ON tb.id = v.band_id
    )
    UPDATE votes v
    SET created_at = now() - ((SELECT COUNT(*) FROM vote_rows) - vr.rn) * interval '6 hour'
    FROM vote_rows vr
    WHERE v.id = vr.id;
    `,
    [LEGACY_SEED_BAND_SLUG],
  )
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })

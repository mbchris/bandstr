import { pool } from '../../src/db/index.js'

export async function cleanDatabase() {
  const tables = [
    'gig_songs',
    'rehearsal_songs',
    'gig_setlists',
    'user_setlist_songs',
    'user_push_devices',
    'user_notifications',
    'pending_notifications',
    'user_notification_settings',
    'rehearsal_time_proposals',
    'rehearsal_attendance',
    'personal_notes',
    'calendar_events',
    'votes',
    'songs',
    'band_invite_codes',
    'band_members',
    'session',
    'account',
    'bands',
    '"user"',
  ]

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE;`)
    } catch {
      // Ignore if table does not exist yet
    }
  }
}

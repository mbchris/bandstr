import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { bands } from './bands.js'
import { users } from './auth.js'
import { songs } from './songs.js'

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    type: text('type').notNull().default('rehearsal'), // 'rehearsal' | 'gig' | 'event' | 'unavailability'
    userId: text('user_id').references(() => users.id), // for unavailabilities
    bierwartOverrideId: text('bierwart_override_id').references(() => users.id),
    isTentative: boolean('is_tentative').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('calendar_band_idx').on(t.bandId, t.startTime),
  ],
)

export const rehearsalAttendance = pgTable(
  'rehearsal_attendance',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    rehearsalId: integer('rehearsal_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'present' | 'absent'
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rehearsal_attendance_band_rehearsal_user_idx').on(t.bandId, t.rehearsalId, t.userId),
    index('rehearsal_attendance_band_rehearsal_idx').on(t.bandId, t.rehearsalId),
  ],
)

export const rehearsalTimeProposals = pgTable(
  'rehearsal_time_proposals',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    rehearsalId: integer('rehearsal_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    proposerUserId: text('proposer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    proposedStartTime: timestamp('proposed_start_time').notNull(),
    proposedEndTime: timestamp('proposed_end_time').notNull(),
    comment: text('comment'),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
    decidedByUserId: text('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    decisionComment: text('decision_comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('rehearsal_time_proposals_band_rehearsal_idx').on(t.bandId, t.rehearsalId, t.createdAt),
    index('rehearsal_time_proposals_rehearsal_status_idx').on(t.rehearsalId, t.status),
  ],
)

export const gigSetlists = pgTable(
  'gig_setlists',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    location: text('location'),
    gigDate: text('gig_date'),
    gigTime: text('gig_time'),
    notes: text('notes'),
    calendarEventId: integer('calendar_event_id').references(() => calendarEvents.id, { onDelete: 'set null' }),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('gig_setlists_band_idx').on(t.bandId, t.createdAt),
    uniqueIndex('gig_setlists_band_calendar_event_idx').on(t.bandId, t.calendarEventId),
  ],
)

export const rehearsalSongs = pgTable(
  'rehearsal_songs',
  {
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    rehearsalId: integer('rehearsal_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('rehearsal_songs_idx').on(t.rehearsalId, t.songId),
  ],
)

export const gigSongs = pgTable(
  'gig_songs',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    gigId: integer('gig_id')
      .notNull()
      .references(() => gigSetlists.id, { onDelete: 'cascade' }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('gig_songs_gig_idx').on(t.gigId, t.position),
  ],
)

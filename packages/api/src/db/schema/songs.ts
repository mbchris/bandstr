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
import { relations, sql } from 'drizzle-orm'
import { bands } from './bands.js'
import { users } from './auth.js'
import { gigSongs, rehearsalSongs } from './calendar.js'

export const songs = pgTable(
  'songs',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    spotifyUrl: text('spotify_url'),
    youtubeUrl: text('youtube_url'),
    thumbnailUrl: text('thumbnail_url'),
    lengthMs: integer('length_ms'),
    bpm: integer('bpm'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    notes: text('notes'),
    type: text('type').notNull().default('song'), // 'song' | 'pause' | 'tuning' | 'note'
    pitch: integer('pitch').notNull().default(0), // -5 to +5
    isSetlist: boolean('is_setlist').notNull().default(false),
    position: integer('position').notNull().default(0),
    isPinned: boolean('is_pinned').notNull().default(false),
    addedBy: text('added_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('songs_band_idx').on(t.bandId, t.position),
  ],
)

export const votes = pgTable(
  'votes',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0), // 0=veto, 1=ok, 2=good, 3=great
    comment: text('comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('votes_song_user_idx').on(t.songId, t.userId),
    index('votes_band_idx').on(t.bandId),
  ],
)

export const personalNotes = pgTable(
  'personal_notes',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('personal_notes_song_user_idx').on(t.songId, t.userId),
  ],
)

export const userSetlistSongs = pgTable(
  'user_setlist_songs',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_setlist_songs_band_user_song_idx').on(t.bandId, t.userId, t.songId),
    index('user_setlist_songs_band_user_position_idx').on(t.bandId, t.userId, t.position),
  ],
)

export const songsRelations = relations(songs, ({ one, many }) => ({
  band: one(bands, { fields: [songs.bandId], references: [bands.id] }),
  votes: many(votes),
  personalNotes: many(personalNotes),
  gigSongs: many(gigSongs),
  rehearsalSongs: many(rehearsalSongs),
  userSetlistSongs: many(userSetlistSongs),
}))

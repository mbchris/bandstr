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

export const userNotificationSettings = pgTable('user_notification_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  notifyAbsence: boolean('notify_absence').notNull().default(true),
  notifyGig: boolean('notify_gig').notNull().default(true),
  notifyRehearsal: boolean('notify_rehearsal').notNull().default(true),
  notifySongSuggestion: boolean('notify_song_suggestion').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const pendingNotifications = pgTable(
  'pending_notifications',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(), // 'absence' | 'gig' | 'rehearsal' | 'song_suggestion'
    entityKey: text('entity_key').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    linkPath: text('link_path').notNull(),
    linkQuery: text('link_query'),
    dueAt: timestamp('due_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pending_notifications_band_event_entity_idx').on(t.bandId, t.eventType, t.entityKey),
    index('pending_notifications_band_due_idx').on(t.bandId, t.dueAt),
  ],
)

export const userNotifications = pgTable(
  'user_notifications',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    linkPath: text('link_path').notNull(),
    linkQuery: text('link_query'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    readAt: timestamp('read_at'),
  },
  (t) => [
    index('user_notifications_user_band_created_idx').on(t.userId, t.bandId, t.createdAt),
    index('user_notifications_user_band_read_idx').on(t.userId, t.bandId, t.isRead),
  ],
)

export const userPushDevices = pgTable(
  'user_push_devices',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(), // 'android' | 'ios'
    tokenType: text('token_type').notNull(), // 'fcm' | 'apns'
    token: text('token').notNull().unique(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('user_push_devices_user_idx').on(t.userId, t.isEnabled),
    index('user_push_devices_token_type_idx').on(t.tokenType, t.isEnabled),
  ],
)

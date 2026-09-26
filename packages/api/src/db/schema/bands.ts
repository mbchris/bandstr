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
import { relations } from 'drizzle-orm'
import { users } from './auth.js'
import { songs } from './songs.js'
import { calendarEvents, gigSetlists } from './calendar.js'

export const bands = pgTable('bands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'), // 'free' | 'pro' | 'pro-zero'
  logo: text('logo'),
  logoDark: text('logo_dark'),
  logoBright: text('logo_bright'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionProvider: text('subscription_provider').notNull().default('none'), // 'none' | 'stripe' | 'google_play' | 'app_store' | 'manual'
  subscriptionProviderRef: text('subscription_provider_ref'), // purchaseToken / stripeSubscriptionId / originalTransactionId
  subscriptionStatus: text('subscription_status').notNull().default('none'), // 'none' | 'active' | 'canceled' | 'past_due' | 'trialing' | 'grace_period' | 'on_hold' | 'paused'
  subscriptionInterval: text('subscription_interval'), // 'monthly' | 'yearly'
  subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end'),
  subscriptionCancelAtPeriodEnd: boolean('subscription_cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const bandMembers = pgTable(
  'band_members',
  {
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    userId: text('user_id') // Better Auth user id (text/uuid)
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner' | 'admin' | 'member'
    sortOrder: integer('sort_order').notNull().default(0),
    isHidden: boolean('is_hidden').notNull().default(false),
    beerCount: integer('beer_count').notNull().default(0),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('band_members_band_user_idx').on(t.bandId, t.userId),
    index('band_members_band_idx').on(t.bandId),
  ],
)

export const bandInviteCodes = pgTable(
  'band_invite_codes',
  {
    id: serial('id').primaryKey(),
    bandId: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
    invalidatedBy: text('invalidated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    usedAt: timestamp('used_at'),
    invalidatedAt: timestamp('invalidated_at'),
  },
  (t) => [
    uniqueIndex('band_invite_codes_code_idx').on(t.code),
    index('band_invite_codes_band_idx').on(t.bandId, t.createdAt),
  ],
)

export const bandsRelations = relations(bands, ({ many }) => ({
  members: many(bandMembers),
  songs: many(songs),
  calendarEvents: many(calendarEvents),
  gigSetlists: many(gigSetlists),
}))

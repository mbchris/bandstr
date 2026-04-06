import { and, eq, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bandMembers, users } from '../db/schema.js'
import { isActiveEntitlement } from './subscription/types.js'
import type { SubscriptionStatus } from './subscription/types.js'

export type PlanId = 'free' | 'pro' | 'plus' | 'pro-zero'

export function normalizePlan(plan: string): PlanId {
  if (plan === 'band') return 'pro'
  if (plan === 'pro' || plan === 'pro-zero' || plan === 'plus') return plan
  return 'free'
}

export function isProPlan(plan: string): boolean {
  const normalized = normalizePlan(plan)
  return normalized === 'pro' || normalized === 'pro-zero'
}

/** True if the user has an active pro subscription of their own (paid or dev-assigned). */
export async function userHasProPlan(userId: string): Promise<boolean> {
  const [user] = await db
    .select({
      devProPlan: users.devProPlan,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionStatus: users.subscriptionStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return false
  if (user.devProPlan) return true
  return (
    isProPlan(user.subscriptionPlan ?? 'free') &&
    isActiveEntitlement((user.subscriptionStatus ?? 'none') as SubscriptionStatus)
  )
}

/** True if any member of the band has a pro subscription. */
export async function bandHasProPlan(bandId: number): Promise<boolean> {
  const members = await db
    .select({
      devProPlan: users.devProPlan,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionStatus: users.subscriptionStatus,
    })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.userId))
    .where(eq(bandMembers.bandId, bandId))

  return members.some(
    (m) =>
      m.devProPlan ||
      (isProPlan(m.subscriptionPlan ?? 'free') &&
        isActiveEntitlement((m.subscriptionStatus ?? 'none') as SubscriptionStatus)),
  )
}

/**
 * Compute a user's effective plan in the context of a band.
 * Priority: pro (own) > plus (inherited from band member) > free
 */
export async function userEffectivePlan(userId: string, bandId?: number | null): Promise<'pro' | 'plus' | 'free'> {
  // Check user's own subscription first
  if (await userHasProPlan(userId)) return 'pro'

  if (!bandId) return 'free'

  // Check if any other band member has pro → inherited "plus"
  const otherMembers = await db
    .select({
      devProPlan: users.devProPlan,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionStatus: users.subscriptionStatus,
    })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.userId))
    .where(and(eq(bandMembers.bandId, bandId), ne(bandMembers.userId, userId)))

  const hasPlusThroughBand = otherMembers.some(
    (m) =>
      m.devProPlan ||
      (isProPlan(m.subscriptionPlan ?? 'free') &&
        isActiveEntitlement((m.subscriptionStatus ?? 'none') as SubscriptionStatus)),
  )

  return hasPlusThroughBand ? 'plus' : 'free'
}

/** @deprecated Use userHasProPlan instead. Kept for internal admin use. */
export async function userHasDeveloperProPlan(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ devProPlan: users.devProPlan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return !!user?.devProPlan
}

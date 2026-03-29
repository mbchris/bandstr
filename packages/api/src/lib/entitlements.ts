import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bandMembers, bands, users } from '../db/schema.js'

export type PlanId = 'free' | 'pro' | 'pro-zero'

export function normalizePlan(plan: string): PlanId {
  if (plan === 'band') return 'pro'
  if (plan === 'pro' || plan === 'pro-zero') return plan
  return 'free'
}

export function isProPlan(plan: string): boolean {
  const normalized = normalizePlan(plan)
  return normalized === 'pro' || normalized === 'pro-zero'
}

export async function userHasDeveloperProPlan(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ devProPlan: users.devProPlan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return !!user?.devProPlan
}

export async function bandHasProPlan(bandId: number): Promise<boolean> {
  const [band] = await db.select({ plan: bands.plan }).from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) return false
  if (isProPlan(band.plan)) return true

  const [managerWithPro] = await db
    .select({ userId: bandMembers.userId })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.userId))
    .where(
      and(
        eq(bandMembers.bandId, bandId),
        inArray(bandMembers.role, ['owner', 'admin']),
        eq(users.devProPlan, true),
      ),
    )
    .limit(1)

  return !!managerWithPro
}

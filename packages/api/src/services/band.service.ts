import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../db/index.js'
import { bands as bandsTable, bandInviteCodes, bandMembers, users as usersTable } from '../db/schema/index.js'
import { bandHasProPlan, normalizePlan, userEffectivePlan, userHasProPlan } from '../lib/entitlements.js'

const INVITE_TTL_DAYS = 30
const FREE_MEMBER_LIMIT = 5

function inviteActiveThreshold() {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - INVITE_TTL_DAYS)
  return threshold
}

function inviteExpiry(createdAt: Date | string) {
  const base = createdAt instanceof Date ? createdAt : new Date(createdAt)
  return new Date(base.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}

function toBandSlug(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const baseName = sanitized || 'band'
  const shortId = randomBytes(4).toString('hex')
  return `${shortId}-${baseName}`
}

export const bandService = {
  async listBandsForUser(userId: string) {
    const [userRow] = await db
      .select({ defaultBandId: usersTable.defaultBandId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    const rows = await db
      .select({
        id: bandsTable.id,
        name: bandsTable.name,
        slug: bandsTable.slug,
        plan: bandsTable.plan,
        logo: bandsTable.logo,
        logoDark: bandsTable.logoDark,
        logoBright: bandsTable.logoBright,
        subscriptionStatus: bandsTable.subscriptionStatus,
        subscriptionInterval: bandsTable.subscriptionInterval,
        subscriptionCurrentPeriodEnd: bandsTable.subscriptionCurrentPeriodEnd,
        subscriptionCancelAtPeriodEnd: bandsTable.subscriptionCancelAtPeriodEnd,
        subscriptionProvider: bandsTable.subscriptionProvider,
        role: bandMembers.role,
      })
      .from(bandMembers)
      .innerJoin(bandsTable, eq(bandsTable.id, bandMembers.bandId))
      .where(eq(bandMembers.userId, userId))

    let defaultBandId = userRow?.defaultBandId ?? null
    if (rows.length === 1 && defaultBandId !== rows[0].id) {
      const [updatedUser] = await db
        .update(usersTable)
        .set({ defaultBandId: rows[0].id })
        .where(eq(usersTable.id, userId))
        .returning({ defaultBandId: usersTable.defaultBandId })
      defaultBandId = updatedUser?.defaultBandId ?? rows[0].id
    }

    if (rows.length > 1 && defaultBandId != null && !rows.some((row) => row.id === defaultBandId)) {
      const [updatedUser] = await db
        .update(usersTable)
        .set({ defaultBandId: null })
        .where(eq(usersTable.id, userId))
        .returning({ defaultBandId: usersTable.defaultBandId })
      defaultBandId = updatedUser?.defaultBandId ?? null
    }

    return Promise.all(
      rows.map(async (row) => {
        const normalizedPlan = normalizePlan(row.plan)
        const [hasPro, effectivePlan] = await Promise.all([
          bandHasProPlan(row.id),
          userEffectivePlan(userId, row.id),
        ])
        return {
          ...row,
          plan: normalizedPlan,
          isDefault: row.id === defaultBandId,
          hasProPlan: hasPro,
          effectivePlan,
        }
      }),
    )
  },

  async createBand(params: { userId: string; name: string }) {
    const { userId, name } = params

    // Check free plan membership limit (free users can only be in one band)
    const existingBandCount = await db
      .select({ id: bandMembers.bandId })
      .from(bandMembers)
      .where(eq(bandMembers.userId, userId))
    const hasPro = await userHasProPlan(userId)

    if (!hasPro && existingBandCount.length >= 1) {
      return {
        error: 'Free plan allows being a member of only one band. Upgrade to pro to join multiple bands.',
        status: 403 as const,
      }
    }

    let band: typeof bandsTable.$inferSelect | undefined

    for (let attempts = 0; attempts < 6; attempts += 1) {
      const slug = toBandSlug(name)
      try {
        ;[band] = await db.insert(bandsTable).values({ name, slug }).returning()
        break
      } catch {
        // Retry on unique slug collisions
      }
    }

    if (!band) {
      return { error: 'Could not create band', status: 500 as const }
    }

    await db.insert(bandMembers).values({
      bandId: band.id,
      userId,
      role: 'owner',
    })

    const normalizedPlan = normalizePlan(band.plan)
    return {
      band: {
        ...band,
        plan: normalizedPlan,
        hasProPlan: await bandHasProPlan(band.id),
      },
      status: 201 as const,
    }
  },

  async getBandDetails(bandId: number) {
    const [band] = await db.select().from(bandsTable).where(eq(bandsTable.id, bandId)).limit(1)
    if (!band) return null
    const normalizedPlan = normalizePlan(band.plan)
    return {
      ...band,
      plan: normalizedPlan,
      hasProPlan: await bandHasProPlan(band.id),
    }
  },

  async updateBand(
    bandId: number,
    data: {
      name?: string
      defaultRehearsalStartTime?: string
      defaultRehearsalEndTime?: string
      defaultGigStartTime?: string
      defaultGigEndTime?: string
    },
  ) {
    const [updated] = await db
      .update(bandsTable)
      .set(data)
      .where(eq(bandsTable.id, bandId))
      .returning()
    return updated ?? null
  },

  async deleteBand(bandId: number) {
    await db.delete(bandsTable).where(eq(bandsTable.id, bandId))
    return { ok: true }
  },

  async listMembers(bandId: number) {
    return db
      .select({
        userId: bandMembers.userId,
        role: bandMembers.role,
        sortOrder: bandMembers.sortOrder,
        isHidden: bandMembers.isHidden,
        beerCount: bandMembers.beerCount,
        joinedAt: bandMembers.joinedAt,
      })
      .from(bandMembers)
      .where(eq(bandMembers.bandId, bandId))
      .orderBy(bandMembers.sortOrder)
  },

  async listInviteCodes(bandId: number) {
    const threshold = inviteActiveThreshold()
    const rows = await db
      .select({
        id: bandInviteCodes.id,
        code: bandInviteCodes.code,
        createdBy: bandInviteCodes.createdBy,
        usedBy: bandInviteCodes.usedBy,
        invalidatedBy: bandInviteCodes.invalidatedBy,
        createdAt: bandInviteCodes.createdAt,
        usedAt: bandInviteCodes.usedAt,
        invalidatedAt: bandInviteCodes.invalidatedAt,
      })
      .from(bandInviteCodes)
      .where(eq(bandInviteCodes.bandId, bandId))
      .orderBy(desc(bandInviteCodes.createdAt))

    return rows.map((row) => {
      const expiresAt = inviteExpiry(row.createdAt)
      const expired = !row.usedAt && !row.invalidatedAt && row.createdAt <= threshold
      return {
        ...row,
        expiresAt,
        expired,
      }
    })
  },

  async createInviteCode(bandId: number, userId: string) {
    let created: typeof bandInviteCodes.$inferSelect | undefined

    for (let attempts = 0; attempts < 5; attempts += 1) {
      const code = `BND-${randomBytes(12).toString('hex').toUpperCase()}`
      try {
        ;[created] = await db
          .insert(bandInviteCodes)
          .values({
            bandId,
            code,
            createdBy: userId,
          })
          .returning()
        break
      } catch {
        // Retry on potential unique collisions.
      }
    }

    if (!created) return null
    return {
      ...created,
      expiresAt: inviteExpiry(created.createdAt),
      expired: false,
    }
  },

  async invalidateInviteCode(bandId: number, inviteId: number, userId: string) {
    const threshold = inviteActiveThreshold()
    const [updated] = await db
      .update(bandInviteCodes)
      .set({ invalidatedBy: userId, invalidatedAt: new Date() })
      .where(
        and(
          eq(bandInviteCodes.id, inviteId),
          eq(bandInviteCodes.bandId, bandId),
          gt(bandInviteCodes.createdAt, threshold),
          isNull(bandInviteCodes.usedAt),
          isNull(bandInviteCodes.invalidatedAt),
        ),
      )
      .returning()

    if (!updated) return null
    return {
      ...updated,
      expiresAt: inviteExpiry(updated.createdAt),
      expired: false,
    }
  },

  async joinBand(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase()
    const threshold = inviteActiveThreshold()

    const [invite] = await db
      .select()
      .from(bandInviteCodes)
      .where(
        and(
          eq(bandInviteCodes.code, code),
          gt(bandInviteCodes.createdAt, threshold),
          isNull(bandInviteCodes.usedAt),
          isNull(bandInviteCodes.invalidatedAt),
        ),
      )
      .limit(1)

    if (!invite) {
      return { error: 'Invitation code is invalid, expired, or already used', status: 404 as const }
    }

    const [existing] = await db
      .select({ bandId: bandMembers.bandId })
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, invite.bandId), eq(bandMembers.userId, userId)))
      .limit(1)

    if (existing) {
      return { error: 'You are already a member of this band', status: 409 as const }
    }

    const hasPro = await userHasProPlan(userId)
    if (!hasPro) {
      const currentMemberships = await db
        .select({ id: bandMembers.bandId })
        .from(bandMembers)
        .where(eq(bandMembers.userId, userId))
      if (currentMemberships.length >= 1) {
        return {
          error: 'Free plan allows being a member of only one band. Upgrade to pro to join multiple bands.',
          status: 403 as const,
        }
      }
    }

    const [targetBand] = await db
      .select({ id: bandsTable.id })
      .from(bandsTable)
      .where(eq(bandsTable.id, invite.bandId))
      .limit(1)

    if (!targetBand) {
      return { error: 'Band not found', status: 404 as const }
    }

    const hasProPlan = await bandHasProPlan(targetBand.id)
    if (!hasProPlan) {
      const members = await db
        .select({ userId: bandMembers.userId })
        .from(bandMembers)
        .where(eq(bandMembers.bandId, invite.bandId))
      if (members.length >= FREE_MEMBER_LIMIT) {
        return {
          error: 'Free plan allows up to 5 members. Upgrade to pro to add more members.',
          status: 403 as const,
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(bandInviteCodes)
        .set({ usedBy: userId, usedAt: new Date() })
        .where(
          and(
            eq(bandInviteCodes.id, invite.id),
            isNull(bandInviteCodes.usedAt),
            isNull(bandInviteCodes.invalidatedAt),
          ),
        )
        .returning()

      if (!consumed) return null

      await tx.insert(bandMembers).values({
        bandId: invite.bandId,
        userId,
        role: 'member',
      })

      const [band] = await tx.select().from(bandsTable).where(eq(bandsTable.id, invite.bandId)).limit(1)
      if (!band) return null

      const normalizedPlan = normalizePlan(band.plan)
      return {
        id: band.id,
        name: band.name,
        slug: band.slug,
        plan: normalizedPlan,
        hasProPlan: await bandHasProPlan(band.id),
        logo: band.logo,
        logoDark: band.logoDark,
        logoBright: band.logoBright,
        role: 'member' as const,
      }
    })

    if (!result) {
      return { error: 'Invitation code is invalid, expired, or already used', status: 409 as const }
    }

    return { band: result, status: 201 as const }
  },
}

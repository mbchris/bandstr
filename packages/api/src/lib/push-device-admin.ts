import { pool } from '../db/index.js'

export type RegisteredPushDeviceRow = {
  userId: string
  userName: string
  userEmail: string
  memberRole: string
  deviceId: number
  platform: string
  tokenType: string
  token: string
  tokenPreview: string
  isEnabled: boolean
  lastSeenAt: Date
  createdAt: Date
  updatedAt: Date
}

function previewToken(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length <= 12) return trimmed
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`
}

export async function listRegisteredPushDevicesForBand(
  bandId: number,
  includeDisabled = false,
): Promise<RegisteredPushDeviceRow[]> {
  const result = await pool.query<{
    user_id: string
    user_name: string
    user_email: string
    member_role: string
    device_id: number | null
    platform: string | null
    token_type: string | null
    token: string | null
    is_enabled: boolean | null
    last_seen_at: Date | null
    created_at: Date | null
    updated_at: Date | null
  }>(
    `
      select
        bm.user_id,
        coalesce(u.name, '') as user_name,
        coalesce(u.email, '') as user_email,
        bm.role as member_role,
        upd.id as device_id,
        upd.platform,
        upd.token_type,
        upd.token,
        upd.is_enabled,
        upd.last_seen_at,
        upd.created_at,
        upd.updated_at
      from band_members bm
      inner join "user" u on u.id = bm.user_id
      left join user_push_devices upd on upd.user_id = bm.user_id
      where bm.band_id = $1
        and (upd.id is null or $2::boolean = true or upd.is_enabled = true)
      order by bm.role asc, u.name asc, u.email asc, upd.created_at asc nulls last
    `,
    [bandId, includeDisabled],
  )

  return result.rows
    .filter((row) => row.device_id !== null && row.platform && row.token_type && row.token)
    .map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      memberRole: row.member_role,
      deviceId: row.device_id as number,
      platform: row.platform as string,
      tokenType: row.token_type as string,
      token: row.token as string,
      tokenPreview: previewToken(row.token as string),
      isEnabled: Boolean(row.is_enabled),
      lastSeenAt: row.last_seen_at ?? new Date(0),
      createdAt: row.created_at ?? new Date(0),
      updatedAt: row.updated_at ?? new Date(0),
    }))
}

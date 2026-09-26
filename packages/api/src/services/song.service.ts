import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  songs as songsTable,
  votes as votesTable,
  personalNotes as personalNotesTable,
  userSetlistSongs as userSetlistSongsTable,
} from '../db/schema/index.js'
import { bandHasProPlan } from '../lib/entitlements.js'
import { fetchSpotifyEnrichedMetadata } from '../lib/spotify.js'
import { queueBandNotification } from '../lib/notifications.js'

const FREE_SETLIST_LIMIT = 15

export async function setlistSongCountForBand(bandId: number, excludingSongId?: number) {
  const songsInBand = await db
    .select({ id: songsTable.id, isSetlist: songsTable.isSetlist, type: songsTable.type })
    .from(songsTable)
    .where(eq(songsTable.bandId, bandId))

  return songsInBand.filter(
    (s) => s.isSetlist && s.type === 'song' && (excludingSongId === undefined || s.id !== excludingSongId),
  ).length
}

export type CreateSongInput = {
  title?: string
  artist?: string
  spotifyUrl?: string
  youtubeUrl?: string
  lengthMs?: number
  bpm?: number | null
  tags?: string[]
  notes?: string
  type?: 'song' | 'pause' | 'tuning' | 'note' | 'set' | 'encore'
  pitch?: number
  isSetlist?: boolean
  position?: number
  isPinned?: boolean
  isArchived?: boolean
}

export type UpdateSongInput = Partial<CreateSongInput>

export const songService = {
  async listSongs(bandId: number, userId: string, isSetlistOnly = false) {
    const allSongs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.bandId, bandId))
      .orderBy(asc(songsTable.position))

    const allVotes = await db
      .select()
      .from(votesTable)
      .where(eq(votesTable.bandId, bandId))

    return allSongs
      .filter((s) => (isSetlistOnly ? s.isSetlist : true))
      .map((song) => {
        const songVotes = allVotes.filter((v) => v.songId === song.id)
        const myVote = songVotes.find((v) => v.userId === userId)
        return {
          ...song,
          voteCount: songVotes.length,
          voteAverage:
            songVotes.length > 0
              ? songVotes.reduce((acc, v) => acc + v.score, 0) / songVotes.length
              : 0,
          hasVoted: myVote ? myVote.score : -1,
          allVotes: songVotes,
        }
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return a.position - b.position || b.voteAverage - a.voteAverage
      })
  },

  async createSong(params: {
    bandId: number
    userId: string
    userName: string
    data: CreateSongInput
  }) {
    const { bandId, userId, userName, data } = params
    const hasProPlan = await bandHasProPlan(bandId)

    if (!hasProPlan && data.notes !== undefined) {
      return { error: 'Song shared notes are available on pro plans only.', status: 403 as const }
    }

    if (!hasProPlan && data.isSetlist && data.type === 'song') {
      const setlistCount = await setlistSongCountForBand(bandId)
      if (setlistCount >= FREE_SETLIST_LIMIT) {
        return {
          error: `Free plan allows up to ${FREE_SETLIST_LIMIT} setlist songs. Upgrade to pro to add more.`,
          status: 403 as const,
        }
      }
    }

    let meta = {
      title: data.title ?? null,
      artist: data.artist ?? null,
      thumbnail: null as string | null,
      durationMs: data.lengthMs ?? null,
    }

    if (data.type === 'song' && data.spotifyUrl) {
      try {
        const sp = await fetchSpotifyEnrichedMetadata(data.spotifyUrl)
        meta = {
          title: data.title ?? sp.title ?? null,
          artist: data.artist ?? sp.artist ?? null,
          thumbnail: sp.thumbnail ?? null,
          durationMs: data.lengthMs ?? sp.durationMs ?? null,
        }
      } catch {
        // Fall back to provided metadata if Spotify resolution fails
      }
    }

    const [song] = await db
      .insert(songsTable)
      .values({
        bandId,
        title: data.title || meta.title || 'Untitled',
        artist: data.artist || meta.artist || 'Unknown Artist',
        spotifyUrl: data.spotifyUrl,
        youtubeUrl: data.youtubeUrl,
        thumbnailUrl: meta.thumbnail,
        lengthMs: data.lengthMs ?? meta.durationMs,
        bpm: data.bpm ?? null,
        tags: data.tags ?? [],
        notes: data.notes,
        type: data.type ?? 'song',
        pitch: data.pitch ?? 0,
        isSetlist: data.isSetlist ?? false,
        position: data.position ?? 0,
        isPinned: data.isPinned ?? false,
        isArchived: data.isArchived ?? false,
        addedBy: userId,
      })
      .returning()

    if (song.type === 'song' && !song.isSetlist) {
      await queueBandNotification({
        bandId,
        actorUserId: userId,
        eventType: 'song_suggestion',
        entityKey: `song:${song.id}`,
        title: 'New song suggested',
        message: `${userName} suggested "${song.title}" by ${song.artist}.`,
        linkPath: '/voting',
        linkQuery: `songId=${song.id}`,
      })
    }

    return { song, status: 201 as const }
  },

  async updateSong(params: {
    bandId: number
    id: number
    data: UpdateSongInput
  }) {
    const { bandId, id, data } = params
    const hasProPlan = await bandHasProPlan(bandId)

    const [existing] = await db
      .select()
      .from(songsTable)
      .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))
      .limit(1)

    if (!existing) return null

    if (!hasProPlan && data.notes !== undefined) {
      return { error: 'Song shared notes are available on pro plans only.', status: 403 as const }
    }

    const nextIsSetlist = data.isSetlist ?? existing.isSetlist
    const nextType = data.type ?? existing.type
    const becomesCountedSetlistSong =
      nextIsSetlist && nextType === 'song' && !(existing.isSetlist && existing.type === 'song')

    if (!hasProPlan && becomesCountedSetlistSong) {
      const setlistCount = await setlistSongCountForBand(bandId, id)
      if (setlistCount >= FREE_SETLIST_LIMIT) {
        return {
          error: `Free plan allows up to ${FREE_SETLIST_LIMIT} setlist songs. Upgrade to pro to add more.`,
          status: 403 as const,
        }
      }
    }

    let thumbnailUrl = existing.thumbnailUrl
    let lengthMs = existing.lengthMs
    const spotifyUrl = data.spotifyUrl !== undefined ? data.spotifyUrl : existing.spotifyUrl
    const needsMeta =
      (data.spotifyUrl !== undefined && data.spotifyUrl !== existing.spotifyUrl) ||
      (spotifyUrl && (!thumbnailUrl || !lengthMs))

    if (needsMeta && spotifyUrl) {
      try {
        const meta = await fetchSpotifyEnrichedMetadata(spotifyUrl)
        thumbnailUrl = meta.thumbnail ?? thumbnailUrl
        lengthMs = meta.durationMs ?? lengthMs
      } catch {
        // Fall back to existing metadata
      }
    }

    const [updated] = await db
      .update(songsTable)
      .set({
        title: data.title ?? existing.title,
        artist: data.artist ?? existing.artist,
        spotifyUrl: data.spotifyUrl ?? existing.spotifyUrl,
        youtubeUrl: data.youtubeUrl ?? existing.youtubeUrl,
        thumbnailUrl,
        lengthMs: data.lengthMs ?? lengthMs,
        bpm: Object.prototype.hasOwnProperty.call(data, 'bpm') ? data.bpm : existing.bpm,
        tags: data.tags ?? existing.tags,
        notes: data.notes ?? existing.notes,
        type: data.type ?? existing.type,
        pitch: data.pitch ?? existing.pitch,
        isSetlist: data.isSetlist ?? existing.isSetlist,
        position: data.position ?? existing.position,
        isPinned: data.isPinned ?? existing.isPinned,
        isArchived: data.isArchived ?? existing.isArchived,
      })
      .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))
      .returning()

    return { song: updated, status: 200 as const }
  },

  async deleteSong(bandId: number, id: number) {
    const [existing] = await db
      .select()
      .from(songsTable)
      .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))
      .limit(1)

    if (!existing) return null

    await db.delete(votesTable).where(and(eq(votesTable.songId, id), eq(votesTable.bandId, bandId)))
    await db.delete(songsTable).where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))

    return { success: true }
  },

  async reorderSongs(bandId: number, order: Array<{ id: number; position: number }>) {
    await Promise.all(
      order.map(({ id, position }) =>
        db
          .update(songsTable)
          .set({ position })
          .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId))),
      ),
    )
    return { success: true }
  },

  async vote(params: {
    bandId: number
    songId: number
    userId: string
    score: number
    comment?: string | null
  }) {
    const { bandId, songId, userId, score, comment } = params

    const [existingVote] = await db
      .select()
      .from(votesTable)
      .where(and(eq(votesTable.bandId, bandId), eq(votesTable.songId, songId), eq(votesTable.userId, userId)))
      .limit(1)

    if (existingVote) {
      const [updated] = await db
        .update(votesTable)
        .set({ score, comment, createdAt: new Date() })
        .where(eq(votesTable.id, existingVote.id))
        .returning()
      return updated
    }

    const [created] = await db
      .insert(votesTable)
      .values({ bandId, songId, userId, score, comment })
      .returning()
    return created
  },

  async getUserSetlist(bandId: number, userId: string) {
    return db
      .select({
        id: songsTable.id,
        bandId: songsTable.bandId,
        title: songsTable.title,
        artist: songsTable.artist,
        spotifyUrl: songsTable.spotifyUrl,
        youtubeUrl: songsTable.youtubeUrl,
        thumbnailUrl: songsTable.thumbnailUrl,
        lengthMs: songsTable.lengthMs,
        bpm: songsTable.bpm,
        tags: songsTable.tags,
        notes: songsTable.notes,
        type: songsTable.type,
        pitch: songsTable.pitch,
        isSetlist: songsTable.isSetlist,
        position: songsTable.position,
        isPinned: songsTable.isPinned,
        addedBy: songsTable.addedBy,
        createdAt: songsTable.createdAt,
        userSetlistPosition: userSetlistSongsTable.position,
        userSetlistPinned: userSetlistSongsTable.isPinned,
      })
      .from(userSetlistSongsTable)
      .innerJoin(songsTable, eq(userSetlistSongsTable.songId, songsTable.id))
      .where(and(eq(userSetlistSongsTable.bandId, bandId), eq(userSetlistSongsTable.userId, userId)))
      .orderBy(asc(userSetlistSongsTable.position), asc(songsTable.id))
  },

  async addUserSetlistSong(params: {
    bandId: number
    userId: string
    songId: number
    position?: number
    isPinned?: boolean
  }) {
    const { bandId, userId, songId, position, isPinned } = params

    const [song] = await db
      .select({ id: songsTable.id, type: songsTable.type })
      .from(songsTable)
      .where(and(eq(songsTable.id, songId), eq(songsTable.bandId, bandId)))
      .limit(1)

    if (!song) return { error: 'Song not found', status: 404 as const }
    if (song.type !== 'song') return { error: 'Only songs can be added to personal setlist.', status: 400 as const }

    const [maxRow] = await db
      .select({ maxPosition: sql<number>`coalesce(max(${userSetlistSongsTable.position}), -1)` })
      .from(userSetlistSongsTable)
      .where(and(eq(userSetlistSongsTable.bandId, bandId), eq(userSetlistSongsTable.userId, userId)))

    const nextPosition = typeof position === 'number' ? position : Number(maxRow?.maxPosition ?? -1) + 1

    await db
      .insert(userSetlistSongsTable)
      .values({
        bandId,
        userId,
        songId,
        position: nextPosition,
        isPinned: isPinned ?? false,
      })
      .onConflictDoUpdate({
        target: [userSetlistSongsTable.bandId, userSetlistSongsTable.userId, userSetlistSongsTable.songId],
        set: {
          position: nextPosition,
          isPinned: isPinned ?? false,
        },
      })

    return { success: true, status: 201 as const }
  },

  async updateUserSetlistSong(params: {
    bandId: number
    userId: string
    songId: number
    data: { position?: number; isPinned?: boolean }
  }) {
    const { bandId, userId, songId, data } = params
    await db
      .update(userSetlistSongsTable)
      .set({
        position: data.position,
        isPinned: data.isPinned,
      })
      .where(
        and(
          eq(userSetlistSongsTable.bandId, bandId),
          eq(userSetlistSongsTable.userId, userId),
          eq(userSetlistSongsTable.songId, songId),
        ),
      )

    return { success: true }
  },

  async deleteUserSetlistSong(bandId: number, userId: string, songId: number) {
    await db
      .delete(userSetlistSongsTable)
      .where(
        and(
          eq(userSetlistSongsTable.bandId, bandId),
          eq(userSetlistSongsTable.userId, userId),
          eq(userSetlistSongsTable.songId, songId),
        ),
      )

    return { success: true }
  },

  async reorderUserSetlistSongs(
    bandId: number,
    userId: string,
    order: Array<{ songId: number; position: number }>,
  ) {
    await Promise.all(
      order.map(({ songId, position }) =>
        db
          .update(userSetlistSongsTable)
          .set({ position })
          .where(
            and(
              eq(userSetlistSongsTable.bandId, bandId),
              eq(userSetlistSongsTable.userId, userId),
              eq(userSetlistSongsTable.songId, songId),
            ),
          ),
      ),
    )

    return { success: true }
  },

  async listPersonalNotes(bandId: number, userId: string) {
    return db
      .select({
        id: personalNotesTable.id,
        songId: personalNotesTable.songId,
        content: personalNotesTable.content,
        createdAt: personalNotesTable.createdAt,
        songTitle: songsTable.title,
        songArtist: songsTable.artist,
        spotifyUrl: songsTable.spotifyUrl,
        youtubeUrl: songsTable.youtubeUrl,
      })
      .from(personalNotesTable)
      .innerJoin(songsTable, eq(personalNotesTable.songId, songsTable.id))
      .where(and(eq(personalNotesTable.userId, userId), eq(personalNotesTable.bandId, bandId)))
      .orderBy(asc(songsTable.title))
  },

  async getPersonalNote(bandId: number, userId: string, songId: number) {
    const [note] = await db
      .select()
      .from(personalNotesTable)
      .where(
        and(
          eq(personalNotesTable.songId, songId),
          eq(personalNotesTable.userId, userId),
          eq(personalNotesTable.bandId, bandId),
        ),
      )
      .limit(1)

    return note ?? null
  },

  async savePersonalNote(params: {
    bandId: number
    userId: string
    songId: number
    content: string
  }) {
    const { bandId, userId, songId, content } = params
    const existing = await db
      .select()
      .from(personalNotesTable)
      .where(
        and(
          eq(personalNotesTable.songId, songId),
          eq(personalNotesTable.userId, userId),
          eq(personalNotesTable.bandId, bandId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(personalNotesTable)
        .set({ content })
        .where(
          and(
            eq(personalNotesTable.songId, songId),
            eq(personalNotesTable.userId, userId),
            eq(personalNotesTable.bandId, bandId),
          ),
        )
    } else {
      await db.insert(personalNotesTable).values({ bandId, songId, userId, content })
    }

    return { success: true }
  },
}

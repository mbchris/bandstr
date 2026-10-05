# Setlist Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement repertoire song uniqueness, support repeated songs in gig setlists with occurrence badges, restrict gig song selection to master setlist songs, and provide backend CLI commands to list and deduplicate songs with foreign key remapping.

**Architecture:** Case-insensitive repertoire uniqueness enforced via `song.service.ts` validation and a partial unique PostgreSQL index; gig setlist endpoints and UI updated to track occurrences and delete specific `gigSongId` entries; non-song divider items excluded from setlist pickers; admin CLI extended with transactional reference remapping across related tables.

**Tech Stack:** TypeScript (strict), Hono, Drizzle ORM, PostgreSQL, Vue 3 Composition API, Quasar v2, Pinia, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-05-setlist-management-issue-43-design.md`](file:///Users/chris/code/prj120/bandstr/docs/superpowers/specs/2026-10-05-setlist-management-issue-43-design.md)

## Global Constraints

- Strict TypeScript typing across API, CLI, and Web packages (no `any`).
- Localization required: all new UI text must be defined in both `packages/web/src/i18n/en.ts` and `packages/web/src/i18n/de.ts`.
- Non-song items (`type !== 'song'`: pauses, tunings, set dividers, notes) must not be affected by repertoire song uniqueness constraints.
- CLI deduplication must execute within an atomic PostgreSQL transaction and resolve foreign key unique collisions gracefully.
- Existing API contracts must remain backward-compatible.

## Review Focus

1. **Title/Artist normalization**: Case differences and leading/trailing whitespace (e.g. `" Wonderwall "` vs `"wonderwall"`) must be recognized as duplicate songs.
2. **Foreign key collisions during deduplication**: If User A voted on both duplicate Song 1 and Song 2, or added both to their private setlist, remapping must merge/deduplicate without violating unique indexes.
3. **Partial index scoping**: The database unique index must apply exclusively to `is_setlist = true AND type = 'song'`, allowing multiple items of type `'pause'` or `'tuning'` and multiple songs in voting.
4. **Single-occurrence deletion in gigs**: When a song appears twice in a gig setlist, deleting one instance must not delete the second instance.
5. **Setlist builder source purity**: "Add from Repertoire" and "Setlist zusammenstellen" must strictly hide non-song dividers and non-repertoire items.

---

### Task 1: Localization Keys for Setlist Management

**Files:**
- Modify: [`packages/web/src/i18n/en.ts:350-420`](file:///Users/chris/code/prj120/bandstr/packages/web/src/i18n/en.ts)
- Modify: [`packages/web/src/i18n/de.ts:350-420`](file:///Users/chris/code/prj120/bandstr/packages/web/src/i18n/de.ts)
- Test: [`packages/web/test/setlist-occurrences.test.ts`](file:///Users/chris/code/prj120/bandstr/packages/web/test/setlist-occurrences.test.ts)

**Interfaces:**
- Consumes: None
- Produces:
  - `setlist.duplicateSongError`: Error message when adding a duplicate song to repertoire.
  - `setlist.songOccurrenceTooltip`: Tooltip text indicating repeated song occurrences in gig setlist.

- [ ] **Step 1: Write failing test for i18n keys**

```ts
import { describe, it, expect } from 'vitest'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Setlist i18n keys', () => {
  it('defines duplicateSongError and songOccurrenceTooltip in en and de', () => {
    expect(en.setlist.duplicateSongError).toBeDefined()
    expect(de.setlist.duplicateSongError).toBeDefined()
    expect(en.setlist.songOccurrenceTooltip).toBeDefined()
    expect(de.setlist.songOccurrenceTooltip).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test setlist-occurrences.test.ts`
Expected: FAIL with missing properties on `en.setlist` / `de.setlist`.

- [ ] **Step 3: Implement i18n strings in `en.ts` and `de.ts`**

Add keys under `setlist`:
- `en.ts`:
  - `duplicateSongError: 'A song with this title and artist already exists in your repertoire.'`
  - `songOccurrenceTooltip: 'This song appears {count} times in this setlist'`
- `de.ts`:
  - `duplicateSongError: 'Ein Song mit diesem Titel und Interpreten existiert bereits im Repertoire.'`
  - `songOccurrenceTooltip: 'Dieser Song ist {count}-mal in dieser Setlist'`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test setlist-occurrences.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/i18n/en.ts packages/web/src/i18n/de.ts packages/web/test/setlist-occurrences.test.ts
git commit -m "feat(i18n): add setlist duplicate and occurrence localization keys"
```

---

### Task 2: Backend Repertoire Song Uniqueness in `song.service.ts` & Schema

**Files:**
- Modify: [`packages/api/src/services/song.service.ts:80-210`](file:///Users/chris/code/prj120/bandstr/packages/api/src/services/song.service.ts)
- Modify: [`packages/api/src/db/schema/songs.ts:40-45`](file:///Users/chris/code/prj120/bandstr/packages/api/src/db/schema/songs.ts)
- Test: [`packages/api/tests/services/song-uniqueness.test.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/tests/services/song-uniqueness.test.ts)

**Interfaces:**
- Consumes: `db`, `songsTable`, `bandHasProPlan`
- Produces:
  - `findDuplicateRepertoireSong(bandId: number, title: string, artist: string, excludingSongId?: number): Promise<boolean>`
  - `songService.createSong` returns `{ error: string, status: 409 }` if duplicate repertoire song exists.
  - `songService.updateSong` returns `{ error: string, status: 409 }` if update causes duplicate in repertoire.
  - Partial unique index on `songs`: `(bandId, LOWER(TRIM(title)), LOWER(TRIM(artist))) WHERE (is_setlist = true AND type = 'song')`.

- [ ] **Step 1: Write failing unit test for repertoire song uniqueness**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { songService } from '../../src/services/song.service.js'

describe('songService repertoire uniqueness', () => {
  it('returns 409 conflict when creating duplicate song in repertoire', async () => {
    // Test creating a song with title and artist matching an existing repertoire song
  })

  it('allows duplicate title and artist if type is not song', async () => {
    // Test that pauses or tuning markers do not trigger duplicate error
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test tests/services/song-uniqueness.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement duplicate check and partial unique index**

In `packages/api/src/services/song.service.ts`:
1. Implement `findDuplicateRepertoireSong`:
   ```ts
   export async function findDuplicateRepertoireSong(
     bandId: number,
     title: string,
     artist: string,
     excludingSongId?: number,
   ): Promise<boolean> {
     const trimmedTitle = title.trim().toLowerCase()
     const trimmedArtist = artist.trim().toLowerCase()
     if (!trimmedTitle || !trimmedArtist) return false
     const [existing] = await db
       .select({ id: songsTable.id })
       .from(songsTable)
       .where(
         and(
           eq(songsTable.bandId, bandId),
           eq(songsTable.isSetlist, true),
           eq(songsTable.type, 'song'),
           sql`LOWER(TRIM(${songsTable.title})) = ${trimmedTitle}`,
           sql`LOWER(TRIM(${songsTable.artist})) = ${trimmedArtist}`,
           excludingSongId ? sql`${songsTable.id} != ${excludingSongId}` : sql`1=1`,
         ),
       )
       .limit(1)
     return Boolean(existing)
   }
   ```
2. In `createSong`: If `data.type === 'song'` and `data.isSetlist`, check `findDuplicateRepertoireSong`. If true, return `{ error: 'A song with this title and artist already exists in your repertoire.', status: 409 as const }`.
3. In `updateSong`: If resulting song has `type === 'song'` and `isSetlist === true`, check `findDuplicateRepertoireSong` excluding current `id`. If true, return `{ error: 'A song with this title and artist already exists in your repertoire.', status: 409 as const }`.
4. In `packages/api/src/db/schema/songs.ts`: Add partial unique index:
   ```ts
   uniqueIndex('songs_unique_repertoire_idx')
     .on(t.bandId, sql`lower(trim(${t.title}))`, sql`lower(trim(${t.artist}))`)
     .where(sql`is_setlist = true and type = 'song'`)
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test tests/services/song-uniqueness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/song.service.ts packages/api/src/db/schema/songs.ts packages/api/tests/services/song-uniqueness.test.ts
git commit -m "feat(api): enforce case-insensitive repertoire song uniqueness"
```

---

### Task 3: Backend CLI Commands (`list-duplicate-songs` & `delete-duplicate-songs`)

**Files:**
- Modify: [`packages/api/src/cli/admin.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/src/cli/admin.ts)
- Test: [`packages/api/tests/cli/duplicate-songs.test.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/tests/cli/duplicate-songs.test.ts)

**Interfaces:**
- Consumes: `db`, `songs`, `gigSongs`, `rehearsalSongs`, `votes`, `personalNotes`, `userSetlistSongs`, `bands`
- Produces:
  - CLI command `list-duplicate-songs`: Lists duplicate songs per band in repertoire with reference counts.
  - CLI command `delete-duplicate-songs`: Safely removes duplicate songs and remaps all foreign references to the surviving song.

- [ ] **Step 1: Write failing CLI tests**

```ts
import { describe, it, expect } from 'vitest'
import { listDuplicateSongs, deleteDuplicateSongs } from '../../src/cli/admin.js'

describe('admin CLI duplicate songs', () => {
  it('identifies duplicate repertoire songs by case-insensitive title and artist', async () => {
    // Assert duplicate detection returns expected groups
  })

  it('remaps gigSongs and deletes duplicate songs cleanly', async () => {
    // Assert references remapped and duplicates deleted
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test tests/cli/duplicate-songs.test.ts`
Expected: FAIL with functions not exported/implemented.

- [ ] **Step 3: Implement `listDuplicateSongs` and `deleteDuplicateSongs` in `admin.ts`**

1. Implement `listDuplicateSongs(options: Record<string, string | boolean>)`:
   - Parse `--band-id` (optional).
   - SQL query to find groups where `is_setlist = true` and `type = 'song'` with `COUNT(*) > 1` grouped by `band_id, LOWER(TRIM(title)), LOWER(TRIM(artist))`.
   - Query reference counts for each duplicate song ID in `gig_songs`, `rehearsal_songs`, `votes`, `personal_notes`, and `user_setlist_songs`.
   - Output structured table with `printTextTable`.
2. Implement `deleteDuplicateSongs(options: Record<string, string | boolean>)`:
   - Require `--band-id`.
   - Parse `--keep` (`'oldest'` default, or `'newest'`), `--dry-run`.
   - In a transaction (`db.transaction`):
     - For each duplicate group, select the survivor song.
     - Copy any non-null missing metadata (notes, bpm, urls, tags) to survivor.
     - For related tables:
       - `gig_songs`: Update `songId = survivor.id` where `songId IN (duplicates)`.
       - `rehearsal_songs`: Delete rows for duplicates where survivor is already linked to the rehearsal, then update remaining.
       - `votes`: Delete rows for duplicates where user already voted on survivor, then update remaining.
       - `personal_notes`: Delete rows for duplicates where user already has a note on survivor, then update remaining.
       - `user_setlist_songs`: Delete rows where user already has survivor in their setlist, then update remaining.
       - `songs`: Delete duplicate song rows.
     - If `--dry-run`, roll back or throw dry-run marker.
3. Register commands in `COMMAND_HELP`, `parseArgs` switch statement, and usage menu.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test tests/cli/duplicate-songs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/cli/admin.ts packages/api/tests/cli/duplicate-songs.test.ts
git commit -m "feat(cli): add list-duplicate-songs and delete-duplicate-songs commands"
```

---

### Task 4: Gig Setlist Granular Deletion in API

**Files:**
- Modify: [`packages/api/src/routes/gigs.ts:345-363`](file:///Users/chris/code/prj120/bandstr/packages/api/src/routes/gigs.ts)
- Test: [`packages/api/tests/routes/gigs-duplicate-songs.test.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/tests/routes/gigs-duplicate-songs.test.ts)

**Interfaces:**
- Consumes: `db`, `gigSongs`, `gigSongParamSchema`
- Produces:
  - `DELETE /gigs/:id/songs/:songId`: Supports optional query param `?gigSongId=<number>`. If supplied, deletes only that specific `gig_songs` record.

- [ ] **Step 1: Write failing route test**

```ts
import { describe, it, expect } from 'vitest'
import { gigs } from '../../src/routes/gigs.js'

describe('gigs route granular song deletion', () => {
  it('deletes only specific gigSong entry when gigSongId is provided', async () => {
    // Insert same song twice in gig, delete one by gigSongId, verify other remains
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test tests/routes/gigs-duplicate-songs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `DELETE /gigs/:id/songs/:songId` in `gigs.ts`**

Update query schema:
```ts
const deleteGigSongQuerySchema = z.object({
  gigSongId: z.coerce.number().int().positive().optional(),
})
```
Update delete handler:
```ts
gigs.delete(
  '/:id/songs/:songId',
  zValidator('param', gigSongParamSchema),
  zValidator('query', deleteGigSongQuerySchema),
  async (c) => {
    const bandId = c.get('bandId')
    const { id: gigId, songId } = c.req.valid('param')
    const { gigSongId } = c.req.valid('query')

    const gig = await getGigSetlistForBandOrNull(bandId, gigId)
    if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

    if (gigSongId) {
      await db
        .delete(gigSongs)
        .where(
          and(
            eq(gigSongs.id, gigSongId),
            eq(gigSongs.gigId, gigId),
            eq(gigSongs.bandId, bandId),
          ),
        )
    } else {
      await db
        .delete(gigSongs)
        .where(
          and(
            eq(gigSongs.gigId, gigId),
            eq(gigSongs.songId, songId),
            eq(gigSongs.bandId, bandId),
          ),
        )
    }

    return c.json({ success: true })
  },
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test tests/routes/gigs-duplicate-songs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/gigs.ts packages/api/tests/routes/gigs-duplicate-songs.test.ts
git commit -m "feat(api): support granular deletion of duplicate gig songs via gigSongId"
```

---

### Task 5: Frontend Multiple Gig Song Additions & Occurrence Exclamation Badge

**Files:**
- Modify: [`packages/web/src/pages/SetlistPage.vue:80-120, 940-965, 1110-1195, 2030-2070`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue)
- Test: [`packages/web/test/setlist-occurrences.test.ts`](file:///Users/chris/code/prj120/bandstr/packages/web/test/setlist-occurrences.test.ts)

**Interfaces:**
- Consumes: `gigSongs`, `apiJson`, `t('setlist.songOccurrenceTooltip')`
- Produces:
  - `songOccurrences` computed map: `Map<number, number>` counting song occurrences in current gig setlist.
  - Template badge: `<q-badge color="amber-9" text-color="black" rounded class="q-ml-xs">...` when occurrences > 1.
  - `removeFromSetlist`: Passes `?gigSongId=${item.gigSongId}` when deleting from a gig setlist.

- [ ] **Step 1: Write failing frontend test for occurrence counting and badge**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
// Test that songOccurrences correctly counts duplicate song entries and renders badge
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test setlist-occurrences.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement occurrence count and badge in `SetlistPage.vue`**

1. Add computed occurrence map:
   ```ts
   const gigSongOccurrences = computed(() => {
     const counts = new Map<number, number>()
     if (activeTab.value !== 'gig' || !selectedGigId.value) return counts
     for (const song of gigSongs.value) {
       if (song.type === 'song') {
         counts.set(song.id, (counts.get(song.id) || 0) + 1)
       }
     }
     return counts
   })
   ```
2. In the song item template (where `item.title` is displayed in gig view):
   ```html
   <q-badge
     v-if="selectedGigId && (gigSongOccurrences.get(item.id) ?? 0) > 1"
     color="amber-9"
     text-color="black"
     rounded
     class="q-ml-xs text-weight-bold"
   >
     <q-icon name="priority_high" size="12px" class="q-mr-xs" />
     {{ gigSongOccurrences.get(item.id) }}
     <q-tooltip>{{ t('setlist.songOccurrenceTooltip', { count: gigSongOccurrences.get(item.id) }) }}</q-tooltip>
   </q-badge>
   ```
3. Update `removeFromSetlist`:
   ```ts
   if (selectedGigId.value) {
     const gigSongId = (item as Song & { gigSongId?: number }).gigSongId
     const query = gigSongId ? `?gigSongId=${gigSongId}` : ''
     await apiJson(`/gigs/${selectedGigId.value}/songs/${item.id}${query}`, { method: 'DELETE' })
     await fetchGigSongs(selectedGigId.value)
   }
   ```
4. In `quickAddToGig(item)`: Remove check `if (gigSongs.value.some((s) => s.id === item.id)) return` so repeated additions are allowed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test setlist-occurrences.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/SetlistPage.vue packages/web/test/setlist-occurrences.test.ts
git commit -m "feat(web): display occurrence badge and allow repeated gig song additions"
```

---

### Task 6: Master Setlist Selection & Non-Song Filtering in Setlist Builder

**Files:**
- Modify: [`packages/web/src/pages/SetlistPage.vue:370-380, 1090-1175, 2370-2420`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue)
- Test: [`packages/web/test/setlist-non-song-filter.test.ts`](file:///Users/chris/code/prj120/bandstr/packages/web/test/setlist-non-song-filter.test.ts)

**Interfaces:**
- Consumes: `songsStore.songs`, `gigBuilderDraftItems`, `filteredGigBuilderSourceItems`
- Produces:
  - `masterSetlistItems`: Filtered strictly to `s.isSetlist && !s.isArchived && s.type === 'song'`.
  - `filteredGigBuilderSourceItems`: Does not exclude already added songs, allowing multiple additions in the builder.
  - `gigBuilderDraftItems`: Tracks items with unique draft IDs; syncs ordered additions to gig setlist on confirm.

- [ ] **Step 1: Write failing test for non-song exclusion and builder duplicate support**

```ts
import { describe, it, expect } from 'vitest'

describe('Setlist builder source filtering', () => {
  it('excludes pause, tuning, and note dividers from masterSetlistItems', () => {
    // Assert non-songs are excluded
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test setlist-non-song-filter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `masterSetlistItems` and Gig Builder logic in `SetlistPage.vue`**

1. Update `masterSetlistItems`:
   ```ts
   const masterSetlistItems = computed(() =>
     songsStore.songs
       .filter((s) => s.isSetlist && !s.isArchived && s.type === 'song')
       .sort((a, b) => a.position - b.position),
   )
   ```
2. In `filteredGigBuilderSourceItems`: Remove `if (draftIds.has(song.id)) return false` so items can be selected repeatedly.
3. In `addToGigBuilder(item)`: Allow appending item without uniqueness check.
4. In `removeFromGigBuilder(index)`: Remove by draft index instead of `songId` so deleting one instance does not remove other instances.
5. In `confirmGigBuilder`:
   - Sync the target gig songs by adding any new occurrences and deleting removed ones, or syncing order via `reorder` endpoint.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test setlist-non-song-filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/SetlistPage.vue packages/web/test/setlist-non-song-filter.test.ts
git commit -m "feat(web): filter non-song dividers from setlist builder and allow duplicates"
```

---

### Task 7: Full System Verification & Regression Suite

**Files:**
- Test: All test suites in `packages/api` and `packages/web`

- [ ] **Step 1: Run API typecheck and test suite**

Run:
```bash
pnpm --filter api typecheck
pnpm --filter api test
```
Expected: PASS with 0 type errors.

- [ ] **Step 2: Run Web typecheck and test suite**

Run:
```bash
pnpm --filter web typecheck
pnpm --filter web test
```
Expected: PASS with 0 type errors.

- [ ] **Step 3: Run repository linter**

Run:
```bash
pnpm lint
```
Expected: PASS with 0 errors.

- [ ] **Step 4: Update backlog acceptance criteria**

Update `docs/backlog/new-requirements.md` (or relevant backlog file) with `TASK-0228: Setlist Management (#43)` reflecting all completed criteria.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: complete setlist management verification — closes #43"
```

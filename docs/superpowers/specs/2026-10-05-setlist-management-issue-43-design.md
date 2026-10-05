# Setlist Management Design Specification (#43)

> Feature specification for [prj120/bandstr#43](https://github.com/prj120/bandstr/issues/43).

## 1. Overview & Purpose

This feature enhances band setlist management across both web and backend services:
1. Enforces uniqueness of songs (`type = 'song'`) within a band's master repertoire, preventing accidental duplicates.
2. Supports adding the same song multiple times to a Gig Setlist (e.g., opener, reprise, encore), displaying an exclamation mark badge with the occurrence count for duplicate songs.
3. Limits Gig Setlist song selection strictly to songs from the Master Setlist.
4. Excludes custom notes, pauses, set dividers, and tuning changes (`type !== 'song'`) from the "Add from Repertoire" and "Setlist zusammenstellen" selection lists.
5. Provides backend CLI maintenance commands in `packages/api/src/cli/admin.ts` to inspect duplicate songs in the repertoire per band and clean them up safely by remapping foreign keys.

---

## 2. Requirements & Behavior

### 2.1 Repertoire Song Uniqueness
- **Definition of Duplicate:** A song in a band's repertoire is considered a duplicate if another song exists in the same band with:
  - `is_setlist = true`
  - `type = 'song'`
  - `LOWER(TRIM(title)) = LOWER(TRIM(newSong.title))`
  - `LOWER(TRIM(artist)) = LOWER(TRIM(newSong.artist))`
- **Enforcement:**
  - In `song.service.ts` (`createSong`, `updateSong`, and when accepting/moving from voting to repertoire), perform a case-insensitive check against existing repertoire songs for that band.
  - If a duplicate is detected, return an HTTP `409 Conflict` with error message `"A song with this title and artist already exists in your repertoire."` (localized in the UI via `setlist.duplicateSongError`).
  - Add a partial unique index in `packages/api/src/db/schema/songs.ts` on `(band_id, LOWER(TRIM(title)), LOWER(TRIM(artist)))` WHERE `is_setlist = true AND type = 'song'`.
  - Non-song items (`type !== 'song'`, such as pauses or tuning dividers) are NOT subject to this uniqueness constraint.

### 2.2 Gig Setlist Multi-Occurrences & Exclamation Badge
- **Multiple Additions:** A song from the Master Setlist can be added multiple times to any Gig Setlist.
  - In Gig Builder modal (`showGigBuilderModal`), remove the `draftIds.has(...)` exclusion so users can add the same song multiple times.
  - In inline quick-add (`quickAddToGig`), allow adding songs that are already in `gigSongs`.
  - Draft items in the builder use unique draft IDs (`${item.id}-${crypto.randomUUID()}` or index-based IDs) to permit duplicate entries and reordering.
- **Occurrence Indicator:**
  - For each song in the current Gig Setlist, compute its occurrence count:
    `count = gigSongs.filter(s => s.id === item.id).length`
  - If `count > 1`, display an exclamation badge immediately next to the song title:
    `<q-badge color="amber-9" text-color="black" rounded class="q-ml-xs"><q-icon name="priority_high" size="xs" /> {{ count }}</q-badge>` with tooltip `"This song appears {count} times in this setlist"`.
- **Granular Deletion:**
  - When removing a song from a Gig Setlist, delete only that specific occurrence (`gig_songs.id`).
  - Endpoint `DELETE /gigs/:id/songs/:songId` is updated to accept an optional query param `?gigSongId=<number>`. If provided, it deletes strictly `WHERE id = gigSongId AND gig_id = gigId AND band_id = bandId`. If omitted, fallback to deleting by `songId`.

### 2.3 Master Setlist Selection & Filtering
- **Source Selection:** "Add from Repertoire" (inline expansion item) and "Setlist zusammenstellen" (Gig Builder modal) must only present items from the Master Setlist.
- **Non-Song Exclusion:**
  - In `masterSetlistItems` (used by Gig Builder and inline picker), filter strictly by:
    `song.isSetlist && !song.isArchived && song.type === 'song'`
  - Items with `type` equal to `'pause'`, `'tuning'`, `'note'`, `'set'`, or `'encore'` are excluded from the source song pickers.

### 2.4 Backend CLI Maintenance Tooling
Add two new commands to `packages/api/src/cli/admin.ts`:

#### Command `list-duplicate-songs`
- **Usage:**
  ```bash
  pnpm cli:admin list-duplicate-songs [--band-id <id>]
  ```
- **Behavior:**
  - Searches for repertoire songs (`is_setlist = true`, `type = 'song'`) grouped by `(band_id, LOWER(TRIM(title)), LOWER(TRIM(artist)))` having `COUNT(*) > 1`.
  - Prints a table with:
    - Band ID & Band Name
    - Duplicate Count
    - Canonical / Oldest Song ID
    - Title & Artist
    - List of Duplicate Song IDs with their creation dates
    - Reference counts across related tables (`gig_songs`, `rehearsal_songs`, `votes`, `personal_notes`, `user_setlist_songs`).

#### Command `delete-duplicate-songs`
- **Usage:**
  ```bash
  pnpm cli:admin delete-duplicate-songs --band-id <id> [--keep <oldest|newest>] [--dry-run]
  ```
- **Behavior:**
  - Finds all duplicate groups for the band.
  - Determines the surviving song (oldest by default: lowest ID / earliest `created_at`; newest if `--keep newest`).
  - Merges metadata: if the survivor has null/empty fields (e.g. `spotify_url`, `bpm`, `notes`, `thumbnail_url`), copies them from the duplicates before deletion.
  - In a single SQL transaction:
    1. `gig_songs`: Update `song_id = survivor.id` for all duplicate song references.
    2. `rehearsal_songs`: Remove duplicate relations where the rehearsal already contains the survivor song; update remaining to `survivor.id`.
    3. `votes`: Delete duplicate user votes where the user already voted on the survivor; update remaining to `survivor.id`.
    4. `personal_notes`: Delete duplicate notes where the user already has a note on the survivor; update remaining to `survivor.id`.
    5. `user_setlist_songs`: Delete duplicate entries where user setlist already contains the survivor; update remaining to `survivor.id`.
    6. `songs`: Delete the duplicate song rows.
  - If `--dry-run` is passed, logs the planned actions and rolls back the transaction.

---

## 3. Data Flow & Interfaces

### 3.1 Backend Schema & Migration
- Schema file: [`packages/api/src/db/schema/songs.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/src/db/schema/songs.ts)
- Migration: Generate Drizzle migration adding partial unique index `songs_repertoire_unique_idx` on `(band_id, LOWER(TRIM(title)), LOWER(TRIM(artist))) WHERE (is_setlist = true AND type = 'song')`.

### 3.2 API Route Updates
- [`packages/api/src/services/song.service.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/src/services/song.service.ts):
  - Add helper `findDuplicateRepertoireSong(bandId, title, artist, excludingSongId?)`.
  - Integrate uniqueness check into `createSong` and `updateSong`.
- [`packages/api/src/routes/gigs.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/src/routes/gigs.ts):
  - Extend `DELETE /:id/songs/:songId` to handle query parameter `?gigSongId=<number>`.

### 3.3 Frontend Updates
- [`packages/web/src/pages/SetlistPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue):
  - Update `masterSetlistItems` computed property to require `s.type === 'song'`.
  - Remove single-occurrence filter in `filteredGigBuilderSourceItems` and `quickAddToGig`.
  - Add `songOccurrences` computed map and render exclamation badge next to repeated songs.
  - Update `removeFromSetlist` to pass `gigSongId` when deleting from a gig setlist.
- [`packages/web/src/i18n/en.ts`](file:///Users/chris/code/prj120/bandstr/packages/web/src/i18n/en.ts) & [`packages/web/src/i18n/de.ts`](file:///Users/chris/code/prj120/bandstr/packages/web/src/i18n/de.ts):
  - Add localization strings for duplicate song error and occurrence tooltip.

---

## 4. Verification & Testing Strategy

1. **Unit & API Tests:**
   - Test duplicate song rejection in `song.service.ts` / `songs.test.ts`.
   - Test gig song addition allowing multiple occurrences and deleting a specific occurrence by `gigSongId`.
   - Test CLI commands: `list-duplicate-songs` output and `delete-duplicate-songs` reference remapping with collision resolution.
2. **Frontend Vitest Tests:**
   - Test `masterSetlistItems` excludes `type !== 'song'`.
   - Test repeated gig songs display the occurrence badge with the correct count.
3. **Typecheck & Linting:**
   - `pnpm --filter api typecheck`
   - `pnpm --filter web typecheck`
   - `pnpm lint`

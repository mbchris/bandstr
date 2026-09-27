# Usability Enhancements (GitHub Issue #28) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 12 usability improvements across Home, Voting, Setlist, Calendar, and Admin features as specified in issue #28.

**Architecture:**
- Frontend: Adjust Quasar layout wrappers in Vue 3 SFCs to resolve gutter margin overrides, refactor voting and setlist interactions with Quasar sliders (`q-slider`) and slide items (`q-slide-item`), adopt theme design tokens in print/export dialogs, and connect event time defaults.
- Backend: Migrate vote scoring to a 0–9 integer scale via a new Drizzle SQL migration and Zod schema updates; extend `bands` table with default rehearsal/gig start and end times; provide CRUD updates via `/bands/:id` endpoint and feed time defaults into event creation.

**Tech Stack:** Quasar v2, Vue 3 (Composition API `<script setup lang="ts">`), TypeScript (strict), Hono, Drizzle ORM, PostgreSQL, Vitest.

**Spec:** [GitHub Issue #28: Usability Enhancements](https://github.com/prj120/bandstr/issues/28)

---

## Global Constraints

- TypeScript strictness: Avoid `any` where typed alternatives exist; maintain strict checking across packages.
- Zero breaking changes to existing data: Existing votes on 0–3 scale must migrate linearly to 0–9 (`score * 3`).
- Clean database migrations: Migrations must run idempotently via `packages/api/src/db/migrate.ts` without breaking fresh setup.
- Quasar and mobile responsiveness: UI enhancements must work fluidly on iOS/Android native platforms (Capacitor) as well as desktop browsers.
- No commit of secrets or credentials.

---

## Review Focus

1. **Vote scale migration bounds**: Ensure votes are strictly within `0..9`, and legacy votes `0..3` correctly scale to `0, 3, 6, 9` without multiple multiplications if migration runs repeatedly.
2. **Share/Export cancellation in Capacitor**: On native iOS/Android, canceling a share sheet must not trigger negative error toasts.
3. **Setlist swipe and drag-drop coexistence**: Swiping (`q-slide-item`) and reorder dragging must not intercept each other awkwardly.
4. **Calendar event creation time defaults**: Default start/end times (`20:00` - `23:00`) must correctly apply timezone/date formatting without NaN dates when switching types.
5. **Mobile layout alignment**: On mobile widths (<600px), Home page margin and Voting filter/sort row must fit neatly without horizontal scrolling or unexpected line wraps.

---

## Proposed Tasks

### Task 1: Fix Home Page Left Border Margin Asymmetry

**Files:**
- Modify: `packages/web/src/pages/IndexPage.vue:333-338`

**Interfaces:**
- Consumes: Quasar layout `.row.q-col-gutter-lg` and `<q-page padding>`.
- Produces: Symmetrical gutter padding on Home page matching other pages.

- [ ] **Step 1: Inspect and isolate the inline margin issue**
  In `packages/web/src/pages/IndexPage.vue`, line 335 currently has:
  ```html
  <div class="row q-col-gutter-lg" style="max-width: 1200px; margin: 0 auto">
    <div class="col-12 col-md-6">
  ```
  The inline `margin: 0 auto` overrides Quasar's `.q-col-gutter-lg` negative margin (`margin-left: -24px`), causing the child column's `padding-left: 24px` to add onto the 16px page padding on the left, resulting in an asymmetrical 40px left border vs 16px right border.

- [ ] **Step 2: Separate container div from the grid row**
  Refactor the template wrapper to:
  ```html
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <div class="row q-col-gutter-lg">
        <div class="col-12 col-md-6">
  ```
  Ensure the closing tags align properly.

- [ ] **Step 3: Verify alignment and type check**
  Run: `pnpm --filter @bandstr/web typecheck`
  Expected: Success with 0 errors. Verify left and right borders are visually balanced at 16px on mobile viewports.

- [ ] **Step 4: Commit**
  ```bash
  git add packages/web/src/pages/IndexPage.vue
  git commit -m "fix(home): resolve left border margin asymmetry on home page"
  ```

---

### Task 2: Backend Vote Scale (0–9) & Event Time Defaults Schema & Migrations

**Files:**
- Modify: `packages/api/src/db/schema/songs.ts:46-64`
- Modify: `packages/api/src/db/schema/bands.ts:16-33`
- Modify: `packages/api/src/routes/votes.ts:14-20`
- Modify: `packages/api/src/routes/bands.ts:24-27`
- Modify: `packages/api/src/services/band.service.ts:146-164`
- Modify: `packages/api/src/db/migrate.ts:260-280`
- Create: `packages/api/src/db/migrations/0017_vote_scale_and_event_defaults.sql`
- Modify: `packages/api/src/db/migrations/meta/_journal.json`
- Test: `packages/api/tests/routes/votes.test.ts`
- Test: `packages/api/tests/routes/bands.test.ts`

**Interfaces:**
- Consumes: Drizzle ORM schema, Hono Zod validator.
- Produces:
  - `votes.score`: integer constrained to `0..9` (Zod `min(0).max(9)`).
  - `bands`: `defaultRehearsalStartTime`, `defaultRehearsalEndTime`, `defaultGigStartTime`, `defaultGigEndTime` (defaults `'20:00'`, `'23:00'`, `'20:00'`, `'23:00'`).

- [ ] **Step 1: Write failing tests for vote scale (0–9) and band time defaults**
  In `packages/api/tests/routes/votes.test.ts`:
  - Add test: accepts vote score of 9 (`status 201/200`).
  - Add test: rejects vote score of 10 (`status 400`).
  In `packages/api/tests/routes/bands.test.ts`:
  - Add test: updates `defaultRehearsalStartTime`, `defaultRehearsalEndTime`, `defaultGigStartTime`, `defaultGigEndTime` via `PATCH /bands/:id`.

- [ ] **Step 2: Run tests to verify failure**
  Run: `pnpm --filter @bandstr/api test`
  Expected: FAIL on score 9 (constrained to max 3) and PATCH band time defaults.

- [ ] **Step 3: Update schema and Drizzle migration**
  1. In `packages/api/src/db/schema/songs.ts`:
     Update comment on `votes.score`: `0=veto to 9=great`.
  2. In `packages/api/src/db/schema/bands.ts`:
     Add columns:
     ```ts
     defaultRehearsalStartTime: text('default_rehearsal_start_time').notNull().default('20:00'),
     defaultRehearsalEndTime: text('default_rehearsal_end_time').notNull().default('23:00'),
     defaultGigStartTime: text('default_gig_start_time').notNull().default('20:00'),
     defaultGigEndTime: text('default_gig_end_time').notNull().default('23:00'),
     ```
  3. Create `packages/api/src/db/migrations/0017_vote_scale_and_event_defaults.sql`:
     ```sql
     -- Scale existing votes from 0..3 to 0..9 (0->0, 1->3, 2->6, 3->9)
     UPDATE "votes" SET "score" = "score" * 3 WHERE "score" BETWEEN 1 AND 3;
     --> statement-breakpoint
     ALTER TABLE "bands"
       ADD COLUMN IF NOT EXISTS "default_rehearsal_start_time" text DEFAULT '20:00' NOT NULL,
       ADD COLUMN IF NOT EXISTS "default_rehearsal_end_time" text DEFAULT '23:00' NOT NULL,
       ADD COLUMN IF NOT EXISTS "default_gig_start_time" text DEFAULT '20:00' NOT NULL,
       ADD COLUMN IF NOT EXISTS "default_gig_end_time" text DEFAULT '23:00' NOT NULL;
     ```
  4. Register migration index 16 in `packages/api/src/db/migrations/meta/_journal.json`.
  5. In `packages/api/src/db/migrate.ts`:
     Add idempotent helper `ensureEventTimeDefaultsColumns()` and call it in `runMigrations()`.

- [ ] **Step 4: Update API routes and validation**
  1. In `packages/api/src/routes/votes.ts`:
     ```ts
     const voteSchema = z.object({
       songId: z.number(),
       score: z.number().int().min(0).max(9).optional(),
       comment: z.string().optional(),
       remove: z.boolean().optional(),
     })
     ```
  2. In `packages/api/src/routes/bands.ts`:
     Update `updateBandSchema`:
     ```ts
     const updateBandSchema = z.object({
       name: z.string().min(1).max(100).optional(),
       defaultRehearsalStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
       defaultRehearsalEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
       defaultGigStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
       defaultGigEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
     })
     ```
  3. In `packages/api/src/services/band.service.ts`:
     Support the new fields in `updateBand` and ensure `getBandDetails` returns them.
  4. In `packages/api/src/routes/rehearsals.ts`:
     In `/rehearsals/next` query for `upcomingGigs`, include `gigSetlistTitle: gigSetlists.title` in the select clause.

- [ ] **Step 5: Run tests and verify they pass**
  Run: `pnpm --filter @bandstr/api test`
  Expected: PASS on all tests.

- [ ] **Step 6: Commit**
  ```bash
  git add packages/api/src/db/ packages/api/src/routes/ packages/api/src/services/ packages/api/tests/
  git commit -m "feat(api): migrate vote scale to 0-9 and add event time defaults"
  ```

---

### Task 3: Voting Page Usability Overhaul

**Files:**
- Modify: `packages/web/src/pages/VotingPage.vue`
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`

**Interfaces:**
- Consumes: `/votes` API (0–9 scale), songs store.
- Produces:
  - 0–9 slider popup with red-to-green gradient and immediate commit on release (`@change`).
  - Avatar borders scaled across 0–9 (`(score / 9) * 120` hue).
  - Voting button positioned immediately right of avatar stack.
  - Avatar stack click triggers Voting Details dialog (with rank & average).
  - Removed eye icon button.
  - Removed redundant "Archive" and "Send to Setlist" item action buttons.
  - "Status Filter" and "Sort by" placed side-by-side (`col-6`) on mobile.

- [ ] **Step 1: Update vote border color calculation for 0–9 scale**
  In `packages/web/src/pages/VotingPage.vue`:
  ```ts
  function voteBorderColor(score: number | null): string {
    if (score === null) return '#9e9e9e'
    const clampedScore = Math.max(0, Math.min(9, score))
    const hue = (clampedScore / 9) * 120
    return `hsl(${hue} 80% 42%)`
  }
  ```

- [ ] **Step 2: Replace vote picker popup with 0–9 slider and immediate commit**
  1. Add slider state:
     ```ts
     const currentVoteScore = ref(5)
     function openVotePicker(song: Song) {
       if (!currentUserId.value) return
       voteSong.value = song
       const userVote = voteScore(song, currentUserId.value)
       currentVoteScore.value = userVote !== null ? userVote : 5
       showVotePicker.value = true
     }
     async function onVoteSliderCommit(val: number | null) {
       if (!voteSong.value || val === null) return
       await toggleVote(voteSong.value, val)
       showVotePicker.value = false
     }
     ```
  2. Replace dialog content in `showVotePicker`:
     Use `<q-slider v-model="currentVoteScore" :min="0" :max="9" :step="1" snap label @change="onVoteSliderCommit" class="vote-slider" />`.
     Style slider track with gradient from red (`#ef4444`) to green (`#22c55e`).
     Display active value badge with dynamic `voteBorderColor(currentVoteScore)`.

- [ ] **Step 3: Move voting button and make avatar stack open details**
  1. In `.option1-vote-row`:
     - Make `.avatar-stack` clickable: `@click="openDetailsDialog(song)" class="avatar-stack cursor-pointer ..."`
     - Place `<q-btn dense flat icon="how_to_vote" @click="openVotePicker(song)">` immediately next to `.avatar-stack`.
     - Remove `<q-btn dense flat icon="visibility" ...>` ("Eye" button).
  2. In `showDetailsDialog`:
     Ensure rank (`rankMap.get(detailsSong.id)`) and average (`detailsSong.voteAverage`) are clearly shown.

- [ ] **Step 4: Remove 'Archive' and 'Send to Setlist' buttons from actions column**
  In `.song-order-actions .song-actions`:
  - Remove `q-btn icon="arrow_forward"` (Send to Setlist).
  - Remove `q-btn icon="archive"` and `q-btn icon="unarchive"` (Archive/Reactivate).
  - Keep only `edit` and `delete` buttons.

- [ ] **Step 5: Put 'Status Filter' and 'Sort by' on one line on mobile**
  In filter bar:
  ```html
  <div class="row q-col-gutter-sm q-mb-md">
    <div class="col-12 col-sm-6">
      <q-input v-model="searchQuery" dense outlined ... />
    </div>
    <div class="col-6 col-sm-3">
      <q-select v-model="votingFilter" dense outlined ... />
    </div>
    <div class="col-6 col-sm-3">
      <q-select v-model="votingSort" dense outlined ... />
    </div>
  </div>
  ```
  Verify sorting/filtering works for both active and archived songs.

- [ ] **Step 6: Verify and typecheck**
  Run: `pnpm --filter @bandstr/web typecheck`
  Expected: PASS with 0 errors.

- [ ] **Step 7: Commit**
  ```bash
  git add packages/web/src/pages/VotingPage.vue packages/web/src/i18n/
  git commit -m "feat(voting): slider 0-9 scale, layout reordering, and remove redundant action buttons"
  ```

---

### Task 4: Setlist Active/Archive Tabs & Swipe Logic

**Files:**
- Modify: `packages/web/src/pages/SetlistPage.vue`
- Modify: `packages/web/src/stores/songs.ts` (if needed for setlist archive filter)
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`

**Interfaces:**
- Consumes: songs store (`isSetlist`, `isArchived`).
- Produces:
  - Active and Archive tabs for Master Setlist with counts.
  - Left swipe: Archive song with Undo.
  - Right swipe: Move to voting (`isSetlist: false`) with Undo; in archive tab, reactivate with Undo.
  - Removed redundant `arrow_back` ("Move to Voting") action button.

- [ ] **Step 1: Add currentTab state and computed active/archived counts**
  In `packages/web/src/pages/SetlistPage.vue`:
  ```ts
  const currentTab = ref<'active' | 'archived'>('active')
  const activeSetlistSongsCount = computed(() =>
    songsStore.songs.filter((s) => s.isSetlist && s.type === 'song' && !s.isArchived).length,
  )
  const archivedSetlistSongsCount = computed(() =>
    songsStore.songs.filter((s) => s.isSetlist && s.type === 'song' && s.isArchived).length,
  )
  ```
  Update `activeSongs` computed property to filter by `currentTab`:
  - When `currentTab === 'active'`: songs with `s.isSetlist && !s.isArchived` (plus dividers/notes).
  - When `currentTab === 'archived'`: songs with `s.isSetlist && s.isArchived`.

- [ ] **Step 2: Add tabs to Master Setlist view**
  Above the search/filter controls in Master Setlist view:
  ```html
  <q-tabs
    v-if="!selectedGigId && selectedSetlistMode === 'master'"
    v-model="currentTab"
    dense
    align="left"
    class="text-grey-7 q-mb-sm"
    active-color="primary"
    indicator-color="primary"
  >
    <q-tab name="active" :label="t('voting.activeTab')">
      <q-badge color="primary" floating rounded>{{ activeSetlistSongsCount }}</q-badge>
    </q-tab>
    <q-tab name="archived" :label="t('voting.archiveTab')">
      <q-badge color="grey-7" floating rounded>{{ archivedSetlistSongsCount }}</q-badge>
    </q-tab>
  </q-tabs>
  ```

- [ ] **Step 3: Implement swipe logic via `q-slide-item`**
  1. Wrap setlist items in `<q-slide-item>`:
     - `@left="({ reset }) => onSwipeRight(item, reset)"` (Quasar emits 'left' when dragged right):
       - If on `archived` tab: reactivates song (`isArchived: false`) with Undo toast.
       - If on `active` tab: moves to voting (`isSetlist: false`) with Undo toast.
     - `@right="({ reset }) => onSwipeLeft(item, reset)"` (Quasar emits 'right' when dragged left):
       - If on `active` tab: archives song (`isArchived: true`) with Undo toast.
  2. Guard dividers/pauses/tuning from swipe actions (or ignore non-song items).
  3. Remove the redundant `arrow_back` ("Move to Voting") button from song action buttons.

- [ ] **Step 4: Verify and typecheck**
  Run: `pnpm --filter @bandstr/web typecheck`
  Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/web/src/pages/SetlistPage.vue packages/web/src/i18n/
  git commit -m "feat(setlist): add active/archive tabs and swipe actions"
  ```

---

### Task 5: Setlist XLSX Download Cancellation Handling & Print/Export Design + Duration

**Files:**
- Modify: `packages/web/src/utils/export.ts`
- Modify: `packages/web/src/pages/SetlistPage.vue`
- Modify: `packages/web/src/pages/VotingPage.vue`

**Interfaces:**
- Consumes: `CapacitorShare`, `jspdf`, `docx`, `xlsx`.
- Produces:
  - Silent share cancellation (no error toast when user dismisses share sheet).
  - Print & Export modal adopting bandstr dark/widget design styling.
  - Duration per song and total duration sum visible on print sheet and in exports.

- [ ] **Step 1: Handle cancellation gracefully in `utils/export.ts`**
  In `packages/web/src/utils/export.ts`:
  Add helper:
  ```ts
  export function isShareCancellation(error: any): boolean {
    if (!error) return false
    const msg = (error.message || error.toString() || '').toLowerCase()
    return error.name === 'AbortError' || msg.includes('cancel') || msg.includes('abort')
  }
  ```
  In `saveOrShareFile` and `exportXlsx`: catch error and if `isShareCancellation(error)`, return without throwing.
  In `SetlistPage.vue` and `VotingPage.vue`: in the XLSX export catch block, check `if (!isShareCancellation(e)) $q.notify(...)`.

- [ ] **Step 2: Restyle Print & Export dialog with bandstr design tokens**
  In `packages/web/src/pages/SetlistPage.vue`:
  - Replace stark unstyled `bg-white / bg-grey-3` modal containers with `bg-surface` / `bg-widget-surface` for toolbar and preview background.
  - Ensure `@media print` retains black-on-white high contrast for clean paper printing.

- [ ] **Step 3: Add duration per song and sum of duration to Print & Export**
  1. Default `selectedExportColumns.length = true`.
  2. In printable table:
     - Ensure duration column shows `formatDuration(item.lengthMs)` for each song.
  3. In print sheet footer / header summary:
     - Add: `Total Duration: {{ formatDuration(totalDurationMs) }}` next to `Total Songs: {{ ... }}`.
  4. In `exportPdf` and `exportDocx`:
     - Add total duration sum to metadata/footer section of exported documents.

- [ ] **Step 4: Verify and typecheck**
  Run: `pnpm --filter @bandstr/web typecheck`
  Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/web/src/utils/export.ts packages/web/src/pages/SetlistPage.vue packages/web/src/pages/VotingPage.vue
  git commit -m "fix(setlist): handle xlsx cancellation silently and upgrade print-export design with duration sum"
  ```

---

### Task 6: Calendar Linked Setlist Name, Dialog Sizing & Event Time Defaults

**Files:**
- Modify: `packages/web/src/pages/AdminPage.vue`
- Modify: `packages/web/src/pages/CalendarPage.vue`
- Modify: `packages/web/src/stores/auth.ts`
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`

**Interfaces:**
- Consumes: Band settings (`defaultRehearsalStartTime`, `defaultRehearsalEndTime`, `defaultGigStartTime`, `defaultGigEndTime`), Gig Setlists.
- Produces:
  - Admin section for configuring default start and end times for Rehearsals and Gigs.
  - Calendar event modal uses band time defaults when creating events.
  - Calendar event select box properly maps and displays the linked Gig Setlist by name.
  - Calendar Day View displays linked Gig Setlist name.
  - Calendar event dialog size decreased by ~30% with top spacing to keep app title visible.

- [ ] **Step 1: Add Event Defaults section to AdminPage**
  In `packages/web/src/pages/AdminPage.vue`:
  - Add card: "Event Time Defaults"
  - Inputs for:
    - Default Rehearsal Start (`defaultRehearsalStartTime`, default '20:00')
    - Default Rehearsal End (`defaultRehearsalEndTime`, default '23:00')
    - Default Gig Start (`defaultGigStartTime`, default '20:00')
    - Default Gig End (`defaultGigEndTime`, default '23:00')
  - "Save Defaults" button calling `PATCH /bands/:id`.
  - Update `authStore.activeBand` with saved defaults.

- [ ] **Step 2: Fix Gig Setlist name display in CalendarPage**
  In `packages/web/src/pages/CalendarPage.vue`:
  - Populate `filteredGigSetlistOptions.value = gigSetlistOptions.value` on initialization and whenever `gigSetlistOptions` updates.
  - In `editEvent`: await or ensure setlists are fetched so `q-select` immediately maps `form.gigSetlistId` to title.
  - In Day View (`showDayViewModal`), if `event.type === 'gig' && (event.gigSetlistTitle || event.gigSetlistId)`:
    Display linked setlist name with `queue_music` icon.

- [ ] **Step 3: Adjust Gig Setlist / Event Dialog sizing and top spacing**
  In `packages/web/src/pages/CalendarPage.vue`:
  - Update `<q-dialog v-model="showEventModal">`:
    Set card style: `style="width: 90vw; max-width: 380px; margin-top: 60px; max-height: calc(100vh - 80px)"`.
    (Reduces width from 450px by ~30% to ~380px/90vw and offsets 60px from top so app toolbar and title remain visible).

- [ ] **Step 4: Use new Time defaults when creating calendar entries**
  In `packages/web/src/pages/CalendarPage.vue`:
  - In `openModal(year, month, day)`:
    Read defaults from `authStore.activeBand`:
    ```ts
    const rStart = authStore.activeBand?.defaultRehearsalStartTime || '20:00'
    const rEnd = authStore.activeBand?.defaultRehearsalEndTime || '23:00'
    const [startH, startM] = rStart.split(':').map(Number)
    const [endH, endM] = rEnd.split(':').map(Number)
    const start = new Date(year, month, day, startH, startM)
    const end = new Date(year, month, day, endH, endM)
    ```
  - When `form.type` changes and `!editingEvent.value`:
    If switched to `'gig'`: apply `defaultGigStartTime` and `defaultGigEndTime`.
    If switched to `'rehearsal'`: apply `defaultRehearsalStartTime` and `defaultRehearsalEndTime`.

- [ ] **Step 5: Verify and typecheck**
  Run: `pnpm --filter @bandstr/web typecheck`
  Run: `pnpm --filter @bandstr/api test`
  Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**
  ```bash
  git add packages/web/src/pages/AdminPage.vue packages/web/src/pages/CalendarPage.vue packages/web/src/i18n/ packages/web/src/stores/
  git commit -m "feat(calendar): display linked setlist name, resize dialog with top spacing, and apply admin event defaults"
  ```

---

## Verification Plan

### Automated Tests
1. **API test suite**:
   ```bash
   pnpm test
   ```
   Validates vote scale (0..9 valid, >9 rejected), band defaults PATCH, migrations, calendar endpoints.
2. **Web Typecheck**:
   ```bash
   pnpm --filter @bandstr/web typecheck
   ```
   Ensures strict TypeScript compliance across all Vue components and stores.

### Manual Verification
1. **Home Page**:
   - Open Home on mobile viewport (e.g. 390px iPhone). Verify left and right card margins are equal (no extra 24px left gap).
2. **Voting**:
   - Tap avatar stack: verify "Voting Details" modal opens with average and rank.
   - Tap voting button next to avatar stack: verify slider popup opens from 0 (red) to 9 (green).
   - Drag and release slider: verify vote commits immediately and modal closes.
   - Check song actions: verify "Send to Setlist" and "Archive" buttons are gone.
   - On mobile: verify "Status Filter" and "Sort by" sit side-by-side on the same line.
3. **Setlist**:
   - View Master Setlist: toggle between Active and Archived tabs.
   - On Active: swipe left to archive; swipe right to move to voting. Verify Undo toast works.
   - On Archived: swipe right to reactivate.
   - Download XLSX: simulate cancellation and verify no negative toast appears.
   - Print & Export: open modal, check bandstr dark/widget styling, verify song duration and sum of duration.
4. **Calendar & Admin**:
   - In Admin: set Rehearsal default to 19:30 - 22:30 and Gig default to 21:00 - 01:00. Save.
   - In Calendar: click a date to create an event. Verify start/end times default to 19:30 - 22:30. Switch type to Gig: verify times update to 21:00 - 01:00.
   - Check Event Dialog: verify width is compact (~30% smaller) and app header/title is visible above it.
   - Assign linked Gig Setlist: verify the dropdown displays the title of the setlist, not its numeric ID.
   - In Day View: verify linked Gig Setlist name is displayed.

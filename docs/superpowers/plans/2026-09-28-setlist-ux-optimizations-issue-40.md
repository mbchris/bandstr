# Setlist Management UX Optimizations — Updated Plan (v2)

> **Supersedes** the [previous plan](https://github.com/prj120/bandstr/issues/40#issuecomment-5878793393) based on [UX feedback](https://github.com/prj120/bandstr/issues/40#issuecomment-5879494458).

## What changed and why

The horizontal chip bar for list selection (Repertoire / User Setlist / gig chips) was implemented but **doesn't scale** — with many gigs the bar becomes endless horizontal scrolling, worse than the original dropdown. The comment proposes a structural flip:

| Aspect | Previous design | New design |
|---|---|---|
| **Top-level navigation** | Horizontal chip bar with all options (Repertoire, User Setlist, all gigs) | Three fixed tabs: **Repertoire**, **Gig Setlists**, **User Setlist** |
| **Active/Archive scope** | `SegmentedControl` only on Repertoire (master setlist) | Status filter (Active / Archive / All) on **all three tabs** + Voting page |
| **Gig selection** | Chip per gig in the horizontal bar | Gig tab shows a **vertical list** of gigs; tap to open; swipe to archive/unarchive |
| **Voting page** | Already has Active/Archive `SegmentedControl` | Same pattern — already aligned ✓ |

## Current state (post chip-bar implementation)

- `selectedListOption` ref drives all list switching (`'master'` / `'user'` / `'gig:<id>'` / `'new_gig'`)
- `listOptions` computed builds chip labels from `gigs.value`
- `currentTab` ref (`'active' | 'archived'`) + `SegmentedControl` — only rendered when `!selectedGigId && selectedSetlistMode === 'master'`
- Swipe on songs: left→right = move to voting (active) or restore (archived); right→left = archive (active only)
- Voting page already has `SegmentedControl` with Active/Archive and identical swipe pattern

## Architecture

Front-end only. No new API endpoints. `isArchived` exists on songs. **Check:** does the `gigs` table / schema have an `isArchived` column? If not, add migration.

**Tech Stack:** Vue 3 Composition API · Quasar v2 · TypeScript · `useI18n`

## Global Constraints

- i18n keys in both `en.ts` and `de.ts`
- Quasar components only
- TypeScript strict — no `any`
- Targeted edits in SFCs

---

## Task 1: Add new i18n strings

**Files:** `packages/web/src/i18n/en.ts`, `packages/web/src/i18n/de.ts`

- [ ] **Step 1: Add keys to `en.ts`** — setlist block:
  ```ts
  tabRepertoire: 'Repertoire',
  tabGigSetlists: 'Gig Setlists',
  tabUserSetlist: 'My Setlist',
  statusAll: 'All',
  archiveGig: 'Archive gig',
  unarchiveGig: 'Restore gig',
  noGigs: 'No gig setlists',
  gigArchivedNamed: '"{title}" archived',
  gigRestoredNamed: '"{title}" restored',
  ```
  Note: `buildSetlist`, `collapseGigMeta`, `expandGigMeta`, `addToGigQuick`, `activeTab`, `archiveTab` already exist.

- [ ] **Step 2: Add same keys to `de.ts`**

- [ ] **Step 3: Verify** — `pnpm --filter web typecheck`

- [ ] **Step 4: Commit**
  ```bash
  git commit -m "fix(i18n): add new setlist UX keys — closes #40 (1/5)"
  ```

---

## Task 2: Spotify-URL-first quick-add form

*(Unchanged from previous plan)*

**Problem:** "Add Song" dialog puts Spotify URL field below title/artist, forcing scroll.

**Files:** `packages/web/src/pages/SetlistPage.vue` — `showAddSongModal` dialog template

- [ ] **Step 1: Reorder dialog fields** — move Spotify URL row + lookup button to **first** child

- [ ] **Step 2: Verify** — paste Spotify URL → auto-fill without scrolling

- [ ] **Step 3: Commit**
  ```bash
  git commit -m "feat(setlist): move Spotify URL field to top of add-song dialog — closes #40 (2/5)"
  ```

---

## Task 3: Replace chip bar with three fixed tabs + universal status filter

**Problem:** Chip bar with all gigs doesn't scale. Replace with three fixed tabs and move Active/Archive to a status filter on all tabs.

**Files:** `packages/web/src/pages/SetlistPage.vue` — template (chip bar, SegmentedControl) + script (`selectedListOption`, `currentTab`, `listOptions`, `activeSongs`)

### Part A: Three fixed tabs

- [ ] **Step 1: Add `activeTab` ref**
  ```ts
  const activeTab = ref<'repertoire' | 'gig' | 'user'>('repertoire')
  ```

- [ ] **Step 2: Replace the horizontal chip bar** (lines ~1525-1549) with `q-tabs`:
  ```html
  <q-tabs v-model="activeTab" dense class="text-primary q-mb-sm" align="left" narrow-indicator>
    <q-tab name="repertoire" :label="t('setlist.tabRepertoire')" />
    <q-tab name="gig" :label="t('setlist.tabGigSetlists')" />
    <q-tab name="user" :label="t('setlist.tabUserSetlist')" />
  </q-tabs>
  ```

- [ ] **Step 3: Wire `activeTab` to existing `selectedListOption` / `selectedSetlistMode`**

  Watch `activeTab` and update accordingly:
  ```ts
  watch(activeTab, (tab) => {
    if (tab === 'repertoire') selectedListOption.value = 'master'
    else if (tab === 'user') selectedListOption.value = 'user'
    // gig tab: don't auto-select a gig; show gig list instead
    else if (tab === 'gig') {
      selectedGigId.value = null
      selectedSetlistMode.value = 'master'
    }
  })
  ```

### Part B: Universal status filter

- [ ] **Step 4: Extend `currentTab` to include `'all'`** or add a separate `statusFilter` ref:
  ```ts
  const statusFilter = ref<'active' | 'archived' | 'all'>('active')
  ```
  Replace the existing `SegmentedControl` (only on Repertoire) with a `SegmentedControl` / `q-btn-toggle` visible on **all three tabs**:
  ```html
  <SegmentedControl
    v-model="statusFilter"
    :options="[
      { label: t('setlist.activeTab'), value: 'active' },
      { label: t('setlist.archiveTab'), value: 'archived' },
      { label: t('setlist.statusAll'), value: 'all' },
    ]"
  />
  ```
  Remove the `v-if="!selectedGigId && selectedSetlistMode === 'master'"` condition so it shows everywhere.

- [ ] **Step 5: Update `activeSongs` computed** — apply `statusFilter` on all tabs, not just Repertoire:
  ```ts
  const activeSongs = computed(() => {
    if (activeTab.value === 'gig' && selectedGigId.value) return gigSongs.value
    if (activeTab.value === 'user') {
      let songs = userSetlistSongs.value
      if (statusFilter.value !== 'all') {
        songs = songs.filter(s => statusFilter.value === 'archived' ? s.isArchived : !s.isArchived)
      }
      return songs
    }
    // Repertoire
    let songs = songsStore.songs.filter(s => s.isSetlist)
    if (statusFilter.value === 'archived') {
      return songs.filter(s => s.type === 'song' && s.isArchived)
    } else if (statusFilter.value === 'active') {
      return songs.filter(s => s.type !== 'song' || !s.isArchived)
    }
    return songs // 'all'
  })
  ```

- [ ] **Step 6: Update swipe handlers and drag-and-drop guards** — replace `currentTab` references with `statusFilter`.

- [ ] **Step 7: Verify** — status filter visible on all tabs; archive/active/all filtering works; swipe directions unchanged.

- [ ] **Step 8: Commit**
  ```bash
  git commit -m "feat(setlist): three fixed tabs + universal status filter — closes #40 (3/5)"
  ```

---

## Task 4: Gig Setlists tab — vertical list with swipe-to-archive

**Problem:** Gig selection needs to work at scale. Show a vertical list of gigs (filtered by status). Tap to open; swipe to archive/unarchive.

**Files:**
- `packages/web/src/pages/SetlistPage.vue` — gig tab template + script
- Possibly: `packages/api/src/routes/gigs.ts`, `packages/shared/` — if `isArchived` is missing on gig schema

### Part A: Schema check

- [ ] **Step 1: Check gig schema for `isArchived`** — if missing, add column + migration + update shared types.

### Part B: Gig list UI

- [ ] **Step 2: Add `filteredGigs` computed**
  ```ts
  const filteredGigs = computed(() => {
    if (statusFilter.value === 'all') return gigs.value
    return gigs.value.filter(g =>
      statusFilter.value === 'archived' ? g.isArchived : !g.isArchived
    )
  })
  ```

- [ ] **Step 3: Render gig list when `activeTab === 'gig'` and no gig selected**
  ```html
  <div v-if="activeTab === 'gig' && !selectedGigId">
    <q-list v-if="filteredGigs.length" separator>
      <q-slide-item
        v-for="gig in filteredGigs"
        :key="gig.id"
        :left-color="gig.isArchived ? 'positive' : 'primary'"
        @left="({ reset }) => toggleGigArchive(gig, reset)"
      >
        <template #left>
          <q-icon :name="gig.isArchived ? pIcon('replay') : pIcon('inventory_2')" size="28px" />
        </template>
        <q-item clickable @click="selectGig(gig.id)">
          <q-item-section>
            <q-item-label>{{ gig.title || t('setlist.untitledGig') }}</q-item-label>
            <q-item-label caption>{{ formatGigDate(gig) }} · {{ gig.location }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" />
          </q-item-section>
        </q-item>
      </q-slide-item>
    </q-list>
    <div v-else class="text-grey text-italic text-center q-pa-lg">
      {{ t('setlist.noGigs') }}
    </div>
  </div>
  ```

- [ ] **Step 4: Add `toggleGigArchive` and `selectGig` functions**
  ```ts
  async function toggleGigArchive(gig: Gig, reset: () => void) {
    try {
      await apiJson(`/gigs/${gig.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !gig.isArchived }),
      })
      await fetchGigs()
      $q.notify({
        message: gig.isArchived
          ? t('setlist.gigRestoredNamed', { title: gig.title })
          : t('setlist.gigArchivedNamed', { title: gig.title }),
        color: 'positive',
        timeout: 3000,
      })
    } catch {
      $q.notify({ message: t('common.error'), color: 'negative' })
    } finally {
      reset()
    }
  }

  function selectGig(gigId: number) {
    selectedListOption.value = `gig:${gigId}`
  }
  ```

- [ ] **Step 5: Keep "New Gig" button** — move from chip bar to a `q-btn` in the top icon row or at the bottom of the gig list.

- [ ] **Step 6: Add a back button** when viewing a gig's songs to return to the gig list.

- [ ] **Step 7: Verify** — gig list renders; status filter works; swipe archives/restores; tapping opens gig setlist; back button returns to list.

- [ ] **Step 8: Commit**
  ```bash
  git commit -m "feat(setlist): vertical gig list with swipe-to-archive — closes #40 (4/5)"
  ```

---

## Task 5: Consistent top icon alignment + collapsible gig meta

**Problem 1:** Top icons may shift between tabs. Ensure consistent positioning.
**Problem 2:** Gig meta form takes too much space. Make it collapsible.

**Files:** `packages/web/src/pages/SetlistPage.vue` — top header section + gig meta section

### Part A: Icon alignment

- [ ] **Step 1: Standardize top icon bar** — same row structure across all three tabs. Conditional buttons (note_add, build, add-to-user) append to the right, never shift the common buttons.
  ```html
  <div class="row items-center justify-between no-wrap">
    <div class="text-h5 text-weight-bold">{{ t('setlist.heading') }}</div>
    <div class="row q-gutter-sm items-center no-wrap">
      <!-- Always present: -->
      <q-btn flat round icon="print" ... />
      <q-btn flat round icon="download" ... />
      <!-- Conditional, appended: -->
      <q-btn v-if="showNoteAdd" flat round icon="note_add" ... />
      <q-btn v-if="showAddSong" ... icon="add" ... />
    </div>
  </div>
  ```

### Part B: Collapsible gig meta

- [ ] **Step 2: Add `gigMetaExpanded` ref** — `ref(false)`, collapsed by default.

- [ ] **Step 3: Wrap gig meta form** — always-visible summary row (title + date + location + expand icon), `q-slide-transition` for the full form. Stats line always visible.

- [ ] **Step 4: Add inline "Add from Repertoire" expansion panel** below gig song list with `quickAddToGig` function.

- [ ] **Step 5: Verify** — icons don't shift between tabs; gig meta collapses/expands; quick-add works; drag-and-drop still works.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(setlist): consistent icon alignment + collapsible gig meta — closes #40 (5/5)"
  ```

---

## Voting page note

The Voting page **already has** Active/Archive `SegmentedControl` and swipe-to-archive. The only change needed: add an **"All"** option to the existing `votingTabOptions` to match the new three-way status filter pattern on the Setlist page. This can be done as part of Task 3 or as a small follow-up.


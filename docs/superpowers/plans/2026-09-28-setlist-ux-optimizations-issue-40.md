# Setlist Management UX Optimizations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the Setlist Page so that adding repertoire songs, selecting/switching gig setlists, managing gig metadata, and reordering songs all require the minimum number of taps.

**Architecture:** All changes are purely front-end within `SetlistPage.vue` and its i18n files — no new API routes required. The page already has all necessary data (`gigs`, `gigSongs`, `filteredSongs`, drag-reorder, `selectedGigMeta`). We rearrange and replace UI widgets to cut friction without touching the data layer.

**Tech Stack:** Vue 3 Composition API · Quasar v2 · TypeScript · `useI18n` (custom)

**Spec:** GitHub issue https://github.com/prj120/bandstr/issues/40

## Global Constraints

- All UI text added or changed must have keys in both `packages/web/src/i18n/en.ts` and `packages/web/src/i18n/de.ts`
- Quasar components only — no third-party drag-library (native HTML5 drag + touch already implemented)
- No new API endpoints; all data already available in existing store / refs
- TypeScript strict — no `any` except where the existing code already uses it
- Single-file component — `SetlistPage.vue` stays one file (2 682 lines currently); targeted edits only

## Review Focus

- **Empty gig list:** Gig tab bar / chip list renders gracefully when `gigs.value` is empty — no crash, shows only "Repertoire" chip.
- **Spotify URL auto-fill focus:** After pasting a Spotify URL into the inline quick-add form, the Spotify lookup fires automatically and the cursor moves to the title field so the user can confirm without extra clicks.
- **Gig meta collapse on desktop:** Collapsible gig meta panel remembers its open/closed state across gig switches within the same session — does not re-open when switching between gigs.
- **Drag-and-drop during search:** With `searchQuery` non-empty, drag handles are visually disabled (opacity 0.3, cursor default) and `onDragStart` already returns early — verify no reorder mutation fires.
- **`setlist.buildSetlist` i18n key:** The key is used on line 1470 of `SetlistPage.vue` but is absent from both locale files — the button currently renders the raw key string. Must be added in Task 1.

---

## Task 1: Fix missing i18n key + add new i18n strings

**Files:**
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`

**Interfaces:**
- Produces: string keys `setlist.buildSetlist`, `setlist.gigTabAll`, `setlist.addToGigQuick`, `setlist.collapseGigMeta`, `setlist.expandGigMeta` — consumed by Tasks 2, 3, 4.

- [ ] **Step 1: Add missing and new keys to `en.ts`**

  In the `setlist` block, add:
  ```ts
  buildSetlist: 'Build Setlist',
  gigTabAll: 'Repertoire',
  addToGigQuick: 'Add to Setlist',
  collapseGigMeta: 'Hide gig details',
  expandGigMeta: 'Show gig details',
  spotifyUrlLabel: 'Spotify URL',
  addSongQuickTitle: 'Add Song',
  ```

- [ ] **Step 2: Add the same keys to `de.ts`**

  ```ts
  buildSetlist: 'Setlist zusammenstellen',
  gigTabAll: 'Repertoire',
  addToGigQuick: 'Zur Setlist hinzufügen',
  collapseGigMeta: 'Gig-Details ausblenden',
  expandGigMeta: 'Gig-Details einblenden',
  spotifyUrlLabel: 'Spotify URL',
  addSongQuickTitle: 'Song hinzufügen',
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `pnpm --filter web typecheck` (or `pnpm -F web build --dry-run`)
  Expected: no type errors

- [ ] **Step 4: Commit**

  ```bash
  git add packages/web/src/i18n/en.ts packages/web/src/i18n/de.ts
  git commit -m "fix(i18n): add missing setlist.buildSetlist and new UX keys — closes #40 (1/4)"
  ```

---

## Task 2: Spotify-URL-first quick-add form (inline, no scroll required)

**Problem:** The "Add new songs to Master Setlist" dialog puts the Spotify URL field after the title/artist fields, requiring the user to scroll down before paste.

**Files:**
- Modify: `packages/web/src/pages/SetlistPage.vue` — dialog template starting at line 1907 (`showAddSongModal` dialog), script section `addSongForm` ref and `openAddSongModal`.

**Interfaces:**
- Consumes: `addSongForm`, `addSongLengthInput`, `lookupSpotifyForAdd(force: boolean): Promise<void>`, `onAddSpotifyPaste()`, `submitAddSong()`, `isSaving`, `atSetlistLimit`, `authStore.isFreePlan` — all already defined.
- Produces: no new exported interfaces; dialog reordered in-place.

- [ ] **Step 1: Write E2E-style manual test note (no automated test needed — UI-only reorder)**

  Acceptance check: Open the "Add Song" dialog on a master setlist. The **first** visible input is "Spotify URL". Paste a Spotify link → title and artist auto-fill. Submit without scrolling.

- [ ] **Step 2: Reorder the dialog fields in `showAddSongModal` dialog**

  In the `<q-card-section class="q-gutter-md">` block (lines 1915–1976), move the Spotify URL row + lookup button to be the **first** child, above `<q-input ... title>`. Keep everything else in existing order (title, artist, length, bpm, youtube, pitch, notes, tags).

  The new field order inside the card-section:
  1. Spotify row (URL input + Lookup button) ← moved up
  2. Lookup error
  3. Title (`autofocus`)
  4. Artist
  5. Length
  6. BPM
  7. YouTube URL
  8. Pitch slider
  9. Notes textarea
  10. Tags select

- [ ] **Step 3: Verify dialog renders correctly and Spotify auto-lookup still fires on paste**

  Manual check: open dialog, paste a Spotify URL, observe title/artist auto-fill.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/web/src/pages/SetlistPage.vue
  git commit -m "feat(setlist): move Spotify URL field to top of add-song dialog — closes #40 (2/4)"
  ```

---

## Task 3: Replace gig dropdown with a horizontal chip/tab bar for fast gig selection

**Problem:** The `q-select` dropdown for choosing gig setlists is not efficient — users must open it, scroll, click. Replace with a horizontally scrollable chip bar that shows all gigs as chips, allowing one-tap switching.

**Files:**
- Modify: `packages/web/src/pages/SetlistPage.vue` — template lines 1496–1537 (the `q-select` for `selectedListOption`), script section.

**Interfaces:**
- Consumes: `listOptions` computed, `selectedListOption` ref, `gigs` ref, `t()` — already defined.
- Produces: same `selectedListOption` binding; no signature change.

- [ ] **Step 1: Add `gigBarVisible` computed and `scrollGigBar` helper to script**

  ```ts
  // No new refs needed — selectedListOption drives selection.
  // We keep listOptions as the data source.
  ```

  The chip bar renders the same `listOptions` items (Repertoire, User Setlist, gigs…). "New Gig" entry becomes a `+` icon chip at the end.

- [ ] **Step 2: Replace the `q-select` block (lines 1506–1537) with a scrollable chip row**

  Replace the entire `<div :class="...">` containing the `q-select` with:

  ```html
  <div class="gig-chip-bar q-mb-md">
    <q-chip
      v-for="opt in listOptions.filter(o => o.value !== 'new_gig')"
      :key="opt.value"
      :selected="selectedListOption === opt.value"
      clickable
      color="primary"
      text-color="white"
      :outline="selectedListOption !== opt.value"
      @click="selectedListOption = opt.value"
    >
      {{ opt.label }}
    </q-chip>
    <q-chip
      clickable
      icon="add"
      color="positive"
      text-color="white"
      outline
      @click="selectedListOption = 'new_gig'"
    >
      {{ t('setlist.newGigSetlist') }}
    </q-chip>
  </div>
  ```

  Add CSS to `<style>` section:
  ```scss
  .gig-chip-bar {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 4px;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
  ```

- [ ] **Step 3: Verify gig switching works (select a gig → song list updates)**

  Manual check: click a gig chip → `selectedGigId` updates → `gigSongs` loads → song list changes.

- [ ] **Step 4: Verify "New Gig" chip triggers `createGigSetlist` via the existing `watch(selectedListOption, ...)`**

  The existing watcher already handles `value === 'new_gig'` — no watcher change needed.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/web/src/pages/SetlistPage.vue
  git commit -m "feat(setlist): replace gig dropdown with scrollable chip bar — closes #40 (3/4)"
  ```

---

## Task 4: Collapsible gig meta panel + one-click "add from repertoire" in gig view

**Problem 1:** When a gig is selected, the gig meta form (title, date, location, calendar link, notes) takes significant screen space and requires scrolling past it to reach the song list. Make it collapsible.

**Problem 2:** In gig setlist view, adding songs from the Repertoire currently requires opening the "Build Setlist" modal. Add an inline quick-add button directly on each Repertoire song row when viewing a gig setlist (i.e., in the master-panel side-by-side view, or via a floating action-style shortcut that taps directly into `addToGigBuilder`).

**Files:**
- Modify: `packages/web/src/pages/SetlistPage.vue` — script section (add `gigMetaExpanded` ref), template lines 1567–1629 (gig meta panel), and the gig builder source list (lines 2009–2036).

**Interfaces:**
- Consumes: `selectedGigId`, `selectedGigMeta`, `saveGigMeta()`, `deleteGigSetlist()`, `duplicateGigSetlist()`, `gigBuilderDraftItems`, `addToGigBuilder(item: Song)`, `gigSongs` — all already defined.
- Produces: `gigMetaExpanded: Ref<boolean>` (new, module-level so it survives gig switches within session).

- [ ] **Step 1: Add `gigMetaExpanded` ref to script (after the `selectedGigMeta` ref)**

  ```ts
  const gigMetaExpanded = ref(false) // collapsed by default
  ```

- [ ] **Step 2: Wrap the gig meta form in a collapsible header**

  Replace the opening `<div v-if="selectedGigId && selectedGigMeta" class="q-mb-md ...">` block (lines 1567–1629) with:

  ```html
  <div v-if="selectedGigId && selectedGigMeta" class="q-mb-md">
    <!-- Collapsed header: always visible -->
    <div class="row items-center q-gutter-xs cursor-pointer" @click="gigMetaExpanded = !gigMetaExpanded">
      <span class="text-weight-bold text-subtitle2">{{ selectedGigMeta.title }}</span>
      <span v-if="selectedGigMeta.gigDate" class="text-caption text-grey-7">· {{ selectedGigMeta.gigDate }}</span>
      <span v-if="selectedGigMeta.location" class="text-caption text-grey-7">· {{ selectedGigMeta.location }}</span>
      <q-space />
      <q-btn flat round dense :icon="gigMetaExpanded ? 'expand_less' : 'expand_more'" size="sm"
             :title="gigMetaExpanded ? t('setlist.collapseGigMeta') : t('setlist.expandGigMeta')"
             @click.stop="gigMetaExpanded = !gigMetaExpanded" />
    </div>

    <!-- Expanded panel: existing form fields -->
    <q-slide-transition>
      <div v-if="gigMetaExpanded" class="q-mt-sm q-pa-md rounded-borders bg-widget-surface border-subtle">
        <!-- ... existing rows of fields (title, calendarEventId, location, date, time, notes, actions) ... -->
      </div>
    </q-slide-transition>

    <!-- Stats line always visible -->
    <div class="text-caption text-grey-7 q-mt-xs">
      Songs: {{ songCount }} · Total length: {{ formatTotalDuration(totalDurationMs) }}
    </div>
  </div>
  ```

  Move the existing form rows and action buttons inside the `v-if="gigMetaExpanded"` div. Keep the `<div v-else class="text-caption ...">` (line 1630) for the non-gig stats line.

- [ ] **Step 3: Add a "Quick Add to Gig" button on each master-setlist song row in the Gig Builder source list**

  In the gig builder source list (`lines 2024–2035`), the `<q-btn ... library_add>` already exists — this is correct and no change needed here. The UX problem is that users must *open* the builder first.

  Instead, add a persistent "Repertoire" sidebar or footer shortcut only when `selectedGigId` is set: below the song list (`<q-list>`), add a collapsible "Add from Repertoire" expansion panel:

  ```html
  <q-expansion-item
    v-if="selectedGigId"
    icon="library_add"
    :label="t('setlist.gigTabAll')"
    class="q-mt-md"
    header-class="text-primary text-weight-medium"
  >
    <q-card flat>
      <q-card-section class="q-pa-sm">
        <q-input v-model="gigBuilderSearch" dense outlined clearable :placeholder="t('setlist.filterTitle')">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <q-list v-if="filteredGigBuilderSourceItems.length" separator class="q-mt-sm">
          <q-item v-for="item in filteredGigBuilderSourceItems" :key="`inline-add-${item.id}`" dense>
            <q-item-section>
              <q-item-label>{{ item.title }}</q-item-label>
              <q-item-label caption>{{ item.artist }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense :icon="pIcon('library_add')" color="primary"
                     :title="t('setlist.addToGigQuick')"
                     @click="quickAddToGig(item)" />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-grey text-italic text-center q-pa-md">{{ t('setlist.noItems') }}</div>
      </q-card-section>
    </q-card>
  </q-expansion-item>
  ```

- [ ] **Step 4: Add `quickAddToGig(item: Song): Promise<void>` to script**

  ```ts
  async function quickAddToGig(item: Song) {
    if (!selectedGigId.value) return
    if (gigSongs.value.some((s) => s.id === item.id)) return
    isSaving.value = true
    try {
      await apiJson(`/gigs/${selectedGigId.value}/songs`, {
        method: 'POST',
        body: JSON.stringify({ songId: item.id, position: gigSongs.value.length }),
      })
      await fetchGigSongs(selectedGigId.value)
      $q.notify({ message: t('setlist.addedToUserSetlist'), color: 'positive', timeout: 1500 })
    } catch {
      $q.notify({ message: t('setlist.failedAdd'), color: 'negative' })
    } finally {
      isSaving.value = false
    }
  }
  ```

  Signature: `quickAddToGig(item: Song): Promise<void>`

- [ ] **Step 5: Verify collapsible gig meta works — click header → panel slides in/out**

  Manual check: select a gig → header row shows title+date → click → form expands → click again → collapses. Stats line always visible.

- [ ] **Step 6: Verify quick-add inserts song into gig setlist without opening builder modal**

  Manual check: select a gig → scroll to "Repertoire" expansion → tap `+` on a song → song appears in the gig song list above.

- [ ] **Step 7: Verify drag-and-drop still works after reorder in gig setlist view**

  Manual check: drag a song up/down in gig view → position persists after page reload.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/web/src/pages/SetlistPage.vue
  git commit -m "feat(setlist): collapsible gig meta + inline quick-add from repertoire — closes #40 (4/4)"
  ```

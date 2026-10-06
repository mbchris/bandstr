# Pull-to-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pull-to-refresh to every data-fetching page so users can swipe down to reload content, with a visual indicator during the refresh gesture.

**Architecture:** Wrap each page's scrollable content in Quasar's `<q-pull-to-refresh>` component, which provides the swipe gesture, visual spinner, and `done()` callback out of the box. Each page calls its existing store/fetch actions inside the `@refresh` handler, then calls `done()` to dismiss the indicator. The IndexPage (Home) already has a `loadData()` function that re-fetches everything — the other pages need a similar `refreshAll` pattern assembled from their existing fetch calls.

**Tech Stack:** Vue 3 Composition API, Quasar v2 `QPullToRefresh`, existing Pinia stores

**Spec:** [GitHub Issue #42](https://github.com/prj120/bandstr/issues/42) — "Pull down to update"

## Global Constraints

- Quasar v2.17.7 — `QPullToRefresh` is built-in, no plugin registration needed
- All pages use `<script setup lang="ts">` and Composition API
- Existing fetch functions must remain the single source of data loading — pull-to-refresh calls them, never duplicates them
- The `@refresh` callback receives a `done: () => void` parameter that **must** be called after data loads complete, otherwise the spinner stays visible indefinitely

## Review Focus

1. **Rapid successive pulls** — user swipes down, release, immediately swipes again before the first refresh finishes. `QPullToRefresh` handles this internally (ignores pulls while refreshing), but verify the `done()` call still fires correctly.
2. **Network error during refresh** — if a fetch throws, `done()` must still be called in a `finally` block so the spinner dismisses. Existing store actions already have try/catch/finally, but the page-level `refreshAll` wrapper must also guard.
3. **Scroll position on pages with long content** — pull-to-refresh should only trigger at scroll-top, not mid-scroll. `QPullToRefresh` handles this natively, but verify it works inside the existing `<q-page padding>` layout.
4. **SetlistPage gig-specific refresh** — when viewing a gig setlist, refresh must reload gig songs for the currently selected gig, not just the master setlist. The `refreshAll()` function already handles this via `selectedGigId.value`.
5. **Capacitor/native iOS overscroll** — iOS WebView has native bounce-to-refresh that can conflict with QPullToRefresh. This is a Capacitor configuration concern beyond this issue's scope, but worth noting.

---

### Task 1: IndexPage (Home) — Pull-to-Refresh

**Files:**
- Modify: `packages/web/src/pages/IndexPage.vue:334-336` (template `<q-page>` opening)

**Interfaces:**
- Consumes: `loadData(): Promise<void>` (already exists at line 85)
- Produces: nothing new — existing function reused

- [x] **Step 1: Wrap `<q-page>` content in `<q-pull-to-refresh>`**

In `IndexPage.vue`, wrap the content inside `<q-page padding>` with:

```vue
<q-pull-to-refresh @refresh="onRefresh">
  <!-- existing content -->
</q-pull-to-refresh>
```

Add the refresh handler to the script section:

```typescript
async function onRefresh(done: () => void) {
  try {
    await loadData()
  } finally {
    done()
  }
}
```

- [x] **Step 2: Verify in browser**

Run: `pnpm dev` (web package)
Expected: On the Home page, pulling down shows the Quasar refresh spinner, data reloads, spinner dismisses.

- [x] **Step 3: Commit**

```bash
git add packages/web/src/pages/IndexPage.vue
git commit -m "feat(iter-N): add pull-to-refresh on IndexPage — closes #42 (partial)"
```

---

### Task 2: CalendarPage — Pull-to-Refresh

**Files:**
- Modify: `packages/web/src/pages/CalendarPage.vue:531-541` (onMounted block) and `566-567` (template opening)

**Interfaces:**
- Consumes: `calendarStore.fetchEvents()`, `calendarStore.fetchRehearsalAttendance()`, `bandStore.fetchMembers()`, `fetchGigSetlists()`, `authStore.fetchActiveBandDetails()` (all already exist)
- Produces: `refreshCalendar(): Promise<void>` — new function that re-fetches all calendar data

- [x] **Step 1: Add `refreshCalendar` function**

In `CalendarPage.vue` script section, add:

```typescript
async function refreshCalendar() {
  await Promise.all([
    calendarStore.fetchEvents(),
    calendarStore.fetchRehearsalAttendance(),
    bandStore.fetchMembers(),
    fetchGigSetlists(),
    authStore.fetchActiveBandDetails(),
  ])
}
```

Update `onMounted` to reuse it:

```typescript
onMounted(() => {
  void refreshCalendar().then(() => {
    openEventFromQuery()
  })
})
```

- [x] **Step 2: Add `onRefresh` handler**

```typescript
async function onRefresh(done: () => void) {
  try {
    await refreshCalendar()
  } finally {
    done()
  }
}
```

- [x] **Step 3: Wrap template content**

Wrap the content inside `<q-page padding>` with `<q-pull-to-refresh @refresh="onRefresh">`.

- [x] **Step 4: Verify in browser**

Run: `pnpm dev`
Expected: On the Calendar page, pulling down triggers refresh spinner, events reload, spinner dismisses.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/pages/CalendarPage.vue
git commit -m "feat(iter-N): add pull-to-refresh on CalendarPage — closes #42 (partial)"
```

---

### Task 3: VotingPage — Pull-to-Refresh

**Files:**
- Modify: `packages/web/src/pages/VotingPage.vue:564-570` (onMounted block) and `584-585` (template opening)

**Interfaces:**
- Consumes: `songsStore.fetchSongs()`, `bandStore.fetchMembers()` (both already exist)
- Produces: nothing new — existing functions reused directly

- [x] **Step 1: Add `onRefresh` handler**

In `VotingPage.vue` script section:

```typescript
async function onRefresh(done: () => void) {
  try {
    await Promise.all([songsStore.fetchSongs(), bandStore.fetchMembers()])
  } finally {
    done()
  }
}
```

- [x] **Step 2: Wrap template content**

Wrap the content inside `<q-page padding>` with `<q-pull-to-refresh @refresh="onRefresh">`.

- [x] **Step 3: Verify in browser**

Run: `pnpm dev`
Expected: On the Voting page, pulling down triggers refresh, songs and member data reload.

- [x] **Step 4: Commit**

```bash
git add packages/web/src/pages/VotingPage.vue
git commit -m "feat(iter-N): add pull-to-refresh on VotingPage — closes #42 (partial)"
```

---

### Task 4: SetlistPage — Pull-to-Refresh

**Files:**
- Modify: `packages/web/src/pages/SetlistPage.vue:488-492` (existing `refreshAll`) and template opening

**Interfaces:**
- Consumes: `refreshAll(): Promise<void>` (already exists at line 488 — reloads songs, personal notes, user setlist, and gig songs if a gig is selected)
- Produces: nothing new — existing function reused

- [x] **Step 1: Add `onRefresh` handler**

In `SetlistPage.vue` script section:

```typescript
async function onRefresh(done: () => void) {
  try {
    await refreshAll()
  } finally {
    done()
  }
}
```

- [x] **Step 2: Wrap template content**

Wrap the content inside `<q-page padding>` with `<q-pull-to-refresh @refresh="onRefresh">`. Locate the `<q-page>` tag in the template section and add the wrapper.

- [x] **Step 3: Verify in browser**

Run: `pnpm dev`
Expected: On the Setlist page (master, gig, user modes), pulling down triggers refresh of the appropriate data.

- [x] **Step 4: Commit**

```bash
git add packages/web/src/pages/SetlistPage.vue
git commit -m "feat(iter-N): add pull-to-refresh on SetlistPage — closes #42"
```

---

### Task 5: Build Verification

**Files:** none (verification only)

- [x] **Step 1: Run TypeScript check**

Run: `cd packages/web && npx vue-tsc --noEmit`
Expected: No type errors

- [x] **Step 2: Run build**

Run: `cd packages/web && npx quasar build`
Expected: Build succeeds with no errors

- [x] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "feat(iter-N): pull-to-refresh on all data pages — closes #42"
```

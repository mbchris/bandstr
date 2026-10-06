# Bierwart Management & Auto-Assignment Implementation Plan (Issue #44)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Bierwart management by adding an "Auto" assigner that automatically selects the member with the lowest beer count, incrementing the outgoing Bierwart's beer counter by 1 upon handover confirmation, and displaying rich optical visual indicators (progress bars, status badges, beer count rankings) so members can see at a glance who brought how much beer.

**Architecture:** 
1. Backend: In `packages/api/src/routes/rehearsals.ts`, update `getEffectiveBierwartId` so that when no override is set on the rehearsal event, the fallback selects the visible band member with the lowest `beerCount` (tie-broken by `sortOrder` and `name`).
2. Frontend utility & logic: Add helper functions in `packages/web/src/utils/bierwart.ts` for determining the auto candidate, computing relative beer percentages, total/average beer metrics, and badge assignments (e.g. lowest count candidate, top contributor).
3. IndexPage & Modal: In `packages/web/src/pages/IndexPage.vue`, integrate an "Auto" assigner option into the Bierwart management modal, update the confirmation dialog flow to increment the outgoing Bierwart's `beerCount` via `PATCH /users/:id` before updating `bierwartOverrideId` via `PUT /calendar/:id`, and enrich both the modal list and the dashboard card with fancy optical elements (amber progress bars, beer mug counters, ranking chips).

**Tech Stack:** Vue 3 Composition API, Quasar v2 (`QLinearProgress`, `QBadge`, `QChip`, `QAvatar`, `QDialog`), TypeScript, Hono API, Drizzle ORM, Vitest.

**Spec:** [GitHub Issue #44](https://github.com/prj120/bandstr/issues/44) — "Bierwart: Adapt bierwart management. Add 'auto' as assigner... beer counter increased by 1... optical elements at a glance"

## Global Constraints

- Vue 3 Composition API with `<script setup lang="ts">` in `packages/web/src/pages/IndexPage.vue`.
- Quasar components used for UI (`q-linear-progress`, `q-badge`, `q-chip`, `q-item`, `q-avatar`, `q-dialog`).
- Hidden band members (`isHidden: true`) must remain excluded from Bierwart rotation and auto-assignment.
- Strictly maintain English and German translations in `packages/web/src/i18n/en.ts` and `de.ts`.
- All database operations on `beerCount` update `bandMembers.beerCount` via the existing `PATCH /users/:id` endpoint.
- Existing tests (`pnpm test` and `pnpm --filter @bandstr/web test`) must continue to pass without regressions.

## Review Focus

1. **Auto candidate tie-breaking** — When multiple members have the lowest beer count (e.g. multiple people have 0), ensure deterministic selection using `sortOrder` ascending and alphabetical user `name`.
2. **Outgoing vs. incoming beer counter increment** — The confirmation dialogue pledges that the duty was fulfilled ("Ich verspreche hoch und heilig, meinen hopfigen Verpflichtungen nachgekommen zu sein..."), so the *outgoing* Bierwart (the one who brought the beer and is handing over) must have their `beerCount` incremented by 1, while the *incoming* Bierwart is assigned for next time.
3. **Self-assignment or re-confirmation edge case** — If a user re-assigns the same member or if no previous Bierwart existed (`bierwart.value` is null), avoid NaN or duplicate counter anomalies.
4. **Zero-division and max calculation in optical elements** — When all band members have 0 beers, the progress percentage should be 0% without NaN or division by zero errors.
5. **Real-time UI reactivity** — After confirming handover, both `loadData()` and `bandStore.fetchMembers()` must complete so the dashboard card, member list, and optical progress bars immediately reflect the updated counts and new assignment.

---

### Task 1: Backend Fallback for Auto Bierwart Assignment

**Files:**
- Modify: `packages/api/src/routes/rehearsals.ts:56-65`
- Test: `tests/routes/rehearsals.test.ts`

**Interfaces:**
- Consumes: `bandMembers.beerCount`, `bandMembers.sortOrder`, `bandMembers.isHidden`, `users.name`
- Produces: `getEffectiveBierwartId(bandId, rehearsal)` returns userId of member with lowest `beerCount` when no explicit override exists.

- [ ] **Step 1: Write the failing test for lowest-beer fallback in rehearsals API**

Add a test in `tests/routes/rehearsals.test.ts` verifying that when a rehearsal has no `bierwartOverrideId` and previous rehearsals have no override, `getEffectiveBierwartId` selects the member with the lowest `beerCount`.

```typescript
it('falls back to member with lowest beerCount when no bierwartOverrideId is set', async () => {
  // Setup member A with beerCount=3, member B with beerCount=1
  // GET /api/rehearsals/next
  // Assert nextRehearsal.effectiveBierwartId matches member B
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bandstr/api test tests/routes/rehearsals.test.ts`
Expected: FAIL (currently orders by `sortOrder`, not `beerCount`).

- [ ] **Step 3: Update `getEffectiveBierwartId` in `packages/api/src/routes/rehearsals.ts`**

Update query in `getEffectiveBierwartId`:
```typescript
  const [memberWithLowestBeer] = await db
    .select({ userId: users.id })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.isHidden, false)))
    .orderBy(asc(bandMembers.beerCount), asc(bandMembers.sortOrder), asc(users.name))
    .limit(1)

  return memberWithLowestBeer?.userId ?? null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bandstr/api test tests/routes/rehearsals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/rehearsals.ts tests/routes/rehearsals.test.ts
git commit -m "feat(api): fallback to lowest beer count in getEffectiveBierwartId"
```

---

### Task 2: Bierwart Helper Utilities & i18n Translations

**Files:**
- Create: `packages/web/src/utils/bierwart.ts`
- Modify: `packages/web/src/i18n/de.ts`
- Modify: `packages/web/src/i18n/en.ts`
- Test: `packages/web/test/bierwart.test.ts`

**Interfaces:**
- Produces:
  - `getAutoBierwartCandidate(members: BandMember[], currentBierwartId?: string | null): BandMember | null`
  - `calculateBeerMetrics(members: BandMember[]): { maxBeerCount: number, totalBeers: number, getRelativeProgress: (count: number) => number, isLowest: (memberId: string) => boolean, isHighest: (memberId: string) => boolean }`
- i18n keys: `home.autoAssign`, `home.autoAssignDesc`, `home.autoAssignBadge`, `home.counterIncrementNotice`, `home.lowestCountBadge`, `home.highestCountBadge`, `home.totalBeersBrought`.

- [ ] **Step 1: Write unit tests in `packages/web/test/bierwart.test.ts`**

Create test covering:
1. `getAutoBierwartCandidate`: returns member with lowest `beerCount`, breaks ties by `sortOrder` and name, considers projection when current Bierwart hands over.
2. `calculateBeerMetrics`: calculates `maxBeerCount`, relative progress between 0 and 1, handles all-zero edge case (no division by zero), correctly identifies lowest and highest contributors.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bandstr/web test test/bierwart.test.ts`
Expected: FAIL (`bierwart.ts` not found).

- [ ] **Step 3: Implement `packages/web/src/utils/bierwart.ts` and update i18n dictionaries**

Implement utility functions with pure logic and TypeScript types:
- `getAutoBierwartCandidate`
- `calculateBeerMetrics`

Add translation entries in `packages/web/src/i18n/de.ts` and `packages/web/src/i18n/en.ts`:
- German:
  - `autoAssign`: `'Automatisch'`
  - `autoAssignDesc`: `'Weist Mitglied mit den wenigsten mitgebrachten Bieren zu'`
  - `autoCandidateHint`: `'Vorschlag: {name} ({count} Biere)'`
  - `counterIncrementNotice`: `'Der Biercounter für {name} wird um 1 erhöht.'`
  - `handoverSuccess`: `'Bierwart übergeben an {newName}! {oldName} erhält +1 Bier.'`
  - `lowestCountBadge`: `'Niedrigster Stand'`
  - `highestCountBadge`: `'Hopfenkönig'`
  - `totalBeersBrought`: `'{count} Biere insgesamt mitgebracht'`
- English:
  - `autoAssign`: `'Auto'`
  - `autoAssignDesc`: `'Assigns member with the lowest number of brought beers'`
  - `autoCandidateHint`: `'Suggested: {name} ({count} beers)'`
  - `counterIncrementNotice`: `'The beer counter for {name} will be increased by 1.'`
  - `handoverSuccess`: `'Bierwart handed over to {newName}! {oldName} receives +1 beer.'`
  - `lowestCountBadge`: `'Lowest count'`
  - `highestCountBadge`: `'Beer Champion'`
  - `totalBeersBrought`: `'{count} beers brought in total'`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bandstr/web test test/bierwart.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/utils/bierwart.ts packages/web/src/i18n/de.ts packages/web/src/i18n/en.ts packages/web/test/bierwart.test.ts
git commit -m "feat(web): add bierwart auto selection logic, metrics, and i18n keys"
```

---

### Task 3: Bierwart Modal — Auto Assigner & Counter Increment on Confirmation

**Files:**
- Modify: `packages/web/src/pages/IndexPage.vue`
- Test: `packages/web/test/bierwart-modal.test.ts`

**Interfaces:**
- Consumes: `getAutoBierwartCandidate`, `visibleMembers`, `bierwart`, `nextRehearsal`
- Modifies: `confirmBierwart(member: BandMember, isAuto?: boolean)`

- [ ] **Step 1: Write test verifying modal auto-assignment and counter increment**

Create `packages/web/test/bierwart-modal.test.ts` testing:
1. Selecting "Auto" targets the candidate with lowest beer count.
2. Confirming the dialog calls `PATCH /users/:id` for outgoing Bierwart with `beerCount + 1`, followed by `PUT /calendar/:rehearsalId` with the new Bierwart's ID.
3. If no outgoing Bierwart was set, only `PUT /calendar/:rehearsalId` is called.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bandstr/web test test/bierwart-modal.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Auto item and counter increment in `IndexPage.vue`**

1. In `<script setup>`:
   - Import `getAutoBierwartCandidate` and `calculateBeerMetrics` from `src/utils/bierwart`.
   - Compute `autoCandidate = computed(() => getAutoBierwartCandidate(visibleMembers.value, bierwart.value?.id))`.
   - Update `confirmBierwart(targetMember: any, isAuto: boolean = false)`:
     - Message dialog shows handover obligation plus notice:
       `message: `${t('home.confirmBierwartChange')} ${targetMember.name}${isAuto ? ' (' + t('home.autoAssign') + ')' : ''}.\n\n${bierwart.value ? t('home.counterIncrementNotice', { name: bierwart.value.name }) : ''}``
     - On OK:
       - If `bierwart.value?.id`:
         `await apiJson(`/users/${bierwart.value.id}`, { method: 'PATCH', body: JSON.stringify({ beerCount: (bierwart.value.beerCount || 0) + 1 }) })`
       - Update calendar:
         `await apiJson(`/calendar/${nextRehearsal.value.id}`, { method: 'PUT', body: JSON.stringify({ bierwartOverrideId: targetMember.id }) })`
       - Reload data: `await Promise.all([loadData(), bandStore.fetchMembers()])`
       - Notify positive: `t('home.handoverSuccess', { oldName: outgoingName, newName: targetMember.name })`
2. In `<template>` under `<q-dialog v-model="showBierwartModal">`:
   - Add prominent "Auto" item at top of list:
     ```html
     <q-item
       v-if="autoCandidate"
       clickable
       v-ripple
       class="bg-amber-1 q-mb-sm rounded-borders text-amber-10"
       @click="confirmBierwart(autoCandidate, true)"
     >
       <q-item-section avatar>
         <q-avatar color="amber-3" text-color="amber-9" icon="auto_awesome" />
       </q-item-section>
       <q-item-section>
         <q-item-label class="text-weight-bold row items-center q-gutter-xs">
           <span>{{ t('home.autoAssign') }}</span>
           <q-badge color="amber-9" :label="t('home.lowestCountBadge')" />
         </q-item-label>
         <q-item-label caption class="text-amber-9">
           {{ t('home.autoCandidateHint', { name: autoCandidate.name, count: autoCandidate.beerCount || 0 }) }}
         </q-item-label>
       </q-item-section>
       <q-item-section side>
         <q-btn flat round dense icon="arrow_forward" color="amber-9" />
       </q-item-section>
     </q-item>
     ```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bandstr/web test test/bierwart-modal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/IndexPage.vue packages/web/test/bierwart-modal.test.ts
git commit -m "feat(web): add auto assigner and beer counter increment on handover confirmation"
```

---

### Task 4: Fancy Optical Elements for Beer Contribution at a Glance

**Files:**
- Modify: `packages/web/src/pages/IndexPage.vue`
- Test: `packages/web/test/bierwart-optical-indicator.test.ts`

**Interfaces:**
- Consumes: `calculateBeerMetrics(visibleMembers.value)`, `member.beerCount`, `member.name`
- Produces: Rich visual elements in the Bierwart modal and dashboard card:
  - Header metric summary: Total beers brought with beer mug icon (`sports_bar`), band member count.
  - Per-member visual progress bars (`q-linear-progress`) showing proportion relative to band maximum.
  - Optical badge indicators: "Hopfenkönig" 👑 for highest contributor, "Niedrigster Stand" 🎯 for lowest.
  - Quick optical indicator in the Home page Bierwart card showing their relative beer contribution level and count.

- [ ] **Step 1: Write test verifying optical elements rendering**

Create `packages/web/test/bierwart-optical-indicator.test.ts` testing:
1. Renders progress bar for each member scaled to `maxBeerCount`.
2. Displays highest/lowest badges when counts differ.
3. Shows total beers count summary in the modal header.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bandstr/web test test/bierwart-optical-indicator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement optical elements in `IndexPage.vue`**

1. In `<script setup>`:
   - Compute `beerMetrics = computed(() => calculateBeerMetrics(visibleMembers.value))`
2. In `<template>`:
   - In `showBierwartModal`:
     - Add a summary banner at the top of modal content:
       ```html
       <div class="row items-center justify-between q-px-sm q-py-xs bg-amber-1 rounded-borders q-mb-md">
         <div class="row items-center q-gutter-xs">
           <q-icon name="sports_bar" color="amber-9" size="sm" />
           <span class="text-caption text-weight-bold text-amber-10">
             {{ t('home.totalBeersBrought', { count: beerMetrics.totalBeers }) }}
           </span>
         </div>
       </div>
       ```
     - In the member list items, add the optical progress bar and badge indicators:
       ```html
       <q-item-section>
         <div class="row items-center q-gutter-xs">
           <q-item-label class="text-weight-bold">{{ member.name }}</q-item-label>
           <q-badge v-if="beerMetrics.isHighest(member.id)" color="amber-8" text-color="white" size="xs">
             👑 {{ t('home.highestCountBadge') }}
           </q-badge>
           <q-badge v-else-if="beerMetrics.isLowest(member.id)" color="grey-6" text-color="white" size="xs">
             🎯 {{ t('home.lowestCountBadge') }}
           </q-badge>
         </div>
         <!-- Fancy optical progress indicator -->
         <div class="q-mt-xs" style="max-width: 180px">
           <q-linear-progress
             :value="beerMetrics.getRelativeProgress(member.beerCount || 0)"
             rounded
             size="6px"
             color="amber-8"
             track-color="amber-2"
           />
         </div>
       </q-item-section>
       ```
   - In the Home page Bierwart card (around lines 484-505):
     - Enhance the beer count display with an optical beer badge and mini contribution progress bar:
       ```html
       <div class="text-caption text-amber-9 row items-center q-gutter-xs q-mt-xs">
         <q-icon name="sports_bar" size="14px" />
         <span>{{ member.beerCount || 0 }} {{ t('common.beers') }}</span>
       </div>
       ```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bandstr/web test test/bierwart-optical-indicator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/IndexPage.vue packages/web/test/bierwart-optical-indicator.test.ts
git commit -m "feat(web): add fancy optical indicators for beer counts and contribution leaderboard"
```

---

### Task 5: Full Regression Testing & Backlog Documentation

**Files:**
- Modify: `docs/backlog/bugfixing.md` or `docs/backlog/new-requirements.md` (add TASK-0220 for Issue #44)

- [ ] **Step 1: Run full API test suite**

Run: `pnpm --filter @bandstr/api test`
Expected: 100% tests pass.

- [ ] **Step 2: Run full Web test suite**

Run: `pnpm --filter @bandstr/web test`
Expected: 100% tests pass.

- [ ] **Step 3: Run web typecheck**

Run: `pnpm --filter @bandstr/web run typecheck`
Expected: No type errors.

- [ ] **Step 4: Document task in backlog**

Add `TASK-0220: Bierwart Management Adaptation & Auto-Assigner (#44)` in `docs/backlog/new-requirements.md` with acceptance criteria checked off.

- [ ] **Step 5: Commit**

```bash
git add docs/backlog/new-requirements.md
git commit -m "docs: record TASK-0220 for issue #44 in backlog"
```

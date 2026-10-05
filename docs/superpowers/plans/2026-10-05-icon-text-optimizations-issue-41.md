# Implementation Plan: Icon and Text Sizing and Optimizations (#41)

> Documentation for [prj120/bandstr#41](https://github.com/prj120/bandstr/issues/41).

## Overview

Addresses UX feedback on gig setlist navigation, home page upcoming gigs count, user setlist management, calendar linkage display, and platform-compliant icon styles.

## Summary of Changes

### 1. Home Page Upcoming Gigs Limit
- **File:** [`packages/api/src/routes/rehearsals.ts`](file:///Users/chris/code/prj120/bandstr/packages/api/src/routes/rehearsals.ts)
- Updated `GET /rehearsals/next` to return up to 5 upcoming gigs instead of 3.

### 2. Direct Navigation to Selected Gig Setlist ('Open Setlist')
- **File:** [`packages/web/src/pages/SetlistPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue)
- **Problem:** `watch(activeTab)` was resetting `selectedGigId` to `null` whenever the `'gig'` tab was selected, causing navigation with `list=gig:<id>` to open the setlist overview instead of the specific setlist.
- **Fix:** 
  - Adjusted `watch(activeTab)` to preserve `selectedGigId` when switching to or staying on the gig tab.
  - Initialized `activeTab = 'gig'`, `selectedGigId`, and fetched gig songs immediately in `watch(() => route.query.list)` and `onMounted`.
  - Kept route query and state synchronized during `selectGig()` and `backToGigList()`.

### 3. User Setlist Two-Panel Builder
- **File:** [`packages/web/src/pages/SetlistPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue)
- Replaced the legacy single select dropdown with a responsive two-panel builder mirroring the Gig Setlist builder UI:
  - Left panel: Current user setlist songs with ordering, tags, and remove actions.
  - Right panel: Repertoire search with quick-add actions.

### 4. 'View Gig' Navigation to Calendar Details
- **Files:** [`packages/web/src/pages/SetlistPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue), [`packages/web/src/pages/CalendarPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/CalendarPage.vue)
- `goToGigDetails()` in `SetlistPage.vue` navigates to `/calendar?eventId=<calendarEventId>`.
- Added reactive `watch(() => route.query.eventId)` in `CalendarPage.vue` to fetch calendar events if needed and open the target event modal immediately.

### 5. Calendar Link Label Resolution
- **File:** [`packages/web/src/pages/SetlistPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue)
- Pre-fetched calendar gigs before mapping gig setlist metadata.
- Added immediate watch on `calendarGigLinkOptions` to ensure `filteredCalendarGigLinkOptions` contains the label mapping on initial load, preventing raw numeric IDs from showing in the input field.

### 6. Platform Compliant Icons & Clean UI
- **Files:** [`packages/web/src/pages/SetlistPage.vue`](file:///Users/chris/code/prj120/bandstr/packages/web/src/pages/SetlistPage.vue), [`packages/web/src/utils/platformIcons.ts`](file:///Users/chris/code/prj120/bandstr/packages/web/src/utils/platformIcons.ts)
- Swapped action buttons in gig metadata header to round icon-only buttons with tooltips (`edit`, `content_copy`, `save`, `delete`) using `:icon="pIcon(...)"`.
- Swiped 'move to voting' uses `how_to_vote` icon mapping.
- Standardized toolbar and song action buttons to use `pIcon(...)` across platforms.

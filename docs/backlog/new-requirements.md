# New requirements

- **Foundation**: In the admin mode, make the userlist editable. The allowed users are stored in the database with their email address and a role (admin, user).  
- **Content**: On the starting page, instead of showing " bandstr - Official Band Hub. Music, Rehearsals, and Beer", only show the logo of the band. Also remove the "Next rehearsal" button and "Song Voting" button. It shall remain in the main navigation menu on top.
- **Voting**: Remove the spotify and youtube preview embedding. Instead, only get the album thumbnail from the song and link the song to spotify and youtube. The thumbnail should be clickable and open the song in the respective application.
- **Setlist**: Remove the spotify and youtube preview embedding. Instead, only get the album thumbnail from the song and link the song to spotify and youtube. The thumbnail should be clickable and open the song in the respective application.
- **New Feature**: "bend a stand" in a new tab. Shows a SVG of a music stand. When clicking on it and pulling it, the stand will bend at the position selected. The longer you bend it, the more "Strength points" you get. Resets after each load of the page.
- **Admin**: Add an import/export for calendar entries (CSV).
- **i18n**: Add multi-language support for English and German with browser default.
- **UI**: Theme-aware logo switching (white/black logo).
- **Voting**: Add Spotify song lookup with auto-fill (Title & Artist).
- **Voting/Setlist**: Separate voting and setlist songs. Allow moving between them.
- **Admin**: Add confirmation box when changing "Bierwart".
- **UI**: Make band logo clickable to return to home page.
- **Calendar**: Show unavailabilities on start page and rehearsal detail page.
# Acceptance criteria for new requirements

## TASK-0201: Foundation - Editable User List in Admin
- **Status:** done
- **Labels:** feature, backend, admin
- **Acceptance Criteria:**
  - [x] Add `updateUser` API (PATCH `/api/users/:id`).
  - [x] Update `admin.vue` to allow modifying Name, Email, and Role of existing members.
  - [x] Standardize roles to "admin" and "user" (update schema and existing records if necessary).

## TASK-0202: Content - Hero Section Redesign
- **Status:** done
- **Labels:** feature, frontend
- **Acceptance Criteria:**
  - [x] Remove central tagline "Music, Rehearsals, and Beer" and buttons from `pages/index.vue` hero area.
  - [x] Centrally display `assets/bandstr_rect_wh.png` in the hero section.
  - [x] Ensure main navigation still contains links to all features.

## TASK-0203: Voting & Setlist - Thumbnail Previews
- **Status:** done
- **Labels:** feature, frontend, backend
- **Acceptance Criteria:**
  - [x] Add `thumbnail_url` field to the `songs` table in `server/database/schema.ts`.
  - [x] Update song creation/update logic to fetch and store `thumbnail_url` from Spotify oEmbed.
  - [x] Replace iframe embeds in `voting.vue` and `setlist.vue` with the song thumbnail.
  - [x] Make the thumbnail clickable, opening the song in the native app/web player (Spotify/YouTube).

## TASK-0204: New Feature - "Bend a Stand"
- **Status:** done
- **Labels:** feature, frontend
- **Acceptance Criteria:**
  - [x] Create `pages/stand.vue` with a draggable/bendable SVG music stand.
  - [x] Use `assets/music-stand.svg` as the SVG music stand.
  - [x] Implement scoring logic: points accumulate based on bend duration/depth.
  - [x] Ensure points reset upon page refresh.
  - [x] Add "Bend a Stand" to the header navigation in `layouts/default.vue`.

## TASK-0205: Admin - Database Backup & Restore
- **Status:** done
- **Labels:** feature, backend, admin
- **Acceptance Criteria:**
  - [x] Implement database export endpoint (GET `/api/admin/db/export`) that returns a JSON or SQL dump.
  - [x] Implement database import endpoint (POST `/api/admin/db/import`) that accepts a dump file.
  - [x] Add "Export DB" and "Import DB" buttons to the Admin panel.
  - [x] Ensure only admins can access these endpoints.

## TASK-0206: Admin - Hardcoded Admin User
- **Status:** done
- **Labels:** bug, security, admin
- **Acceptance Criteria:**
  - [x] Ensure "schneider.chris@gmx.de" is automatically assigned the "admin" role upon login.
  - [x] Prevent this user's role from being downgraded in the Admin UI.

## TASK-0207: Admin - Calendar CSV Import/Export
- **Status:** done
- **Labels:** feature, admin, backend
- **Acceptance Criteria:**
  - [x] Implement CSV export for calendar entries.
  - [x] Implement CSV import for calendar entries.
  - [x] Add UI buttons to the Admin panel.

## TASK-0208: i18n - Multi-language Support
- **Status:** done
- **Labels:** feature, frontend, global
- **Acceptance Criteria:**
  - [x] Implement `useI18n` composable for EN/DE.
  - [x] Translate all UI strings.
  - [x] Add language switcher to header and login page.
  - [x] Auto-detect browser language and persist choice in localStorage.

## TASK-0209: UI - Theme-aware Logos
- **Status:** done
- **Labels:** feature, frontend, design
- **Acceptance Criteria:**
  - [x] Switch between `bandstr_rect_wh.png` (dark mode) and `bandstr_rect_bl.png` (light mode).
  - [x] Update header and login page logos.

## TASK-0210: Voting - Spotify Lookup Improvements
- **Status:** done
- **Labels:** feature, backend, voting
- **Acceptance Criteria:**
  - [x] Add server-side Spotify lookup API proxy.
  - [x] Implement auto-fill for song Title and Artist on URL paste/lookup.

## TASK-0211: Voting/Setlist - Separated Views & Transfer
- **Status:** done
- **Labels:** feature, frontend, voting
- **Acceptance Criteria:**
  - [x] Filter out setlist songs from the voting page.
  - [x] Add "Move back to Voting" functionality in the setlist page.
  - [x] Ensure consistent icons and tooltips for transfers.

## TASK-0212: Miscellaneous UI/UX Tweaks
- **Status:** done
- **Labels:** feature, frontend, calendar
- **Acceptance Criteria:**
  - [x] Add "Bierwart" change confirmation box.
  - [x] Make band logo clickable for home redirect.
  - [x] Show unavailabilities on home and rehearsal pages.
  - [x] Add build version to admin page.

## TASK-0213: Gig Setlists
- **Status:** done
- **Labels:** feature, frontend, backend
- **Acceptance Criteria:**
  - [x] It is possible to add songs to the setlist manually (without needing to vote for it)
  - [x] The Setlist is now the "Master Setlist" (but shall not change in the name)
  - [x] Gig Setlists can be derived from the master setlist. A subset of the master setlist is selected for a gig. 
  - [x] Gig Setlist stay persistent and can be selected 
  - [x] Songs can be added and removed from the gig setlist
  - [x] Only Songs from the Master Setlist can be added to a Gig Setlist
  - [x] Pause and Tuning changes can be added to the gig setlist

## TASK-0214: Mobile Info Hovers and UI Polish
- **Status:** done
- **Labels:** feature, frontend, ui
- **Acceptance Criteria:**
  - [x] Setlist: The info hovers for song details is too small for mobile usage. Open a custom popup instead and increase the size of the icon to click. Also applies to desktop sizing.
  - [x] Setlist: The info hovers for tuning changes is too small for mobile usage. Open a custom popup instead and increase the size of the icon to click. Also applies to desktop sizing.
  - [x] Setlist: Instead of the text "Als excel exportieren", "Pause einfügen", and "Stimmung wechseln", just use fitting icons 
  - [x] Voting: Instead of the text "Als excel exportieren" and "Song vorschlagen", just use fitting icons 
  - [x] UI: As a favicon, use assets/favicons (different sizes are there)
  - [x] Voting: Use the same alignment of the thumbnail and song text as in the "Setlist" page. Add the own voting on the right hand side. Keep the votings of all members at the bottom.

## TASK-0215: Bierwart Beer Counter
- **Status:** done
- **Labels:** feature, frontend, backend, admin
- **Acceptance Criteria:**
  - [x] Add `beerCount` integer field to the `users` table schema and migrate.
  - [x] Display `beerCount` next to the Bierwart's name on the Home page.
  - [x] Add a `+` button in the Bierwart card to increment the count with a toast notification.
  - [x] Add `beerCount` to the Admin user table and allow manual editing in User modals.
  - [x] Support English and German translations for "Beer counter" and related labels.

## TASK-0216: Hidden Users Feature
- **Status:** done
- **Labels:** feature, frontend, backend, admin
- **Acceptance Criteria:**
  - [x] Add `isHidden` boolean field to the `users` table schema and migrate.
  - [x] Prevent hidden users from appearing in the Bierwart rotation.
  - [x] Hide hidden users from the "unavailabilities" list on Home and Rehearsal pages.
  - [x] Exclude hidden users from voting (hide them from the band member vote list).
  - [x] Allow toggling `isHidden` status in the Admin user management section.
  - [x] Enable editing of the system administrator user (schneider.chris@gmx.de) in the Admin UI.

## TASK-0217: Voting - Filtering & Sorting
- **Status:** done
- **Labels:** feature, frontend, voting
- **Acceptance Criteria:**
  - [x] Add filter in "Voting" to filter for votings the current user has voted for yet (Voted) and not voted yet.
  - [x] Add sorting to the voting list by "recently added", "highest vote", "lowest vote", and "alphabetic".
  - [x] Disable manual drag reordering of songs when a custom sorting option is selected.

## TASK-0218: Bierwart - Beverage Amount & Push Notification
- **Status:** done
- **Labels:** feature, frontend, backend, calendar, notification
- **Acceptance Criteria:**
  - [x] Display the amount of brought beverages (`beerCount`) for each person in the Bierwart selection modal.
  - [x] Add a push notification when the Bierwart of a rehearsal event changes, including the name of the new Bierwart.

# Sample Acceptance Criteria (use this for reference)

## TASK-0000: Example Task
- **Status:** todo
- **Labels:** example
- **Acceptance Criteria:**
  - [ ] Example criteria.
# Iteration 5 - Setlist


## TASK-0501: Setlist Management and Song Properties
- **Status:** done
- **Labels:** feature, frontend, backend
- **file hints:** `frontend/src/features/setlist/*`, `backend/src/api/setlist/*`, `backend/src/models/Song.ts`
- **Acceptance Criteria:**
  - [x] Users can add songs to the setlist.
  - [x] Users can remove songs from the setlist.
  - [x] Support reordering songs by moving them up or down.
  - [x] Implement pinning functionality for songs.
  - [x] Allow pinning a song to a specific position in the setlist.
  - [x] Allow defining "semi-tone pitching" for songs within a range of -5 to +5.
  - [x] Support adding "pause" elements to the voting/setlist.
  - [x] Support adding "change tuning" elements to the voting/setlist.
  - [x] Provide a table view for songs.
  - [x] Support ordering table by title and artist.
  - [x] Support filtering table by title and artist.
  - [x] Support adding YouTube and Spotify links to songs.
  - [x] Display previews for linked songs.
  - [x] Ensure linked songs open in a new tab.
  - [x] Implement an interface to edit song properties.

## TASK-0502: Import based on spotify link
- **Status:** done
- **Labels:** feature, frontend, backend
- **file hints:** `frontend/src/features/setlist/*`, `backend/src/api/setlist/*`, `backend/src/models/Song.ts`
- **Acceptance Criteria:**
  - [x] When a song is added, based on the spotify link, artist and song are determide automatically 

## TASK-0503: Personal Song Notes
- **Status:** done
- **Labels:** feature, backend, frontend
- **Acceptance Criteria:**
  - [x] Create `personal_notes` table (song_id, user_id, content).
  - [x] Implement API for CRUD operations on personal notes.
  - [x] Update Setlist UI to allow members to add/edit their own notes (e.g., personal tuning).
  - [x] Ensure personal notes are only visible to the owner.

## TASK-0504: Excel Export (Setlist)
- **Status:** done
- **Labels:** feature, frontend, export
- **Acceptance Criteria:**
  - [x] Implement Excel export functionality for the setlist page.
## TASK-0505: Gig Setlists
- **Status:** done
- **Labels:** feature, frontend, backend
- **file hints:** `pages/setlist.vue`, `components/setlist/*`, `server/api/setlist/*`, `server/api/gig/*`
- **Acceptance Criteria:**
  - [x] It is possible to add songs to the setlist manually (without needing to vote for it)
  - [x] The Setlist is now the "Master Setlist" (but shall not change in the name)
  - [x] Gig Setlists can be derived from the master setlist. A subset of the master setlist is selected for a gig. 
  - [x] Gig Setlist stay persistent and can be selected 
  - [x] Songs can be added and removed from the gig setlist
  - [x] Only Songs from the Master Setlist can be added to a Gig Setlist
  - [x] Pause and Tuning changes can be added to the gig setlist

## TASK-0506: Mobile Info Hovers and UI Polish
- **Status:** done
- **Labels:** feature, frontend, ui
- **file hints:** `pages/setlist.vue`, `pages/voting.vue`, `components/ui/*`, `nuxt.config.ts`, `app.vue`
- **Acceptance Criteria:**
  - [x] Setlist: The info hovers for song details is too small for mobile usage. Open a custom popup instead and increase the size of the icon to click. Also applies to desktop sizing.
  - [x] Setlist: The info hovers for tuning changes is too small for mobile usage. Open a custom popup instead and increase the size of the icon to click. Also applies to desktop sizing.
  - [x] Setlist: Instead of the text "Als excel exportieren", "Pause einfügen", and "Stimmung wechseln", just use fitting icons 
  - [x] Voting: Instead of the text "Als excel exportieren" and "Song vorschlagen", just use fitting icons 
  - [x] UI: As a favicon, use assets/favicons (different sizes are there)
  - [x] Voting: Use the same alignment of the thumbnail and song text as in the "Setlist" page. Add the own voting on the right hand side. Keep the votings of all members at the bottom.



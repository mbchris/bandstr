# Iteration 4 - Voting


## TASK-0402: Song Voting and Management
- **Status:** done
- **Labels:** feature, backend, frontend

### TASK-0402.1: Song CRUD and External Links
- **Acceptance Criteria:**
  - [x] Support adding and removing songs from the list.
  - [x] Support adding YouTube and Spotify links with embedded song previews.
  - [x] Ensure linked songs can be opened in a new browser tab.
- **File Hints:**
  - `src/server/api/routers/song.ts`: CRUD operations and link validation.
  - `src/components/SongForm.tsx`: UI for adding/editing songs with link inputs.
  - `src/components/SongPreview.tsx`: Component for embedding YouTube/Spotify players.

### TASK-0402.2: Voting System and Display
- **Acceptance Criteria:**
  - [x] Enable band members to vote on a scale: "veto" (0), "ok" (1), "good" (2), "great" (3).
  - [x] Display all individual votes, the average vote score, and the total count for each song.
  - [x] Provide table sorting and filtering by average vote, title, and artist.
- **File Hints:**
  - `prisma/schema.prisma`: Add `Vote` model and relations.
  - `src/server/api/routers/vote.ts`: Logic for submitting and aggregating votes.
  - `src/components/SongTable.tsx`: Implementation of sorting, filtering, and vote visualization.

### TASK-0402.3: Manual Reordering and Pinning
- **Acceptance Criteria:**
  - [x] Implement manual reordering (move up/down) functionality.
  - [x] Support pinning songs to specific positions in the list.
- **File Hints:**
  - `src/server/api/routers/song.ts`: Update logic for position and pinned status.
  - `src/hooks/useReorderSongs.ts`: Custom hook for drag-and-drop or button-based reordering logic.

### TASK-0402.4: Setlist Transfer Workflow
- **Acceptance Criteria:**
  - [x] Implement a workflow to transfer songs to the Setlist.
  - [x] Require a confirmation step (modal/dialog) before finalizing the transfer.
- **File Hints:**
  - `src/server/api/routers/setlist.ts`: Endpoint to move/copy song data to setlist.
  - `src/components/TransferConfirmationModal.tsx`: UI for the confirmation step.


### TASK-0402.5: Editable Voting
- **Acceptance Criteria:**
  - [x] Voting entries are editable
- **File Hints:**
  - `prisma/schema.prisma`: Add `Vote` model and relations.
  - `src/server/api/routers/vote.ts`: Logic for submitting and aggregating votes.
  - `src/components/TransferConfirmationModal.tsx`: UI for the confirmation step.

### TASK-0402.6: Voting view
- **Acceptance Criteria:**
  - [x] Table-style visualization
  - [x] Full width per entry
  - [x] space saving height
  - [x] votes with values are shown for all band members below their user icon
  - [x] there is enough space between the band member icons to see their votes
  - [x] own voting is placed in the same line as the votes of others
- **File Hints:**
  - `prisma/schema.prisma`: Add `Vote` model and relations.
  - `src/server/api/routers/vote.ts`: Logic for submitting and aggregating votes.
  - `src/components/TransferConfirmationModal.tsx`: UI for the confirmation step.



### TASK-0402.7: Spotify Metadata Auto-population
- **Acceptance Criteria:**
  - [x] Integrate with Spotify oEmbed API to fetch track metadata.
  - [x] Automatically fill Title and Artist when a valid Spotify link is provided in the "Suggest Song" modal.
  - [x] Trigger fetch when the Spotify URL input field loses focus (blur event).
  - [x] Do not overwrite Title or Artist if they already contain user-entered text.
  - [x] Handle fetch failures or invalid links without blocking the user interface.
- **File Hints:**
  - `pages/voting.vue`: Implementation of `handleSpotifyUrlBlur` and the add song form logic.

### TASK-0402.8: Excel Export (Voting)
- **Status:** done
- **Labels:** feature, frontend, export
- **Acceptance Criteria:**
  - [x] Implement Excel export functionality for the voting list using `xlsx` library.
  - [x] Include columns: Title, Artist, Score, Total Votes.
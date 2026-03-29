# Iteration 2 — Content Pages

<!-- iteration: Iteration 2 -->

## TASK-0200: Layout
- **Status:** done
- **Labels:** architecture
- **Acceptance Criteria:**
  - [x] Nuxt glide.ai template is used
  - [x] Logo 'assets/bandstr_rect_wh.png' is shown

## TASK-0201: Authentication/Autorization
- **Status:** todo
- **Labels:** feature, design
- **Acceptance Criteria:**
  - [ ] It is required to login to access the site
  - [x] OIDC-providers google, facebook and github are supported.
  - [ ] Only users that are whitelisted on server-side based on their e-mail address are allowed to login.
  - [ ] The whitelist is taken from .env, it is a comma separated list of e-mail addresses.
- **File hints:** none

## TASK-0202: Starting page
- **Status:** todo
- **Labels:** feature
- **Acceptance Criteria:**
  - [x] menu bar with items "Next Rehearsal", "Calendar", "Setlist", "Voting", "Admin"
  - [x] Default page is "Next Rehearsal"
  
## TASK-0203: "Next Rehearsal" page
- **Status:** todo
- **Labels:** feature, design
- **Acceptance Criteria:**
  - [x] Show a date with the next rehearsal
  - [ ] Shows a list with songs that are practised
  - [x] Shows a list with rehearsal focus
  - [ ] Responsive grid layout
- **File hints:** `pages/rehearsal.vue`, `components/RehearsalCard.vue`

## TASK-0204: "Calendar" page
- **Status:** todo
- **Labels:** feature
- **Acceptance Criteria:**
  - [ ] A calendar spanned over 2 months
  - [ ] Calendar entry for "Band"
  - [ ] Calendar entry for each band member
- **File hints:** `pages/calendar.vue`, `components/CalendarCard.vue`

## TASK-0205: "Setlist" page
- **Status:** todo
- **Labels:** feature
- **Acceptance Criteria:**
  - [x] A list with Songs
  - [x] Each song has a link to the spotify track, the youtoube track and notes/hints defined by the cover band
  - [x] The list can be sorted and filtered
- **File hints:** `pages/setlist.vue`, `components/SetlistCard.vue`

## TASK-0206: "Voting" page
- **Status:** todo
- **Labels:** feature
- **Acceptance Criteria:**
  - [x] A list with Songs
  - [x] Each song has a link to the spotify track, the youtoube track and notes/hints defined by the cover band
  - [ ] New songs can be added by each band member based on a spotify or youtube search or direct link
  - [ ] Each band member can vote and comment for each song
  - [x] The songs are sorted by the number of votes
  - [ ] Each member can change his vote but only see the other votes
  - [ ] The list can be sorted and filtered
- **File hints:** `pages/voting.vue`, `components/VotingCard.vue`

## TASK-0207: "Admin" page
- **Status:** todo
- **Labels:** feature
- **Acceptance Criteria:**
  - [ ] Band members can be added/removed
  - [ ] Allowed e-mail addresses for OIDC login can be managed
  **File hints:** `pages/admin.vue`, `components/AdminCard.vue`

## TASK-0208: Data initialization
- **Status:** todo
- **Labels:** feature
- **Acceptance Criteria:**
  - [ ] Band members are added: André, Chris, Stefan, Daniel, Andreas
  - [ ] email addresses are added for each name@example.org




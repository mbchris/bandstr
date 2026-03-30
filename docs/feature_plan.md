# bandstr — Feature Plan

> Iteration-structured roadmap for the **bandstr** band website.
> Each iteration maps to a GitHub Projects **Iteration** value on the
> [Iterative Development](https://github.com/users/mbchris/projects/3) board.

## Bug Fixing

**Goal:** Bugs are fixed

- Each bug is fixed

**Backlog:** [`docs/backlog/bugfixing.md`](./backlog/bugfixing.md)
---

## Iteration 1 — Foundation

**Goal:** Project scaffolding, Docker setup, CI pipeline, and basic layout with navigation.

- Nuxt 3 project structure with TypeScript
- Docker + docker-compose (dev & prod profiles)
- Global design system (dark theme, typography, spacing)
- Responsive layout with header, footer, and navigation
- GitHub Actions CI (lint, typecheck, build)

**Backlog:** [`docs/backlog/iter-1-foundation.md`](./backlog/iter-1-foundation.md)

---

## Iteration 2 — Content Pages

**Goal:** Build out the main content pages with rich visuals.
- Rehearsal page: next rehearsal with additional information
- About page: band bio, member profiles
- Setlist page: list of songs
- Voting page: voting for songs
- Admin page: admin functions

**Backlog:** [`docs/backlog/iter-2-content.md`](./backlog/iter-2-content.md)

---


## Iteration 3 — Calendar

**Goal:** Optimizations for the calendar
- Detail window available
- User can create, delete and update their own calendar entries
- User can create, delete and update the band calendar entries
- Editing a calendar item: Overview and details fields are available
- Editing a calendar item: The owner of the entry can be selected, either the band or the user
- Calendar is scrollable month-wise
- Calendar is responsive

**Backlog:** [`docs/backlog/iter-3-calendar.md`](./backlog/iter-3-calendar.md)

---
## Iteration 4 — Voting

**Goal:** Optimizations for the voting
- A song can be added
- A song can be removed
- A song can be moved up or down
- A song can be pinned
- A song can be pinned to a specific position
- A song can be voted by each band member in a scale from ("veto", "ok", "good", "great")
- Each song can be voted by each band member 
- All votes are shown
- The average vote is shown
- The number of votes is shown
- Table can be ordered and filtered by the average vote, title, artist
- Link to youtube can be added
- Link to spotify can be added
- Linked songs show the preview of the song
- Linked songs can be opened in a new tab
- Songs can be taken over to Setlist. This needs to be confirmed.
- Show votes from others even they have not voted yet. All band members shall be shown.


**Backlog:** [`docs/backlog/iter-4-voting.md`](./backlog/iter-4-voting.md)

---

## Iteration 5 — Setlist

**Goal:** Optimizations for the setlist
- A song can be added
- A song can be removed
- A song can be moved up or down
- A song can be pinned
- A song can be pinned to a specific position
- A "semi-tone pitching" can be defined from -5 to +5
- A "pause" element can be added to the voting
- A "change tuning" element can be added to the voting
- Table can be ordered and filtered by title, artist
- Link to youtube can be added
- Link to spotify can be added
- Linked songs show the preview of the song
- Linked songs can be opened in a new tab
- Song properties can be edited.


**Backlog:** [`docs/backlog/iter-5-setlist.md`](./backlog/iter-5-setlist.md)


## Iteration 6 - Rehearsal

**Goal:** Support the rehearsal process
- A rehearsal session can be started and ended
- The duration of each song played is tracked
- Rehearsal notes can be added to each song
- The status of a song can be updated (e.g. "Done", "Needs Work")
- Lyrics and chords are displayed in a rehearsal-friendly view
- Metronome and tempo are visible for each song
- Easy navigation between songs in the setlist
- Summary of the rehearsal is shown at the end

**Backlog:** [`docs/backlog/iter-6-rehearsal.md`](./backlog/iter-6-rehearsal.md)



## Iteration 7 - Starting page

**Goal:** a modern starting page with Login Features 
- Start page when logged out has assets/rehearsal_dyn_v2.mp4 in endless loop playing in the Background
- Login Dialog is is on a layer over the Background Video.
- The Login page has a text box Above the Login with dummy text "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum."

**Backlog:** [`docs/backlog/iter-7-starting-page.md`](./backlog/iter-7-starting-page.md)



## Iteration 8 - Starting Page (Dashboard)

**Goal:** Starting the app the first time brings the user to a "Dashboard"
- The Dashboard page does not contain navigation links 
- The Dashboard page has the "Manage Bands" Feature
- The Dashboard page has the "Manage Subscriptions" Feature
- "Manage Bands" in the Profile menu is replaced by "Dashboard".
- Dashboard is the first element in the navigation bar
- "Manage Band" has a "Select Band feature which brings the user to the main band app
- The Dashboard page has a "Join Band" feature
- "Manage Band" has a "Create Invitation code" feature
- "Join Band" can use the "Invitation codes" created in "Manage Band"
- Invitation Codes can be opened as a QR code
- Invitation codes are only valid one time
- used invitation codes are shown
- Invitation codes can be invalidated

- Everyone can login with an OAuth provider, there is no whitelist needed.
- Users only see their own bands and the bands they have been invited to.
- User cannot select url slug, this is autocreated by the system using "short-uuid-bandnameSanitized"

## Iteration 9 — Monetization

**Goal:** Subscription plans, billing, and feature limits are implemented and enforced.

- Define and store subscription plans per band (`free`, `pro`, `pro-zero`)
- Implement checkout and subscription lifecycle (monthly/yearly billing for `pro`)
- Keep `pro-zero` as an internal non-bookable plan (assignable by dev/admin only)
- Enforce plan limits in API and UI
- Show current plan, limits, and upgrade actions in Dashboard/Billing
- Ensure existing band data remains accessible after downgrade with proper read-only/limit behavior

### Plan definition

- `bandstr free` (0 EUR)
- Includes:
  - Song voting
  - Setlist management (up to 15 songs)
  - Gig setlist management
  - Bierwart
  - Calendar
  - Band member availabilities
  - Up to 5 band members

- `bandstr pro` (29 EUR/year or 2.99 EUR/month)
- Includes:
  - No limitation in setlist size
  - No limitation in band member count
  - Shared notes on songs
  - Personal song notes
  - Import/export features for band data

- `bandstr pro-zero` (0 EUR, internal)
- Includes:
  - Same capabilities as `bandstr pro`
  - Not publicly bookable
  - Assignable only by development/admin team

**Backlog:** [`docs/backlog/iter-9-monetization.md`](./backlog/iter-9-monetization.md)

## Iteration 10 - Android app

**Goal:** A native android app is created

- The app is available as an apk
- the app is ready to be pushed to the GOogle Play Store
- the subscriptions can be managed using Google Play InApp Payments

**Backlog:** [`docs/backlog/iter-10-android-app.md`](./backlog/iter-10-android-app.md)


## Iteration 11 - iOS app

**Goal:** A native iOS app is created

- The app is available as an iOS bundle
- the app is ready to be pushed to the Apple Store
- the subscriptions can be managed using Apple InApp Payments
- ./do build–<whatever-the-format-is>  is created
- ./do deployd–<whatever-the-format-is>  is created  (for local deployment to connected devices)
- scripts with toolings required for Apple Store uploads are created (code signing? bundle creation?)


**Backlog:** [`docs/backlog/iter-11-ios-app.md`](./backlog/iter-11-ios-app.md)


## Iteration 12 - User self-registration

**Goal:** Users who do not want to use google/github for logging in can create an account

- An account can be created for an email address
- The email address needs to be verified
- The user can change the own email address (needs to be re-verified)
- The user can set a password
- Passwort is stored encrypted
- User can reset the password
- User can delete the account



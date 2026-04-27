# Iteration 16 - User Feedback #2

**Goal:** Feedback from users is incorporated with initials-only avatars, configurable push notifications, and rehearsal time proposals.

## Acceptance criteria

- [x] Avatar icons always show user initials (e.g. `CB`, `SA`) and do not load user profile images
- [x] Settings include customizable push notification toggles
- [x] Push notifications can be toggled per notification type
- [x] Push notification is created when a user adds a new absence and deep-links to the calendar entry
- [x] Push notification is created when a user adds/edits a gig and deep-links to the calendar entry
- [x] Push notification is created when a user adds/edits a rehearsal and deep-links to the start page
- [x] Push notification is created when a new song is suggested and deep-links to the voting page (and song details)
- [x] Users can suggest a different time for a rehearsal event
- [x] Rehearsal time proposals can be accepted/rejected by users and accepted proposals update rehearsal time
- [x] Push notifications are debounced by 20 seconds per changed element; only the latest change is delivered

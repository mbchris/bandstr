# Iteration 3 - calendar

## TASK-0301: Monthly Calendar Grid View
- **Status:** done
- **Labels:** feature, frontend
- **Acceptance Criteria:**
  - [x] Implement a responsive 7-column grid layout representing the days of the week.
  - [x] Support navigation between months (Previous/Next) and a "Today" button to return to the current month.
  - [x] Correct calculation of date offsets to ensure the 1st of the month aligns with the correct weekday.
  - [x] Visual indicators for days belonging to the previous or next month within the current grid view.
- **File hints:** `src/components/calendar/CalendarGrid.tsx`, `src/hooks/useCalendar.ts`

## TASK-0302: Event Creation and Management
- **Status:** done
- **Labels:** feature, backend
- **Acceptance Criteria:**
  - [x] Users can click a date cell to open a modal for creating a new event.
  - [x] Calendar entries have types: Rehearsal, Gig, Event, unavailability
  - [x] Support for event fields: Title, Description, Start Time, End Time, and Category/Color.
  - [x] Implement API endpoints for CRUD operations (Create, Read, Update, Delete) on events.
  - [x] Events must be persisted in the database and associated with the logged-in user's account.
  - [x] Calendar entries have owners. Either the user who created it or "Band" as owner (all band members can access)
  - [x] Calendar entry owner is shown and marked in different colors
- **File hints:** `src/server/api/routers/events.ts`, `src/components/calendar/EventModal.tsx`, `prisma/schema.prisma`

## TASK-0303: Calendar Event Display and Interactivity
- **Status:** done
- **Labels:** feature, design
- **Acceptance Criteria:**
  - [x] Render events as clickable blocks within their respective date cells.
  - [x] Truncate long event titles to fit within the cell while maintaining readability.
  - [x] Implement a "More" indicator if a day has more events than can be displayed in the cell height.
  - [x] Clicking an existing event opens an edit/view modal with the option to delete.
- **File hints:** `src/components/calendar/EventItem.tsx`, `src/styles/calendar.css`

## TASK-0304: Advanced Navigation and Responsiveness
- **Status:** done
- **Labels:** feature, frontend, ux
- **Acceptance Criteria:**
  - [x] Calendar is scrollable month-wise to allow for fluid transitions between months.
  - [x] Calendar is responsive, ensuring the grid and event details remain legible on mobile and tablet viewports.
- **File hints:** `src/components/calendar/CalendarGrid.tsx`, `src/styles/calendar.css`



## TASK-0305: Day View Modal (Mobile Optimization)
- **Status:** done
- **Labels:** feature, frontend, ux
- **Acceptance Criteria:**
  - [x] Clicking a day with events opens a dedicated "Day View" modal (especially for mobile).
  - [x] The Day View shows a vertical list of events with times and types.
  - [x] Clicking an event in the list opens the edit modal.
  - [x] A "Create Event" button is available in the Day View to add a new event for that day.
  - [x] If a day is empty, it still opens the creation form directly.

## TASK-0306: Tentative Calendar Entries
- **Status:** done
- **Labels:** feature, backend, frontend
- **Acceptance Criteria:**
  - [x] Add `isTentative` boolean to `calendar_events` table.
  - [x] Allow marking events as tentative in the calendar modal.
  - [x] Display "Tentative" badge or styling in the calendar grid.
  - [x] Show "Tentative" indicator in the "Upcoming Gigs" section on the home and rehearsal pages.

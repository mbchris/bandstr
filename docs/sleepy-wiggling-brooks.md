# bandstr: Migration to Quasar + Multi-Tenant SaaS

Summary of current status:


✅ Create branch and update permissions whitelist

✅ Initialize pnpm workspace monorepo structure

✅ Scaffold Hono API in packages/api

✅ Scaffold Quasar project in packages/web

✅ Create packages/shared with shared types

✅ Set up root package.json with workspace scripts

✅ Set up Drizzle PostgreSQL schema (Step 2)

✅ Set up Better Auth with Hono adapter (Step 2)

✅ Create auth/tenant/RBAC middleware (Step 2)

✅ Port API endpoints (Steps 2-3) — all routes implemented

✅ Set up Quasar frontend core (boot, stores, layouts, router)

✅ Add Docker Compose for local dev (PostgreSQL) + Coolify production deployment

✅ Port IndexPage (Dashboard) from Nuxt

✅ Port VotingPage from Nuxt

✅ Port SetlistPage from Nuxt

✅ Port CalendarPage from Nuxt

✅ Port AdminPage from Nuxt

✅ Port StandPage from Nuxt

✅ Implement Stripe billing API endpoints (checkout, portal, webhook) + BillingPage wiring (Step 7)

🟨 Capacitor mode scaffold created (`packages/web/src-capacitor`), but iOS/Android platform builds and deep-link config are still pending (Step 6)

✅ Added tracked Codex permissions config (`.codex/settings.local.json`) mirroring `.claude/settings.local.json`

## Context

bandstr is currently a single-band management webapp (Nuxt 3 + SQLite + Nitro). The goal is to transform it into a **multi-tenant SaaS platform** where multiple bands can sign up, manage setlists/voting/calendars, and be accessed via **web, iOS, and Android** (via Capacitor). Target scale: ~500 bands.

The current stack (Nuxt SSR + embedded SQLite) doesn't support native mobile builds or multi-tenancy. This plan migrates to **Quasar Framework** (Vue 3, SPA + Capacitor) with a **separate Hono API backend** and **PostgreSQL**.

---

## Architecture

```
packages/
  api/          → Hono + Drizzle ORM + PostgreSQL (REST API)
  web/          → Quasar (SPA + Capacitor for iOS/Android)
  shared/       → Shared TypeScript types
```

**Monorepo:** pnpm workspaces

### Backend: Hono
- Lightweight, TypeScript-first, similar mental model to Nitro's H3 event handlers
- Built-in Zod validation middleware (`@hono/zod-validator`)
- Hono Client (`hc`) for end-to-end typed API calls from the frontend
- Runs on Node.js, portable to edge later if needed

### Database: PostgreSQL with Row-Level Tenancy
- `band_id` column on every tenant-scoped table
- Drizzle ORM (same ORM, just switch adapter from better-sqlite3 to node-postgres)
- Drizzle Kit for proper migration management (replaces current inline try/catch ALTER TABLE)
- For 500 bands (~50k rows total), row-level tenancy with indexes is the right choice

### Auth: Better Auth
- Framework-agnostic (works with Hono natively)
- Built-in organization/multi-tenant plugin (maps to bands)
- Bearer token support (required for Capacitor mobile apps — cookies don't work well in WebViews)
- Google + GitHub OAuth providers (matching current setup)
- Replaces NextAuth / @sidebase/nuxt-auth

### Frontend: Quasar Framework
- SPA mode (no SSR — not needed with separate API, and required for Capacitor)
- Capacitor for iOS/Android native builds
- Pinia for state management (replaces Nuxt's `useFetch` pattern)
- Quasar components replace Nuxt UI (q-card, q-btn, q-dialog, q-input, etc.)

### Billing: Stripe
- Stripe Checkout (hosted payment page)
- Stripe Billing (recurring subscriptions)
- Stripe Customer Portal (self-service subscription management)
- Webhook-driven plan sync to `bands.plan` column

---

## Database Schema (PostgreSQL + Drizzle)

### New tables
```
bands          (id, name, slug, plan, stripe_customer_id, created_at)
band_members   (band_id, user_id, role ['owner'|'admin'|'member'], sort_order, is_hidden, beer_count, joined_at)
```

### Modified tables (all gain `band_id` FK)
```
users              → global (id, name, email, avatar_url, created_at) — no band_id
songs              → + band_id
votes              → + band_id
calendar_events    → + band_id
personal_notes     → + band_id
rehearsal_songs    → + band_id
gig_songs          → + band_id
```

**Key changes:**
- `users.role` and `users.sortOrder/isHidden/beerCount` move to `band_members` (per-band roles & settings)
- `users` becomes a global identity table (shared across bands)
- Auth tables managed by Better Auth (sessions, oauth_accounts, etc.)

---

## API Structure (Hono)

```
packages/api/src/
  index.ts                    # App entry, global middleware
  db/
    schema.ts                 # Drizzle PG schema
    index.ts                  # Connection pool (node-postgres)
    migrations/               # Drizzle Kit managed
  routes/
    auth.ts                   # Better Auth endpoints
    bands.ts                  # CRUD bands, invite members, switch band
    songs.ts                  # Port from server/api/songs/
    votes.ts                  # Port from server/api/votes/
    calendar.ts               # Port from server/api/calendar/
    gigs.ts                   # Port from server/api/gigs/
    rehearsals.ts             # Port from server/api/rehearsals/
    users.ts                  # Port from server/api/users/
    admin.ts                  # DB export/import, status
    billing.ts                # Stripe checkout/webhook/portal
  middleware/
    auth.ts                   # JWT/session verification via Better Auth
    tenant.ts                 # Extract bandId from header, validate membership, inject into context
    rbac.ts                   # Role-based checks (owner/admin/member per band)
  lib/
    spotify.ts                # Port from server/utils/spotify.ts
```

---

## Frontend Structure (Quasar)

```
packages/web/
  quasar.config.js
  src/
    boot/
      api.ts                  # Fetch/axios instance with auth token + X-Band-Id header
      auth.ts                 # Better Auth client
      i18n.ts                 # Port from composables/useI18n
    layouts/
      MainLayout.vue          # Nav drawer with band switcher
      AuthLayout.vue          # Login/register/onboarding
    pages/
      IndexPage.vue           # Dashboard (port from pages/index.vue)
      CalendarPage.vue        # Port from pages/calendar.vue
      SetlistPage.vue         # Port from pages/setlist.vue
      VotingPage.vue          # Port from pages/voting.vue
      StandPage.vue           # Port from pages/stand.vue
      AdminPage.vue           # Port from pages/admin.vue
      LoginPage.vue           # Port from pages/login.vue
      BandCreatePage.vue      # New: create/join band
      BillingPage.vue         # New: subscription management
    components/
      BeerRain.vue            # Direct port
      Markdown.vue            # Direct port
      BandSwitcher.vue        # New: band selection dropdown
    composables/
      useFormatDate.ts        # Direct port
      useExcelExport.ts       # Direct port
      useIcalExport.ts        # Direct port
    stores/                   # Pinia stores
      auth.ts                 # User session, active band
      band.ts                 # Current band info, members
      songs.ts                # Songs + votes
      calendar.ts             # Events
    router/
      routes.ts               # Route definitions with auth guards
```

---

## Decisions

- **Migration approach:** Clean break on a new branch (`feature/quasar-migration`). Remove Nuxt code, rebuild from scratch.
- **PostgreSQL hosting:** Coolify-managed PostgreSQL on the existing VPS.
- **Development approach:** Full scaffold upfront — set up both API + Quasar in one go for faster end-to-end feedback.

---

## Implementation Plan

### Step 1: Monorepo + Full Scaffold
1. Create branch `feature/quasar-migration`
2. Initialize pnpm workspace (`pnpm-workspace.yaml`) with `packages/api`, `packages/web`, `packages/shared`
3. Scaffold Hono API in `packages/api` (`pnpm create hono`)
4. Scaffold Quasar project in `packages/web` (`pnpm create quasar`) with TypeScript + Pinia + Vue Router
5. Create `packages/shared` for shared types (API request/response types)
6. Set up root `package.json` with workspace scripts (`dev`, `build`, `lint`, `typecheck`)
7. Add Docker Compose for local dev: PostgreSQL container + API dev server + Quasar dev server
8. Configure Coolify-managed PostgreSQL connection string in `.env`
9. Update `.claude/settings.local.json` with new tool permissions

### Step 2: Database + Auth Foundation
1. Define Drizzle PostgreSQL schema in `packages/api/src/db/schema.ts`:
   - New: `bands`, `band_members`
   - Ported + modified: `users` (global), `songs`, `votes`, `calendar_events`, `personal_notes`, `rehearsal_songs`, `gig_songs` (all with `band_id`)
2. Set up Drizzle Kit for migrations (`drizzle.config.ts`, `pnpm drizzle-kit generate`, `pnpm drizzle-kit migrate`)
3. Set up Better Auth with Hono adapter:
   - Google + GitHub OAuth providers
   - Organization plugin (maps to bands)
   - Bearer token support (for mobile)
4. Create auth middleware (`middleware/auth.ts`) — verify session/token
5. Create tenant middleware (`middleware/tenant.ts`) — extract `X-Band-Id` header, validate membership, inject into Hono context
6. Create RBAC middleware (`middleware/rbac.ts`) — check role per band
7. Seed script: create initial band + migrate data from current SQLite

### Step 3: Port API Endpoints
Port all endpoints to Hono routes with Zod validation. Every tenant-scoped query includes `WHERE band_id = ?`:

1. `routes/bands.ts` — **New:** create band, list user's bands, invite member, update band
2. `routes/songs.ts` — Port from `server/api/songs/`: GET (list), POST (create), PUT (update), DELETE, reorder, notes, lookup
3. `routes/votes.ts` — Port from `server/api/votes/`: POST (create/update/remove)
4. `routes/calendar.ts` — Port from `server/api/calendar/`: CRUD events
5. `routes/gigs.ts` — Port from `server/api/gigs/`: list gigs, gig songs, reorder, remove
6. `routes/rehearsals.ts` — Port from `server/api/rehearsals/`: next rehearsal
7. `routes/users.ts` — Port from `server/api/users/`: list members (scoped to band), update, reorder
8. `routes/admin.ts` — Port from `server/api/admin/`: status, DB export/import
9. `lib/spotify.ts` — Direct port from `server/utils/spotify.ts`

### Step 4: Quasar Frontend Core
1. Set up boot files:
   - `boot/api.ts` — fetch/axios instance injecting auth token + `X-Band-Id` header
   - `boot/auth.ts` — Better Auth client
   - `boot/i18n.ts` — port from `composables/useI18n.ts`
2. Create layouts:
   - `MainLayout.vue` — nav drawer with band switcher in header
   - `AuthLayout.vue` — login/register wrapper
3. Set up Pinia stores:
   - `stores/auth.ts` — user session, active bandId
   - `stores/band.ts` — current band info, members list
   - `stores/songs.ts` — songs + votes
   - `stores/calendar.ts` — events
4. Set up router with auth guards

### Step 5: Port Pages
Port 7 pages replacing Nuxt UI → Quasar components:

| Nuxt UI | Quasar |
|---------|--------|
| `UCard` | `q-card` |
| `UButton` | `q-btn` |
| `UModal` | `q-dialog` |
| `UInput` | `q-input` |
| `USelect` | `q-select` |
| `UAvatar` | `q-avatar` |
| `UBadge` | `q-badge` |
| `UTable` | `q-table` |

Pages to port (in order):
1. `LoginPage.vue` — OAuth buttons (test auth flow early)
2. `IndexPage.vue` — Dashboard (largest page, ~584 lines)
3. `VotingPage.vue` — Song voting
4. `SetlistPage.vue` — Setlist management with drag-and-drop
5. `CalendarPage.vue` — Calendar view
6. `AdminPage.vue` — Admin panel
7. `StandPage.vue` — Stage display

New pages:
8. `BandCreatePage.vue` — Create/join band onboarding
9. `BillingPage.vue` — Subscription management (Phase 4)

Port composables:
- `useFormatDate.ts` — direct port
- `useExcelExport.ts` — direct port
- `useIcalExport.ts` — direct port

Port components:
- `BeerRain.vue` — direct port
- `Markdown.vue` — direct port
- New: `BandSwitcher.vue`

### Step 6: Capacitor (Mobile)
1. `quasar mode add capacitor`
2. Configure `capacitor.config.ts` with API URL
3. Set up OAuth deep links (Universal Links for iOS, App Links for Android)
4. Test on iOS Simulator + Android Emulator
5. Mobile-specific adjustments (touch targets, safe areas, navigation)

### Step 7: Billing (Stripe)
1. `routes/billing.ts`:
   - `POST /billing/checkout` — create Stripe Checkout session
   - `POST /billing/webhook` — handle Stripe events
   - `GET /billing/portal` — return Customer Portal URL
2. Plan enforcement middleware (check limits on create operations)
3. `BillingPage.vue` in frontend
4. Plan tiers:
   - **Free:** 1 band, 20 songs, 5 members
   - **Band (~5 EUR/mo):** 1 band, unlimited songs, 10 members
   - **Pro (~12 EUR/mo):** 3 bands, unlimited everything

---

## Permissions Whitelist Additions

Add to `.claude/settings.local.json` allow list:

```json
"Bash(pnpm *)",
"Bash(pnpm install*)",
"Bash(pnpm add*)",
"Bash(pnpm remove*)",
"Bash(pnpm run *)",
"Bash(pnpm create *)",
"Bash(pnpm dev*)",
"Bash(pnpm build*)",
"Bash(pnpm exec *)",
"Bash(npx quasar *)",
"Bash(npx drizzle-kit *)",
"Bash(npx cap *)",
"Bash(npx capacitor *)",
"Bash(npx create-hono *)",
"Bash(npx create-quasar *)",
"Bash(npx better-auth *)",
"Bash(npx stripe *)",
"Bash(docker compose exec *)",
"Bash(curl *)"
```

Also replace npm-specific entries that are no longer needed (npm → pnpm):
- Remove: `Bash(npm run test)`, `Bash(npm run lint)`, `Bash(npm run typecheck)`, `Bash(npm run build)`, `Bash(npm run dev)`, `Bash(npm install*)`, `Bash(npm ci*)`, `Bash(npx nuxt *)`
- Keep: `Bash(npx eslint *)`, `Bash(npx tsx *)`, `Bash(node *)`

---

## Verification Plan

1. **API:** Run Hono dev server, test all endpoints with curl/httpie against PostgreSQL
2. **Auth:** Test Google + GitHub OAuth flow end-to-end (web + mobile simulator)
3. **Multi-tenancy:** Create 2 bands, verify data isolation (band A can't see band B's songs)
4. **Band switching:** Log in, switch between bands, verify correct data loads
5. **Frontend:** All 7 existing pages render and function correctly in Quasar
6. **Mobile:** Build Capacitor apps, test on iOS Simulator + Android Emulator
7. **Billing:** Test Stripe Checkout flow with test mode, verify webhook updates plan
8. **Data migration:** Run SQLite → PostgreSQL script, verify all existing data preserved

---

## Key Files to Reference During Implementation

| Current File | Purpose | Migration Target |
|---|---|---|
| `server/database/schema.ts` | Drizzle SQLite schema | `packages/api/src/db/schema.ts` (PG) |
| `server/database/index.ts` | DB init + migrations | `packages/api/src/db/index.ts` + Drizzle Kit |
| `server/api/songs/index.ts` | Song CRUD pattern | `packages/api/src/routes/songs.ts` |
| `server/api/auth/[...].ts` | NextAuth config | `packages/api/src/routes/auth.ts` (Better Auth) |
| `server/utils/spotify.ts` | Spotify lookup | `packages/api/src/lib/spotify.ts` |
| `pages/index.vue` | Dashboard (largest page) | `packages/web/src/pages/IndexPage.vue` |
| `composables/useI18n.ts` | i18n system | `packages/web/src/boot/i18n.ts` |
| `composables/useFormatDate.ts` | Date utils | `packages/web/src/composables/useFormatDate.ts` |
| `docker-compose.yml` | Docker setup | New compose with PG + API + Web containers |
| `.claude/settings.local.json` | Permissions | Add pnpm, quasar, drizzle-kit, capacitor commands |

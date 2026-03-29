# Iteration 1 — Foundation

<!-- iteration: Iteration 1 -->

## TASK-0101: Nuxt project scaffolding
- **Status:** done
- **Labels:** architecture
- **Acceptance Criteria:**
  - [x] `package.json` with Nuxt 3, Vue 3, TypeScript dependencies
  - [x] `nuxt.config.ts` with runtime config, Google Fonts, global CSS
  - [x] `tsconfig.json` extending Nuxt config
  - [x] Directory skeleton: `pages/`, `components/`, `layouts/`, `composables/`, `server/`, `assets/`, `public/`
- **File hints:** `package.json`, `nuxt.config.ts`, `tsconfig.json`

## TASK-0102: Docker deployment setup
- **Status:** done
- **Labels:** architecture, devops
- **Acceptance Criteria:**
  - [x] Multi-stage `Dockerfile` (build → production)
  - [x] `docker-compose.yml` with dev and prod profiles
  - [x] `.dockerignore` keeps build context lean
  - [x] Dev profile mounts source for hot-reload
- **File hints:** `Dockerfile`, `docker-compose.yml`

## TASK-0103: Design system & global styles
- **Status:** done
- **Labels:** feature, design
- **Acceptance Criteria:**
  - [x] CSS custom properties for colors, typography, spacing, radii
  - [x] Dark theme with accent gradient
  - [x] CSS reset and base styles
  - [x] Responsive breakpoints
- **File hints:** `assets/css/main.css`

## TASK-0104: Default layout with navigation
- **Status:** done
- **Labels:** feature, design
- **Acceptance Criteria:**
  - [x] Sticky header with glassmorphism backdrop
  - [x] Navigation links: Home, Events, Music, About, Contact
  - [x] Active link indicator animation
  - [x] Footer with copyright
  - [x] Responsive layout (mobile nav)
- **File hints:** `layouts/default.vue`

## TASK-0105: GitHub Actions CI pipeline
- **Status:** done
- **Labels:** devops
- **Acceptance Criteria:**
  - [x] Workflow runs on push to `main` and PRs
  - [x] Steps: install, lint, typecheck, build
  - [x] Uses Node 20
- **File hints:** `.github/workflows/ci.yml`

## TASK-0106: Environment configuration
- **Status:** done
- **Labels:** architecture
- **Acceptance Criteria:**
  - [x] `.env.template` with all configurable values
  - [x] `.gitignore` excludes `.env` but not `.env.template`
  - [x] `nuxt.config.ts` reads from env vars via `runtimeConfig`
- **File hints:** `.env.template`, `.gitignore`, `nuxt.config.ts`

## TASK-0107: Scripting
- **Status:** done
- **Labels:** architecture
- **Acceptance Criteria:**
  - [x] create a './do' script that can start the application locally, deploy to the target environment
  
 
  
## TASK-0109: CI/CD
- **Status:** done
- **Labels:** architecture
- **Acceptance Criteria:**
  - [x] the project shall be build using github actions on a runner with the tag 'self-hosted'

## TASK-0110: Developer Mode
- **Status:** done
- **Labels:** devmode
- **Acceptance Criteria:**
  - [x] There is a developer mode which works fully without login. 
  - [x] The developer mode is activated by setting the environment variable `DEVMODE=true`.
  
## TASK-0111: Tests
- **Status:** done
- **Labels:** tests
- **Acceptance Criteria:**
  - [x] Tests are created
  - [x] Links on voting page are validated, example for spotify: https://open.spotify.com/intl-de/track/1G391cbiT3v3Cywg8T7DM1?si=e1d91c6c490540c5
  - [x] Links on voting page are validated, example for youtube: https://www.youtube.com/watch?v=mLWP84ktoN4


## TASK-0108: Lightweight Database Persistence
- **Status:** done
- **Labels:** architecture, devops
- **Acceptance Criteria:**
  - [x] Support a lightweight file-based database (SQLite) for storing persistent data.
  - [x] Use Drizzle ORM for type-safe database access and schema management.
  - [x] Ensure the database persists across container updates by configuring a Docker volume in `docker-compose.yml`.
  - [x] Database tables are created automatically on startup if they don't exist.
- **File Hints:**
  - `server/database/index.ts`: Database connection and schema management.
  - `docker-compose.yml`: (Next step: add a volume for the `.data` directory).


## TASK-0112: Sample Data & Seeding Utility
- **Status:** done
- **Labels:** architecture, testing
- **Acceptance Criteria:**
  - [x] Seed the database with the band members:
      - Chris; schneider.chris@gmx.de; Admin
      - Andre; andrehoyer.ah@googlemail.com; User
      - Stefan; stefan@example.org; User
      - Andreas; andreas@example.org; User
      - Daniel; d.vollkommer@gmail.com; User

  - [x] Seed songs for the setlist:
        https://open.spotify.com/intl-de/track/5vfjUAhefN7IjHbTvVCT4Z?si=4ab5dfb87a1d44cd (Green day - Holiday),
        https://open.spotify.com/intl-de/track/4P4PHxZQ1FcwQKKnfEPsAZ?si=68958f13905f4bca (Die Ärzte - Schrei nach Liebe),
        https://open.spotify.com/intl-de/track/0iM1Ioz4N4p7MU1DKyqsov?si=1982a2ec6d844df5 (Interrupters - Bad Guy),
        https://open.spotify.com/intl-de/track/2XNaKS5wO5rPdgpPYVKria?si=f2c3a6dc0d144782 (H-Blockx - Countdown to Insanity),
        https://open.spotify.com/intl-de/track/2vx5Dc3Zxtd5yGDlh2pAAz?si=c19e003366684d9b (Mando Diao - Down in the past),
        https://open.spotify.com/intl-de/track/5W8YXBz9MTIDyrpYaCg2Ky?si=3ae221d3b6234a7c (Papa Roach - Last resort),
        https://open.spotify.com/intl-de/track/5RpBC0VsMMSRYJmSgUZqDu?si=6644d5bee27d45bb (The Bates - Billy Jean),
        https://open.spotify.com/intl-de/track/73PzrTVxMl8kmoSvFYLpig?si=b50ba624beaa41d3 (Me first and the gimme gimmes - Wild World)

  - [x] Seed songs for the voting list:
        https://open.spotify.com/intl-de/track/48UPSzbZjgc449aqz8bxox?si=4ef0218567534539 (RHCP - Californication),
        https://open.spotify.com/intl-de/track/20I8RduZC2PWMWTDCZuuAN?si=2ec0e818266942d2 (Franz Ferdinand - Take me out),
        https://open.spotify.com/intl-de/track/2P2kgRRvHflstcRHWC6v8n?si=2af35687dbf24627 (Die Atzen - Das geht ab),
        https://open.spotify.com/intl-de/track/0oIVNEkOgvOU9yG9oW13xC?si=499a70e53db54846 (Onkelz - Auf gute Freunde)


  - [x] Auto-generate 10 weeks of rehearsal events (Thursdays 8:00 pm - 11:00 pm based on current timestamp).
  - [x] Ensure the dates are shown in  the calendar
  - [x] Include upcoming gigs: "Gartenhallenbad" (in 3 weeks) and "Wrench Crew Party" (in 5 weeks) .
  - [x] Create a dedicated script to trigger seeding on demand.
  - [x] Add the `seed` command to the `./do` script for easier usage.
- **File Hints:**
  - `server/database/index.ts`: Current implementation of auto-seeding logic.
  - `packages/api/src/db/seed.ts`: Standalone seeding utility.
  - `scripts/seed_example.sql`: Seed content used by the seeding utility.
  - `./do`: Integration point for CLI usage.


## TASK-0113: Production & Staging Deployment (Coolify + Traefik)
- **Status:** done
- **Labels:** architecture, devops
- **Acceptance Criteria:**
  - [x] Configure `docker-compose.yml` with correct Traefik labels for both environments.
  - [x] Production routing: Host `bandstr.trmusic.de` and PathPrefix `/bandstr`.
  - [x] Staging routing: Host `bandstr.trmusic.de` and PathPrefix `/bandstr-staging`.
  - [x] Ensure `NUXT_APP_BASE_URL` is passed as an env var to the containers.
  - [x] Configure volumes for persistent data (`.data` directory) in both profiles.
  - [x] Ensure `./do` script supports local testing/deployment simulation for these paths.
- **File Hints:**
  - `docker-compose.yml`: Profile-specific labels and env.
  - `nuxt.config.ts`: Base URL handling (already exists, but needs verification).


  

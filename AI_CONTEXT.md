# AI_CONTEXT.md — Machine-Readable Project Context

## Project

- **Name:** bandstr
- **Type:** Multi-tenant band management SaaS
- **Architecture:** pnpm monorepo
- **Web Client:** Quasar + Vue 3 + TypeScript (`packages/web`)
- **API Service:** Hono + TypeScript (`packages/api`)
- **Shared Package:** `@bandstr/shared`
- **Repo:** `github.com/mbchris/bandstr`
- **Board:** [Iterative Development](https://github.com/users/mbchris/projects/3)

## Web Routes (Quasar)

| Route | File |
|---|---|
| `/` | `packages/web/src/pages/IndexPage.vue` |
| `/admin` | `packages/web/src/pages/AdminPage.vue` |
| `/band/new` | `packages/web/src/pages/BandCreatePage.vue` |
| `/billing` | `packages/web/src/pages/BillingPage.vue` |
| `/calendar` | `packages/web/src/pages/CalendarPage.vue` |
| `/login` | `packages/web/src/pages/LoginPage.vue` |
| `/setlist` | `packages/web/src/pages/SetlistPage.vue` |
| `/stand` | `packages/web/src/pages/StandPage.vue` |
| `/voting` | `packages/web/src/pages/VotingPage.vue` |

## Workspace Scripts (root `package.json`)

| Script | Purpose |
|---|---|
| `pnpm dev` | Start workspace dev servers in parallel |
| `pnpm dev:api` | Start `@bandstr/api` only |
| `pnpm dev:web` | Start `@bandstr/web` only |
| `pnpm build` | Build all workspace packages |
| `pnpm typecheck` | Type-check all workspace packages |
| `pnpm lint` | Lint all workspace packages |
| `pnpm db:generate` | Generate DB migration artifacts |
| `pnpm db:migrate` | Apply DB migrations |
| `pnpm db:seed` | Seed development database |
| `pnpm db:studio` | Open Drizzle Studio |

## Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `NODE_ENV` | API | Runtime mode |
| `PORT` | API | API port (default `3001`) |
| `API_URL` | API/Web | Public API base URL |
| `DATABASE_URL` | API | PostgreSQL connection string |
| `AUTH_SECRET` | API | Better Auth / auth secret |
| `CORS_ORIGINS` | API | Comma-separated allowed origins |
| `GOOGLE_CLIENT_ID` | API | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | API | Google OAuth client secret |
| `GHUB_CLIENT_ID` | API | GitHub OAuth client id |
| `GHUB_CLIENT_SECRET` | API | GitHub OAuth client secret |
| `STRIPE_SECRET_KEY` | API | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | API | Stripe webhook signing secret |
| `STRIPE_PRICE_BAND` | API | Stripe price id (Band tier) |
| `STRIPE_PRICE_PRO` | API | Stripe price id (Pro tier) |
| `GIT_REV` | API | Build/version identifier |

## Backlog Format

Files in `docs/backlog/iter-*.md`:

```
<!-- iteration: Iteration N -->

## TASK-XXYY: Task title
- **Status:** todo | in progress | done
- **Labels:** label1, label2
- **Acceptance Criteria:**
  - [ ] Criterion 1
  - [ ] Criterion 2
- **File hints:** `path/to/file`
```

Cross-reference after sync: `<!-- gh:#42 -->` is injected before the `## TASK-` line.

## Sync Workflow

```
docs/backlog/  →  sync-backlog.sh  →  GitHub Issues  →  Projects Board
                  (--apply --project)   (auto-created)    (Iteration field)
```

The sync reads `GH_TOKEN`, `GH_REPO`, `GH_PROJECT_NUMBER`, `GH_PROJECT_OWNER` from `.env`.

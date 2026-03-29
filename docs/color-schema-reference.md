# bandstr Color Schema Reference

This file lists the currently used app colors for bright (light) and dark modes, plus where to change them.

## 1) Global Brand Palette (Quasar Theme)

Edit file: `packages/web/src/css/quasar.variables.scss`

| Token | Current Color | Used For | Text Example |
|---|---|---|---|
| `$primary` | `#6366f1` | Primary buttons, active accents | `Open Band App`, `Create Band` |
| `$secondary` | `#94a3b8` | Secondary accents | `Dashboard` support UI |
| `$accent` | `#f43f5e` | Accent highlights | action emphasis |
| `$dark` | `#161b22` | Dark base theme color | dark page background |
| `$positive` | `#10b981` | Success badges/messages | `Joined <band>` |
| `$negative` | `#ef4444` | Destructive actions/errors | `Delete`, failed actions |
| `$info` | `#3b82f6` | Informational status | `Active` invite badge |
| `$warning` | `#f59e0b` | Warning states | `Expired` invite badge |

## 2) Dark Mode Surface + Text Tokens

Edit file: `packages/web/src/css/app.scss`

| Element | Dark Mode Color(s) | Bright Mode Color(s) | Text Example |
|---|---|---|---|
| App background | `--surface: #161b22` | default Quasar light background | `Dashboard`, `Admin` pages |
| Raised cards | `--surface-raised: #18181b` | default card background | `Manage Bands`, `Band Members` cards |
| Overlay/dialog/menu | `--surface-overlay: #27272a` | default dialog/menu background | `Create Band`, `Invitation Codes` dialogs |
| Main text | `--text: #f4f4f5` | default Quasar text | `Manage your bands...` |
| Muted text | `--text-muted: #a1a1aa` | `text-grey-*` utility shades | `Current plan: ...`, caption lines |
| Borders | `--border: rgba(255,255,255,0.08)` | light borders from Quasar | card/table/input borders |
| Strong borders | `--border-strong: rgba(255,255,255,0.14)` | light equivalents from Quasar | focused surfaces, menus |

## 3) Top Navigation Bar Colors

Edit file: `packages/web/src/layouts/MainLayout.vue`

| Element | Bright Mode Color | Dark Mode Color | Text Example |
|---|---|---|---|
| Top nav background | `rgba(243, 244, 246, 0.92)` | inherited from dark header styles | nav row containing `Home`, `Voting`, `Setlist` |
| Top nav border | `rgba(17, 24, 39, 0.08)` | inherited from dark header styles | separator below toolbar |
| Nav text | `#374151` | inherited dark text styles | `Home`, `Calendar` |
| Active nav bg | `rgba(148, 163, 184, 0.24)` | inherited dark active styles | selected nav item |
| Active nav border | `rgba(100, 116, 139, 0.42)` | inherited dark active styles | selected nav item border |
| Active nav text | `#111827` | inherited dark active text | selected nav label |

## 4) Other Explicit Color Codes In Components

| File | Current Color(s) | Where It Appears | Text Example |
|---|---|---|---|
| `packages/web/src/layouts/AuthLayout.vue` | `linear-gradient(...rgba(3,8,20,0.7)...rgba(16,21,35,0.45))`, `rgba(8,13,25,0.6)`, `rgba(255,255,255,0.24)` | Login background + auth card | `Band management for musicians` |
| `packages/web/src/pages/LoginPage.vue` | `rgba(255,255,255,0.35)` | Login button border in dark card | `Sign in with Google` |
| `packages/web/src/pages/IndexPage.vue` | `rgba(148,163,184,0.12)`, `rgba(148,163,184,0.28)`, `rgba(39,39,42,0.92)`, `rgba(161,161,170,0.34)`, `rgba(244,244,245,0.88)` | rehearsal/gig info cards | `Next Rehearsal`, `Upcoming Gigs` |
| `packages/web/src/pages/CalendarPage.vue` | `rgba(0,0,0,0.08)`, `rgba(0,0,0,0.03)` | calendar cell and hover borders/backgrounds | `Create Event`, `Today` |
| `packages/web/src/pages/StandPage.vue` | `#f9f9f9`, `#e0e0e0`, `#9e9e9e` | stand placeholders and helper text | `Strength Points` |
| `packages/web/src/pages/VotingPage.vue` | `#9ca3af`, `#ef4444`, `#f97316`, `#3b82f6`, `#22c55e` | vote ring/border states | `Voting`, `Suggest Song` |

## 5) Quasar Utility/Named Colors Used in Templates

These are token names used in Vue templates (not hardcoded hex in repo files).  
Update either:
- global palette in `packages/web/src/css/quasar.variables.scss` (primary/positive/negative/info/warning/dark), and/or
- component usages in page files for `grey-*`, `blue`, `orange`, `red`, `green`, `white`, etc.

Most-used tokens found in templates:
- `primary`, `positive`, `negative`, `warning`, `info`, `dark`, `white`
- `red`, `green`, `blue`, `orange`
- `grey`, `grey-2`, `grey-3`, `grey-4`, `grey-6`, `grey-7`, `grey-8`, `grey-9`
- utility classes like `text-grey`, `text-grey-7`, `bg-grey-2`, `bg-orange-1`, `text-blue-9`

Common files to edit for these:
- `packages/web/src/pages/DashboardPage.vue`
- `packages/web/src/pages/AdminPage.vue`
- `packages/web/src/pages/IndexPage.vue`
- `packages/web/src/pages/CalendarPage.vue`
- `packages/web/src/pages/SetlistPage.vue`
- `packages/web/src/pages/VotingPage.vue`
- `packages/web/src/pages/StandPage.vue`

## 6) Quick Text Examples (UI)

Use these labels when verifying color changes in the UI:
- `Dashboard`
- `Manage Bands`
- `Join Band`
- `Manage Subscriptions`
- `Band Members`
- `Invitation Codes`
- `Create Band`
- `Open Billing`
- `Home`
- `Calendar`

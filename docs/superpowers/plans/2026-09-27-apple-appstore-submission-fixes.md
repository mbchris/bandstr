# Apple App Store Submission Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 6 Apple App Store review rejection findings across mobile authentication, in-app browser UX, reviewer demo account seeding, email verification, public support URL, and account deletion discoverability.

**Architecture:** Use `@capacitor/browser` to replace external Safari redirects with an in-app `SFSafariViewController` sheet during native OAuth; add Sign in with Apple support to Better Auth backend and frontend; expose public support routing for App Store Connect Support URL; add explicit in-app account deletion links; build an idempotent reviewer demo account CLI command with populated data; and provide structured answers for Apple's business model questionnaire.

**Tech Stack:** Quasar v2, Vue 3, TypeScript, Capacitor v7, Hono, Better Auth, Drizzle ORM, PostgreSQL.

**Spec:** [docs/superpowers/specs/2026-09-27-apple-appstore-submission-fixes-design.md](file:///Users/chris/code/prj120/bandstr/docs/superpowers/specs/2026-09-27-apple-appstore-submission-fixes-design.md)

## Global Constraints

- TypeScript strict mode must pass without errors (`pnpm --filter @bandstr/api typecheck` and `pnpm --filter @bandstr/web typecheck`).
- Code must adhere to existing project linting rules (`pnpm --filter @bandstr/api lint` and `pnpm --filter @bandstr/web lint`).
- Existing tests in both packages must continue passing.
- Database changes must be idempotent and allow setting up from scratch.

## Review Focus

1. **Native OAuth Dismissal:** Ensure in-app `SFSafariViewController` cleanly closes when deep-linking back into the app (`org.capacitor.bandstr://...`) and doesn't leave an orphaned browser overlay.
2. **Public Support Access:** Ensure unauthenticated visitors visiting `/support` do not trigger an auth redirect loop or error when fetching support configuration without credentials.
3. **Demo Account Authentication:** Verify Better Auth password verification passes for `appcert@example.org` when seeded via the admin CLI.
4. **Discoverable Account Deletion:** Verify account deletion navigation is immediately visible in the user menu without requiring direct URL typing.
5. **Apple Sign In Fallback:** Ensure that if Apple Developer credentials (`APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`) are not yet set in environment, the app does not crash or fail startup.

---

### Task 1: Public Support Page & Support URL Routing (Guideline 1.5)

**Files:**
- Modify: `packages/web/src/router/routes.ts`
- Modify: `packages/web/src/pages/SupportPage.vue`
- Modify: `packages/api/src/routes/support.ts`
- Test: `packages/api/tests/routes/support.test.ts`
- Test: `packages/web/test/routes.test.ts`

**Interfaces:**
- Consumes: `GET /api/support/config`, `POST /api/support/tickets`
- Produces: Public `/support` route rendered under `PublicLayout.vue`

- [ ] **Step 1: Write the failing tests**
  - Add test in `packages/api/tests/routes/support.test.ts` verifying `GET /api/support/config` and `POST /api/support/tickets` succeed for unauthenticated public requests when providing an email.
  - Create test `packages/web/test/routes.test.ts` asserting `/support` does not have `requiresAuth: true`.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @bandstr/api test support.test.ts`
  - Expected: FAIL (`GET /api/support/config rejects unauthenticated requests with 401`).

- [ ] **Step 3: Update `packages/api/src/routes/support.ts`**
  - Allow optional authentication on `/api/support/config` and `/api/support/tickets`: if authenticated, use user id/email; if anonymous, accept email in request body.

- [ ] **Step 4: Update `packages/web/src/router/routes.ts` and `SupportPage.vue`**
  - Move `/support` under `PublicLayout.vue` (public routes group alongside `/impress` and `/gdpr`).
  - In `SupportPage.vue`, display official contact email (`support@4ki.app`), FAQ accordion (Login, Band Invites, Subscriptions), ticket submission form, and links to `/impress` and `/gdpr`.

- [ ] **Step 5: Run tests and verify they pass**
  - Run: `pnpm --filter @bandstr/api test support.test.ts && pnpm --filter @bandstr/web test`
  - Expected: PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add packages/api/src/routes/support.ts packages/api/tests/routes/support.test.ts packages/web/src/router/routes.ts packages/web/src/pages/SupportPage.vue packages/web/test/routes.test.ts
  git commit -m "feat(support): make support route public and update support page for app store compliance"
  ```

---

### Task 2: Account Deletion UI Discoverability (Guideline 4)

**Files:**
- Modify: `packages/web/src/layouts/MainLayout.vue:364-415`
- Modify: `packages/web/src/pages/DashboardPage.vue`
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`
- Test: `packages/web/test/navigation.test.ts`

**Interfaces:**
- Consumes: `/delete-account` route, `useI18n`
- Produces: Visual navigation links to Account Security & Deletion

- [ ] **Step 1: Write the failing test**
  - Add test in `packages/web/test/navigation.test.ts` verifying that `MainLayout` contains a link or action navigating to `/delete-account`.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @bandstr/web test navigation.test.ts`
  - Expected: FAIL (link to `/delete-account` not found in menu).

- [ ] **Step 3: Implement navigation links**
  - In `packages/web/src/layouts/MainLayout.vue`: Add a `q-item` in the account menu before `Sign Out`:
    - Label: `t('nav.deleteAccount')` ("Account Security & Deletion" / "Konto löschen")
    - Icon: `delete_forever`
    - Action: `router.push('/delete-account')`
  - In `packages/web/src/pages/DashboardPage.vue`: Add a direct link in the user profile section to `/delete-account`.
  - Add translation keys `nav.deleteAccount` to `en.ts` and `de.ts`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm --filter @bandstr/web test navigation.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/web/src/layouts/MainLayout.vue packages/web/src/pages/DashboardPage.vue packages/web/src/i18n/en.ts packages/web/src/i18n/de.ts packages/web/test/navigation.test.ts
  git commit -m "feat(account): add discoverable account deletion navigation in user menu and dashboard"
  ```

---

### Task 3: In-App Safari View Controller for Mobile OAuth (Guideline 4)

**Files:**
- Modify: `packages/web/package.json`
- Modify: `packages/web/src/pages/LoginPage.vue`
- Test: `packages/web/test/login-browser.test.ts`

**Interfaces:**
- Consumes: `@capacitor/browser`, `Capacitor.isNativePlatform()`
- Produces: `Browser.open` and `Browser.close` invocation during native social login

- [ ] **Step 1: Install `@capacitor/browser`**
  - Run: `pnpm --filter @bandstr/web add @capacitor/browser`

- [ ] **Step 2: Write unit test for mobile OAuth browser handling**
  - Create `packages/web/test/login-browser.test.ts` verifying that when `isNative` is true, starting social login calls `Browser.open({ presentationStyle: 'popover' })` instead of `window.open()`, and receipt of auth token invokes `Browser.close()`.

- [ ] **Step 3: Run test to verify it fails**
  - Run: `pnpm --filter @bandstr/web test login-browser.test.ts`
  - Expected: FAIL.

- [ ] **Step 4: Update `packages/web/src/pages/LoginPage.vue`**
  - Import `Browser` from `@capacitor/browser`.
  - In `startNativeSocialLogin(provider)`:
    ```ts
    if (isNative) {
      await Browser.open({ url: startUrl, presentationStyle: 'popover' })
      return
    }
    ```
  - In `onMounted` and token watch handler: call `Browser.close().catch(() => undefined)` as soon as token exchange or verification completes.

- [ ] **Step 5: Run tests and verify they pass**
  - Run: `pnpm --filter @bandstr/web test login-browser.test.ts`
  - Expected: PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add packages/web/package.json pnpm-lock.yaml packages/web/src/pages/LoginPage.vue packages/web/test/login-browser.test.ts
  git commit -m "feat(auth): use in-app Safari View Controller via Capacitor Browser for native oauth"
  ```

---

### Task 4: Sign in with Apple Backend & Frontend Integration (Guideline 4.8)

**Files:**
- Modify: `packages/api/src/lib/auth.ts`
- Modify: `packages/api/src/app.ts`
- Modify: `packages/web/src/pages/LoginPage.vue`
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`
- Test: `packages/api/tests/routes/auth-apple.test.ts`
- Test: `packages/web/test/login-apple.test.ts`

**Interfaces:**
- Consumes: Better Auth Apple social provider, `startNativeSocialLogin('apple')`
- Produces: `/api/mobile-auth/start?provider=apple`, Sign in with Apple UI button

- [ ] **Step 1: Write failing tests**
  - Add test in `packages/api/tests/routes/auth-apple.test.ts` verifying `GET /api/mobile-auth/start?provider=apple&callbackURL=...` is supported.
  - Add test in `packages/web/test/login-apple.test.ts` verifying the "Sign in with Apple" button renders on iOS and web.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `pnpm --filter @bandstr/api test auth-apple.test.ts`
  - Expected: FAIL (`Unsupported provider`).

- [ ] **Step 3: Configure Apple provider in `packages/api/src/lib/auth.ts` and `app.ts`**
  - In `packages/api/src/app.ts`: Add `'apple'` to `SUPPORTED_SOCIAL_PROVIDERS`.
  - In `packages/api/src/lib/auth.ts`: Add `apple` to `socialProviders`:
    ```ts
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
    }
    ```

- [ ] **Step 4: Update `packages/web/src/pages/LoginPage.vue`**
  - Add `loadingApple = ref(false)` and `loginApple()` method.
  - Add "Sign in with Apple" button following Apple HIG styling (black background, white Apple icon, text `Sign in with Apple` / `Mit Apple anmelden`).
  - Wire button to `loginApple()` which invokes `startNativeSocialLogin('apple')` on native or `authClient.signIn.social({ provider: 'apple' })` on web.

- [ ] **Step 5: Run tests and verify they pass**
  - Run: `pnpm --filter @bandstr/api test auth-apple.test.ts && pnpm --filter @bandstr/web test login-apple.test.ts`
  - Expected: PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add packages/api/src/lib/auth.ts packages/api/src/app.ts packages/api/tests/routes/auth-apple.test.ts packages/web/src/pages/LoginPage.vue packages/web/src/i18n/en.ts packages/web/src/i18n/de.ts packages/web/test/login-apple.test.ts
  git commit -m "feat(auth): add Sign in with Apple backend provider and login button"
  ```

---

### Task 5: App Store Reviewer Demo Account Seeding CLI (Guideline 2.1)

**Files:**
- Modify: `packages/api/src/cli/admin.ts`
- Test: `packages/api/tests/cli/seed-demo-account.test.ts`

**Interfaces:**
- Consumes: Better Auth password hashing algorithm / scrypt, `db`, `schema.users`, `schema.accounts`, `schema.bands`
- Produces: CLI command `seed-demo-account`

- [ ] **Step 1: Write failing test**
  - Create `packages/api/tests/cli/seed-demo-account.test.ts` testing the demo account creation function: user is created, email verified, credential password row inserted into `account` table, attached as owner of demo band with songs and rehearsals.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @bandstr/api test seed-demo-account.test.ts`
  - Expected: FAIL (`function seedDemoAccount is not defined`).

- [ ] **Step 3: Implement `seedDemoAccount` in `packages/api/src/cli/admin.ts`**
  - Parse CLI arguments `--email`, `--password`, `--name`, `--band-name`.
  - Hash password using Better Auth's password hashing helper.
  - Upsert into `users` (`emailVerified = true`, `devProPlan = true`).
  - Upsert into `accounts` (`providerId = 'credential'`, `password = <hashed_password>`).
  - Upsert demo band ("The Bandstr Demo Band") with sample songs, setlists, gigs, rehearsals, and member role `owner`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm --filter @bandstr/api test seed-demo-account.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/api/src/cli/admin.ts packages/api/tests/cli/seed-demo-account.test.ts
  git commit -m "feat(admin): add seed-demo-account CLI command for App Store review demo credentials"
  ```

---

### Task 6: Email Verification Delivery Documentation & Signup Resilience (Guideline 2.1(a))

**Files:**
- Modify: `.env.api.template`
- Modify: `packages/web/src/pages/LoginPage.vue`
- Modify: `packages/web/src/i18n/en.ts`
- Modify: `packages/web/src/i18n/de.ts`
- Test: `packages/web/test/signup-verification.test.ts`

**Interfaces:**
- Consumes: `POST /api/auth/send-verification-email`
- Produces: Resend verification email button and clear status messaging

- [ ] **Step 1: Write failing test**
  - Add test in `packages/web/test/signup-verification.test.ts` verifying that after sign up, the user can click "Resend verification email".

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm --filter @bandstr/web test signup-verification.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Update `.env.api.template` and `LoginPage.vue`**
  - Add full documentation of SMTP variables (`AUTH_EMAIL_SMTP_HOST`, `AUTH_EMAIL_SMTP_PORT`, `AUTH_EMAIL_SMTP_USER`, `AUTH_EMAIL_SMTP_PASSWORD`, `AUTH_EMAIL_SMTP_FROM_EMAIL`, `AUTH_EMAIL_SMTP_STARTTLS`) in `.env.api.template`.
  - In `LoginPage.vue`: When account is created, store `signupEmail` and display an info banner with a "Resend verification email" action button that calls `postAuth('/send-verification-email', { email })`.
  - Add translations for resend verification flow.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm --filter @bandstr/web test signup-verification.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add .env.api.template packages/web/src/pages/LoginPage.vue packages/web/src/i18n/en.ts packages/web/src/i18n/de.ts packages/web/test/signup-verification.test.ts
  git commit -m "feat(auth): document SMTP settings and add resend verification email option"
  ```

---

### Task 7: App Store Connect Submission Package & Resolution Copy (Guideline 2.1(b))

**Files:**
- Create: `APPLE_APPSTORE_SUBMISSION.md`
- Test: Documentation validation

**Interfaces:**
- Consumes: Spec and resolution requirements
- Produces: Complete submission guide and copy-paste text for App Store Connect Resolution Center

- [ ] **Step 1: Create `APPLE_APPSTORE_SUBMISSION.md`**
  - Include:
    - Step-by-step checklist for resubmission.
    - Updated App Store Connect fields (Support URL: `https://bandstr.apps.4ki.app/support`, Demo account credentials).
    - Verbatim answers to Apple's 4 business model questions under Guideline 2.1(b).
    - Resolution Center response message addressing each guideline (4.8, 4, 2.1, 2.1(a), 1.5, 2.1(b)).

- [ ] **Step 2: Commit**
  ```bash
  git add APPLE_APPSTORE_SUBMISSION.md
  git commit -m "docs: add Apple App Store resubmission package and Resolution Center responses"
  ```

---

### Task 8: Full Verification & Typechecking

- [ ] **Step 1: Run comprehensive tests and typecheck across packages**
  - Run: `pnpm --filter @bandstr/api test`
  - Run: `pnpm --filter @bandstr/web test`
  - Run: `pnpm --filter @bandstr/api typecheck`
  - Run: `pnpm --filter @bandstr/web typecheck`
  - Run: `pnpm --filter @bandstr/api lint`
  - Run: `pnpm --filter @bandstr/web lint`
  - Expected: All checks pass cleanly with 0 errors.

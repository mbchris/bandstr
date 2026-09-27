# Apple App Store Submission Fixes — Design Specification

**Date:** 2026-09-27  
**Status:** Approved  
**Related Documents:** [APPLE_APPSTORE.md](../../../APPLE_APPSTORE.md)

---

## 1. Executive Summary

During submission of the bandstr iOS app (Submission ID: `384ac34e-ab2a-4d6a-82f6-22f7b739c6ab`, Version 1.0 (8)), Apple App Review identified findings across six guidelines:
1. **Guideline 4.8 (Design - Login Services):** Third-party login (Google, GitHub) is offered without an equivalent option supporting privacy-preserving identity (Sign in with Apple).
2. **Guideline 4 (Design):** OAuth redirects users into the external Safari web browser rather than remaining within the app; account deletion must also be offered and discoverable.
3. **Guideline 2.1 (Information Needed):** Demo account credentials (`appcert@example.org`) failed to authenticate.
4. **Guideline 2.1(a) (Performance - App Completeness):** Account registration did not deliver a verification email to the reviewer.
5. **Guideline 1.5 (Safety):** The Support URL (`https://4ki.app/`) does not lead to a functional user support page.
6. **Guideline 2.1(b) (Information Needed):** Apple requested business model clarification regarding paid features and In-App Purchase compliance.

This design document outlines the technical architecture, component modifications, data flows, and review response copy required to resolve all findings and ensure App Store compliance.

---

## 2. Technical Architecture & Component Changes

### 2.1 Sign in with Apple (Guideline 4.8)

#### Better Auth Backend Configuration
- **File:** `packages/api/src/lib/auth.ts`
- Add `apple` provider to Better Auth `socialProviders`:
  ```ts
  socialProviders: {
    google: { ... },
    github: { ... },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? '', // Services ID, e.g., org.capacitor.bandstr.client
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
    },
  }
  ```
- **File:** `packages/api/src/app.ts`
  - Include `'apple'` in `SUPPORTED_SOCIAL_PROVIDERS`.

#### Mobile and Web Frontend UI
- **File:** `packages/web/src/pages/LoginPage.vue`
  - Add "Sign in with Apple" button styled per Apple Human Interface Guidelines:
    - Black background, white Apple icon and text.
    - Rendered on web and iOS native platforms.
  - Implement `loginApple()` which invokes `authClient.signIn.social({ provider: 'apple', callbackURL })` on web, and `startNativeSocialLogin('apple')` on native mobile.

---

### 2.2 In-App OAuth Browser & Account Deletion Discoverability (Guideline 4)

#### In-App Safari View Controller for Native OAuth
- **Package dependency:** Add `@capacitor/browser` to `packages/web/package.json`.
- **File:** `packages/web/src/pages/LoginPage.vue`
  - Replace `window.open(startUrl, '_blank')` in `startNativeSocialLogin` with:
    ```ts
    import { Browser } from '@capacitor/browser'
    ...
    await Browser.open({ url: startUrl, presentationStyle: 'popover' })
    ```
  - When the OAuth flow redirects to the custom scheme (`org.capacitor.bandstr://...`), dismiss the in-app browser by calling `await Browser.close()`.
  - On iOS, `@capacitor/browser` uses `SFSafariViewController`, preserving in-app experience and displaying the secure URL bar and SSL badge as requested by Apple.

#### Account Deletion Discoverability
- The deletion mechanism already exists at `/delete-account` (`packages/web/src/pages/DeleteAccountPage.vue`) and calls `DELETE /api/account`.
- **Navigation enhancements:**
  - Add an explicit menu entry in `packages/web/src/layouts/MainLayout.vue` account dropdown:
    - Route: `/delete-account`
    - Label: `Account Security & Deletion` / `Konto löschen`
    - Icon: `delete_forever`
  - Add an account deletion link on the `packages/web/src/pages/DashboardPage.vue` user profile card.

---

### 2.3 Reviewer Demo Account & Database Seeding (Guideline 2.1)

#### Admin CLI Command
- **File:** `packages/api/src/cli/admin.ts`
- Implement `seed-demo-account` command:
  ```bash
  node /app/packages/api/dist/cli/admin.js seed-demo-account --email "appcert@example.org" --password "<password>" [--name "App Store Reviewer"]
  ```
- Behavior:
  1. Upsert `user` record with `email = 'appcert@example.org'`, `emailVerified = true`, and `devProPlan = true`.
  2. Compute password hash using scrypt (Better Auth compatible password hashing format) and upsert into the `account` table with `providerId = 'credential'`.
  3. Ensure a demo band ("The Bandstr Demo Band") exists with realistic sample data:
     - Upcoming rehearsal and gig calendar events.
     - Song repertoire with Spotify links and setlist assignments.
     - Voting records and attendance entries.
  4. Ensure `appcert@example.org` is assigned as `owner` in `band_members` for the demo band.

---

### 2.4 Email Verification Delivery & Resilience (Guideline 2.1(a))

#### Production SMTP Configuration & Verification
- Document mandatory environment variables in `.env.api.template` and deployment instructions:
  - `AUTH_EMAIL_SMTP_HOST`
  - `AUTH_EMAIL_SMTP_PORT`
  - `AUTH_EMAIL_SMTP_USER`
  - `AUTH_EMAIL_SMTP_PASSWORD`
  - `AUTH_EMAIL_SMTP_FROM_EMAIL`
- Verify mail delivery using existing tool `packages/api/src/cli/mail-test.ts`:
  ```bash
  pnpm --filter @bandstr/api mail-test send --to "test@example.com" --kind verify-email
  ```

#### Frontend Registration Resilience
- **File:** `packages/web/src/pages/LoginPage.vue`
  - Add clear verification instructions upon sign-up completion.
  - Provide a "Resend verification email" button that triggers `postAuth('/send-verification-email', { email })` so users can request a fresh token if an email is delayed or lost.

---

### 2.5 Public Support Webpage & App Store Connect Support URL (Guideline 1.5)

#### Routing & Layout Changes
- **File:** `packages/web/src/router/routes.ts`
  - Move route `/support` from `MainLayout` (which requires authentication) to `PublicLayout` so it is publicly accessible without login.
  - If a user is logged in, show their context (auto-populated email); if unauthenticated, allow public submission with email input.

#### Support Page Content
- **File:** `packages/web/src/pages/SupportPage.vue`
  - Publicly accessible support information:
    - Official contact email (`support@4ki.app` or `contact@bandstr.com`).
    - FAQ accordion for recurring questions (account creation, band invitations, setlists, subscription).
    - Existing interactive support ticket form (calls `POST /api/support/tickets`).
    - Footer links to Legal Notice (`/impress`) and Privacy Policy (`/gdpr`).
  - Configured Support URL in App Store Connect: `https://bandstr.apps.4ki.app/support`.

---

### 2.6 Apple App Store Questionnaire Responses (Guideline 2.1(b))

Ready-to-submit answers for App Store Connect Resolution Center:

1. **Who are the users that will use the paid features in the app?**
   *Musicians, band members, and band managers using bandstr to coordinate rehearsal schedules, manage song repertoires, vote on new material, and organize gig setlists.*

2. **Where can users purchase the features that can be accessed in the app?**
   *Users can purchase the "bandstr pro" subscription directly within the iOS app using Apple In-App Purchase (StoreKit auto-renewable subscriptions). Subscriptions are also available on Android via Google Play and on the web via Stripe.*

3. **What specific types of previously purchased features can a user access in the app?**
   *A user with an active "bandstr pro" subscription accesses unlimited setlist size, unlimited band member limits, personal and shared song notes, and data export/import. In bandstr's cooperative band model ("bandstr plus"), when any member of a band holds a Pro subscription, all members of that band inherit Pro feature access within that band.*

4. **What paid content, subscriptions, or features are unlocked within the app that do not use In-App Purchase?**
   *None that circumvent In-App Purchase. In accordance with Guideline 3.1.3(b) (Multiplatform Services), users who previously subscribed on other platforms (such as the web or Google Play) may access their subscription benefits in the iOS app upon logging into their account. All subscription tiers available across other platforms are also offered directly inside the iOS app via Apple In-App Purchase at equivalent terms.*

---

## 3. Testing & Verification Strategy

1. **OAuth & SFSafariViewController:**
   - Run Capacitor iOS build in Simulator/Device.
   - Verify tapping Google/GitHub/Apple opens an in-app `SFSafariViewController` sheet rather than Safari.
   - Verify deep-link returns token and dismisses browser cleanly.
2. **Account Deletion:**
   - Navigate to `/delete-account` from account menu.
   - Confirm deletion deletes session, revokes bearer token, and removes user record from database.
3. **Demo Account:**
   - Execute `seed-demo-account` CLI.
   - Log in with `appcert@example.org` on web and mobile; confirm instant login and presence of populated band data.
4. **Support Page:**
   - Open `https://bandstr.apps.4ki.app/support` in an incognito window.
   - Confirm page loads without authentication redirect, displays support contact info, FAQ, and allows submitting a ticket.
5. **Linting & Typechecking:**
   - Run `pnpm --filter @bandstr/web lint && pnpm --filter @bandstr/web typecheck`.
   - Run `pnpm --filter @bandstr/api lint && pnpm --filter @bandstr/api typecheck`.

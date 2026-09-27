# Apple App Store Submission Package & Resolution Guide

Comprehensive guide and ready-to-copy Resolution Center response for the bandstr iOS app resubmission (Submission ID: `384ac34e-ab2a-4d6a-82f6-22f7b739c6ab`, Version 1.0).

---

## 1. Pre-Submission Operational Checklist

Complete these operational steps before submitting the new build in App Store Connect:

### 1.1 Seed Reviewer Demo Account in Production
Run the `seed-demo-account` CLI command on the production database. This creates an active, pre-verified Pro account with populated band data, calendar events, setlists, and song repertoire.

```bash
# Option A: Inside running Docker API container
docker compose exec api node /app/packages/api/dist/cli/admin.js seed-demo-account \
  --email "appcert@example.org" \
  --password "<chosen-password>" \
  --name "App Store Reviewer" \
  --band-name "The Bandstr Demo Band"

# Option B: Direct shell execution in deployed container
node /app/packages/api/dist/cli/admin.js seed-demo-account \
  --email "appcert@example.org" \
  --password "<chosen-password>"

# Option C: Locally with production DATABASE_URL
DATABASE_URL="<production-db-connection-string>" pnpm --filter @bandstr/api cli:admin:dev seed-demo-account \
  --email "appcert@example.org" \
  --password "<chosen-password>"
```

**Seeded Account State:**
| Entity | Seeded Value / State |
|---|---|
| User Email | `appcert@example.org` |
| Email Status | Verified (`emailVerified: true`) — bypasses email verification requirement |
| Plan | Pro (`devProPlan: true`, `subscriptionPlan: 'pro'`) |
| Demo Band | "The Bandstr Demo Band" (User role: `owner`, set as default band) |
| Sample Data | Populated song repertoire, Spotify links, gig setlists, rehearsal/gig calendar entries, and song votes |

---

### 1.2 Configure Production SMTP Environment Variables
Ensure the production environment contains valid SMTP credentials for transaction email delivery.

| Environment Variable | Description | Example / Recommended Value |
|---|---|---|
| `AUTH_EMAIL_SMTP_HOST` | Outbound SMTP server hostname | `smtp.mailgun.org` / `smtp.sendgrid.net` |
| `AUTH_EMAIL_SMTP_PORT` | SMTP port | `587` |
| `AUTH_EMAIL_SMTP_USER` | SMTP authentication username | `postmaster@mg.bandstr.com` |
| `AUTH_EMAIL_SMTP_PASSWORD` | SMTP password / API key | `<secure-smtp-key>` |
| `AUTH_EMAIL_SMTP_FROM_EMAIL` | Sender address shown to users | `support@4ki.app` / `noreply@bandstr.com` |
| `AUTH_EMAIL_SMTP_STARTTLS` | Force STARTTLS encryption | `true` |

**Verification Command:**
```bash
pnpm --filter @bandstr/api mail-test send --to "appcert@example.org" --kind verify-email
```

---

### 1.3 Configure Apple OAuth Credentials
If offering Sign in with Apple on the production backend, configure the Apple Services ID and private key JWT secret.

| Environment Variable | Description | Example Value |
|---|---|---|
| `APPLE_CLIENT_ID` | Apple Services ID identifier | `org.capacitor.bandstr.client` |
| `APPLE_CLIENT_SECRET` | Signed ES256 client secret JWT | `<generated-apple-secret-jwt>` |

---

### 1.4 Update App Store Connect App Information
Under **App Store Connect > App Information**:
- **Support URL:** `https://bandstr.apps.4ki.app/support`
- **Marketing URL (Optional):** `https://bandstr.apps.4ki.app/`
- **Privacy Policy URL:** `https://bandstr.apps.4ki.app/gdpr`

---

### 1.5 Update App Store Connect Review Information
Under **App Store Connect > Version > App Review Information**:
- **Sign-in required:** Checked `[X]`
- **User name:** `appcert@example.org`
- **Password:** `<chosen-password>` (matching password passed in Step 1.1)
- **Notes:**
  ```text
  Demo credentials:
  Username: appcert@example.org
  Password: <chosen-password>

  The account is pre-seeded with active data:
  - Band: "The Bandstr Demo Band" (Owner role)
  - Repertoire: Sample songs with musical keys, BPM, and Spotify links
  - Calendar: Upcoming rehearsal and concert events
  - Setlists: Gig setlist with ordered songs
  - Voting: Song proposal voting poll

  Support URL: https://bandstr.apps.4ki.app/support
  Support Contact: support@4ki.app
  ```

---

## 2. Resolution Center Response Copy

Copy and paste the text block below directly into the App Store Connect Resolution Center response form:

```markdown
Dear Apple App Review Team,

Thank you for your review and detailed feedback regarding bandstr (Submission ID: 384ac34e-ab2a-4d6a-82f6-22f7b739c6ab).

We have resolved all items identified across Guidelines 4.8, 4, 2.1, 2.1(a), 1.5, and 2.1(b). Below is a summary of the technical improvements implemented in this build, along with the answers to your business model questionnaire.

---

### 1. Guideline 4.8 - Design: Login Services (Sign in with Apple)

**Issue:** Third-party login options were offered without an equivalent privacy-preserving login service.
**Resolution:**
- We integrated **Sign in with Apple** across both iOS and Web platforms.
- The "Sign in with Apple" button is positioned alongside existing authentication methods on login and registration screens, adhering to Apple Human Interface Guidelines (styling, layout, Apple branding).
- It supports Apple's private email relay, collects only essential name and email details, and does not track user activity across apps for advertising.
- The backend Better Auth service validates Apple identity tokens and public keys securely.

---

### 2. Guideline 4 - Design: In-App Safari View Controller & Account Deletion

**Issue 1 (In-App Browser):** External Safari opened during social login flows.
**Resolution:**
- We integrated `@capacitor/browser` utilizing native `SFSafariViewController` on iOS.
- All OAuth sign-in flows (Apple, Google, GitHub) now open directly inside the app in an embedded Safari sheet with standard URL inspection and SSL indicators.
- Upon completion, the custom scheme deep link (`org.capacitor.bandstr://`) returns authentication tokens and automatically dismisses the in-app browser sheet, returning users seamlessly to their dashboard.

**Issue 2 (Account Deletion Discoverability):** Account deletion mechanism must be easily discoverable.
**Resolution:**
- Account deletion is now accessible through two immediate navigation paths:
  1. **User Account Menu:** An explicit "Account Security & Deletion" option (`delete_forever` icon) is present in the main user profile dropdown menu.
  2. **Dashboard Profile Section:** A direct navigation link is available directly on the user profile summary card.
- Navigating to `/delete-account` provides clear confirmation dialogue, revokes all active sessions, and permanently removes the user's personal data and account records from the database in compliance with Guideline 5.1.1(v).

---

### 3. Guideline 2.1 - Information Needed: Reviewer Demo Account

**Issue:** Provided demo credentials (`appcert@example.org`) failed to authenticate.
**Resolution:**
- We created an automated database seeding tool (`seed-demo-account`) that provisions a fully verified reviewer account with populated sample content.
- The demo credentials have been seeded in production and verified:
  - **Username:** `appcert@example.org`
  - **Password:** [INSERT_DEMO_PASSWORD_HERE]
- The demo account is pre-populated with active band data:
  - **Band:** "The Bandstr Demo Band" (Owner permissions)
  - **Song Repertoire:** Sample songs with keys, tempo, and Spotify links
  - **Setlists:** Configured live performance setlists
  - **Calendar:** Upcoming rehearsal and gig dates with attendance tracking
  - **Voting:** Active song proposal poll with votes
- The account has email verification pre-flagged as completed, allowing immediate access without email activation.

---

### 4. Guideline 2.1(a) - Performance: App Completeness (Email Verification Delivery)

**Issue:** Account registration did not deliver a verification email to the reviewer.
**Resolution:**
- **SMTP Delivery Infrastructure:** We updated and verified our production outbound email service with validated SPF, DKIM, and TLS configuration to guarantee inbox delivery for verification emails.
- **In-App Resend Verification:** The registration screen now features an interactive **"Resend verification email"** button alongside clear user messaging. If an email is delayed or caught in network spam filters, users can immediately request a new token directly from the screen without restarting registration.
- **Review Access:** Reviewers can authenticate directly using the pre-verified demo credentials (`appcert@example.org`), which bypass email confirmation entirely.

---

### 5. Guideline 1.5 - Safety: Public Support URL

**Issue:** Support URL (`https://4ki.app/`) did not direct to a functional support page.
**Resolution:**
- We deployed a dedicated, publicly accessible support portal:
  **Support URL:** `https://bandstr.apps.4ki.app/support`
- The support page does not require login and provides:
  - Direct support email contact: `support@4ki.app`
  - Functional support ticket submission form connected to our ticket system
  - Comprehensive FAQ covering account access, band invitations, setlists, and subscriptions
  - Direct navigation links to Legal Notice (`/impress`) and Privacy Policy (`/gdpr`)
- The Support URL has been updated in App Store Connect metadata to `https://bandstr.apps.4ki.app/support`.

---

### 6. Guideline 2.1(b) - Information Needed: Business Model & In-App Purchase Compliance

Below are the responses to Apple's four business model and digital purchase questions:

#### 1. Who are the users that will use the paid features in the app?
Musicians, band members, and band managers using bandstr to coordinate rehearsal schedules, manage song repertoires, vote on new material, and organize gig setlists.

#### 2. Where can users purchase the features that can be accessed in the app?
Users can purchase the "bandstr pro" subscription directly within the iOS app using Apple In-App Purchase (StoreKit auto-renewable subscriptions). Subscriptions are also available on Android via Google Play and on the web via Stripe.

#### 3. What specific types of previously purchased features can a user access in the app?
A user with an active "bandstr pro" subscription accesses unlimited setlist size, unlimited band member limits, personal and shared song notes, and data export/import. Under bandstr's cooperative band model ("bandstr plus"), when any member of a band holds a Pro subscription, all members of that band inherit Pro feature access within that band.

#### 4. What paid content, subscriptions, or features are unlocked within the app that do not use In-App Purchase?
None that circumvent In-App Purchase. 

In accordance with **Guideline 3.1.3(b) (Multiplatform Services)**, users who previously subscribed on other platforms (such as the web or Google Play) may access their subscription benefits in the iOS app upon logging into their account. All subscription tiers available across other platforms are also offered directly inside the iOS app via Apple In-App Purchase at equivalent terms. The iOS app contains no external purchasing links or calls to action to purchase outside of Apple In-App Purchase.

---

We appreciate your assistance in reviewing bandstr. Please let us know if any additional information or testing accounts are required.

Sincerely,  
The bandstr Development Team  
support@4ki.app
```

---

## 3. Automated Test Verification Summary

All fixes implemented for this submission have corresponding automated tests across the monorepo:

| Guideline | Component / Feature | Test File |
|---|---|---|
| **1.5** | Public `/support` route & anonymous ticket submission | `packages/web/test/routes.test.ts`<br>`packages/api/tests/routes/support.test.ts` |
| **4** | Account Deletion link in user menu & dashboard | `packages/web/test/navigation.test.ts` |
| **4** | In-App `SFSafariViewController` via `@capacitor/browser` | `packages/web/test/login-browser.test.ts` |
| **4.8** | Sign in with Apple backend provider & UI button | `packages/api/tests/routes/auth-apple.test.ts`<br>`packages/web/test/login-apple.test.ts` |
| **2.1** | Reviewer demo account seeding CLI & authentication | `packages/api/tests/cli/seed-demo-account.test.ts` |
| **2.1(a)** | Resend verification email button & status messaging | `packages/web/test/signup-verification.test.ts` |

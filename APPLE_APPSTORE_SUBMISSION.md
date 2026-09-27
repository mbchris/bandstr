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

**Verification Commands:**
```bash
# Option A: Inside running Docker API container
docker compose exec api node /app/packages/api/dist/cli/mail-test.js send \
  --to "appcert@example.org" \
  --kind verify-email

# Option B: Direct shell execution in deployed container
node /app/packages/api/dist/cli/mail-test.js send \
  --to "appcert@example.org" \
  --kind verify-email

# Option C: Locally via pnpm
pnpm --filter @bandstr/api mail-test send \
  --to "appcert@example.org" \
  --kind verify-email
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

Thank you for your feedback regarding bandstr (Submission ID: 384ac34e-ab2a-4d6a-82f6-22f7b739c6ab). We have resolved all items across Guidelines 4.8, 4, 2.1, 2.1(a), 1.5, and 2.1(b).

### 1. Guideline 4.8 - Design: Login Services (Sign in with Apple)
- Integrated **Sign in with Apple** on iOS and Web alongside existing login options, strictly following Apple Human Interface Guidelines.
- Supports Apple private email relay, collects only name and email, and does not track users for advertising.

### 2. Guideline 4 - Design: In-App Browser & Account Deletion
- **In-App Browser:** Replaced external browser redirects with `@capacitor/browser` (`SFSafariViewController`). All social logins (Apple, Google, GitHub) open in an embedded sheet and dismiss automatically upon authentication.
- **Account Deletion (Guideline 5.1.1(v)):** Made immediately discoverable via:
  1. User Menu: "Account Security & Deletion" in the top-right account dropdown.
  2. Dashboard: Direct link on the user profile summary card.
  Both navigate to `/delete-account`, which confirms deletion, revokes active tokens, and permanently deletes user data.

### 3. Guideline 2.1 - Information Needed: Reviewer Demo Account
The demo account is seeded in production with verified status and full feature access:
- **Username:** `appcert@example.org`
- **Password:** [INSERT_DEMO_PASSWORD_HERE]
- **Pre-populated Data:** Assigned as Owner of "The Bandstr Demo Band" with sample songs, setlists, rehearsal/gig calendar events, and voting polls. Email verification is pre-completed for instant sign-in.

### 4. Guideline 2.1(a) - Performance: App Completeness (Email Verification)
- Verified outbound SMTP production delivery with valid SPF/DKIM/TLS.
- Added an interactive **"Resend verification email"** button on the sign-in/sign-up screen if an email is delayed.
- Reviewers can sign in immediately with the pre-verified demo credentials above.

### 5. Guideline 1.5 - Safety: Support URL
- Updated App Store Connect Support URL to our dedicated public portal:
  **Support URL:** `https://bandstr.apps.4ki.app/support`
- Publicly accessible without login, providing direct contact (`support@4ki.app`), FAQ, ticket submission, and links to Privacy Policy (`/gdpr`) and Legal Notice (`/impress`).

### 6. Guideline 2.1(b) - Business Model & In-App Purchase Compliance
1. **Users:** Musicians, band members, and managers coordinating rehearsals, setlists, and song repertoires.
2. **Purchase Location:** "bandstr pro" subscriptions can be purchased directly in the iOS app via Apple In-App Purchase (StoreKit auto-renewable subscriptions), on Android via Google Play, and on web via Stripe.
3. **Purchased Features:** "bandstr pro" unlocks unlimited setlists, unlimited members, personal/shared notes, and data export. Under our cooperative model ("bandstr plus"), all band members inherit Pro features when any member holds a Pro subscription.
4. **Unlocked Features Outside IAP:** None that bypass IAP. In accordance with **Guideline 3.1.3(b) (Multiplatform Services)**, users who subscribed on web or Android can access their subscription on iOS by logging into their account. All subscription tiers are offered inside the iOS app via Apple In-App Purchase at equivalent terms, with no external purchase links.

Please let us know if you need any additional information.

Sincerely,  
The bandstr Team  
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

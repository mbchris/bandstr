# CI/CD Pipeline & Multi-Platform Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an end-to-end GitHub Actions CI/CD pipeline covering Backend, WebUI, Android (Play Store Testing Track), and iOS (TestFlight), and extend the push notification subsystem to support WebApp alongside iOS and Android.

**Architecture:**
- Modular GitHub Actions workflows: a unified validation matrix (`ci.yml`) for PRs and branch pushes (Backend, WebUI, Android tests, iOS build verification) plus separate deployment workflows (`deploy-backend.yml`, `deploy-android.yml`, `deploy-ios.yml`).
- Capacitor v7 hybrid mobile compilation: Android on `ubuntu-latest` with JDK 21 and Android SDK tools; iOS on `macos-14` runner with Xcode and ephemeral signing keychain.
- Push notification architecture: Unified client registration interface supporting APNs (iOS native), FCM (Android native), and Web Push (VAPID / Service Worker) handled by Hono API with asynchronous dispatch.

**Tech Stack:** GitHub Actions, Hono API, Vue 3 / Quasar, Capacitor v7, Vitest, Gradle, Xcodebuild, iTMSTransporter, Googleapis AndroidPublisher v3, Web-Push (VAPID).

---

## 1. Current State Assessment

### 1.1 Existing Assets
- **Workflows:**
  - `.github/workflows/build-and-release-gate.yml`: Builds production Docker image and Android APK on push, with a release issue decision gate.
  - `.github/workflows/deploy-prod.yml`: Triggers Coolify deployment via webhook (`scripts/deploy_main_to_prod.sh`).
- **Scripts:**
  - `./do`: CLI supporting `build-apk`, `create-apk-bundle`, `deploy-play-console`, `build-ios`, `deploy-ios`, `upload-ios`, `push-setup`.
  - `scripts/deploy-play-console.mjs`: Uses Google Play Developer API (androidpublisher v3) to upload `.aab` to internal test track.
  - `scripts/build-ios.sh`: Builds Quasar iOS Capacitor assets, creates xcarchive, and exports IPA using `xcodebuild`.
  - `scripts/upload-ios-appstore.sh`: Uploads IPA to App Store Connect using `xcrun iTMSTransporter`.
  - `scripts/gh-secrets-upload.sh`: Syncs local `.env` keys to GitHub Actions secrets and variables.
- **Backend:**
  - TypeScript build (`tsc && cp -r src/db/migrations dist/db/`) and 27 passing Vitest tests.
  - Push delivery implemented for FCM (Android) and APNs (iOS) in `packages/api/src/lib/push-delivery.ts`.
- **WebUI:**
  - Quasar build (`quasar build`), TypeScript checking (`vue-tsc --noEmit`), and ESLint (`eslint .`).
  - No Vitest runner configured yet for unit testing.
- **Push Notifications:**
  - Android & iOS: Fully implemented via `@capacitor/push-notifications` -> registered via `/api/notifications/devices/register` -> dispatched via FCM v1 and APNs HTTP/2.
  - WebApp: Push is currently bypassed (`if (!Capacitor.isNativePlatform()) return`) and backend schema restricts platforms to `android` and `ios`.

---

## 2. Environment Variables & Prerequisites Audit

### 2.1 Variables & Secrets Audit Matrix

| Variable / Secret | Category | Secret/Var | Local `.env` | GitHub Actions | Purpose |
|---|---|---|---|---|---|
| `DATABASE_URL` | Backend | Secret | **SET** | **SET** | PostgreSQL connection string |
| `AUTH_SECRET` | Backend | Secret | **SET** | **SET** | Better Auth session encryption key |
| `INTERNAL_ADMIN_TOKEN` | Backend | Secret | **SET** | **SET** | Internal admin API route authorization |
| `COOLIFY_AUTH_TOKEN` | Backend Deploy | Secret | **SET** | **SET** | Coolify deployment webhook authentication |
| `COOLIFY_DEPLOY_URL` | Backend Deploy | Variable | **SET** | **SET** | Coolify deployment webhook URL |
| `APP_DOMAIN` | Web / API | Variable | **SET** | **SET** | Public domain (`bandstr.apps.4ki.app`) |
| `API_URL` | Web / API | Variable | **SET** | **SET** | Backend API base URL |
| `AUTH_ORIGIN` | Web / Auth | Variable | **SET** | **SET** | Allowed authentication origin |
| `CORS_ORIGINS` | Backend | Variable | **SET** | **SET** | Cross-origin resource sharing whitelist |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Auth | Var / Secret | **SET** | **SET** | Google OAuth authentication |
| `GHUB_CLIENT_ID` / `_SECRET` | Auth | Var / Secret | **SET** | **SET** | GitHub OAuth authentication |
| `ANDROID_SIGNING_KEYSTORE_BASE64` | Android | Secret | **SET** | **SET** | Base64 release keystore (`***REMOVED***.keystore`) |
| `ANDROID_SIGNING_KEY_ALIAS` | Android | Secret | **SET** | **SET** | Keystore key alias |
| `ANDROID_SIGNING_KEYSTORE_PASSWORD`| Android | Secret | **SET** | **SET** | Keystore password |
| `ANDROID_SIGNING_KEY_PASSWORD` | Android | Secret | **SET** | **SET** | Key alias password |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64` | Android / Play / FCM | Secret | **SET** | **MISSING** | Service account JSON with Play Publisher + FCM permissions |
| `GPLAY_PACKAGE_NAME` | Android Play | Variable | **SET** | **MISSING** | App package ID (`org.capacitor.bandstr`) |
| `APPSTORE_CONNECT_API_KEY_ID` | iOS Deploy | Secret | **MISSING** | **MISSING** | App Store Connect API Key ID (e.g. `2X9R4ABCD3`) |
| `APPSTORE_CONNECT_ISSUER_ID` | iOS Deploy | Secret | **MISSING** | **MISSING** | App Store Connect Issuer UUID |
| `APPSTORE_CONNECT_API_KEY_BASE64` | iOS Deploy | Secret | **MISSING** | **MISSING** | App Store Connect `.p8` private key file (Base64) |
| `APPLE_DISTRIBUTION_CERT_BASE64` | iOS Build | Secret | **MISSING** | **MISSING** | Apple Distribution Certificate `.p12` (Base64) |
| `APPLE_DISTRIBUTION_CERT_PASSWORD` | iOS Build | Secret | **MISSING** | **MISSING** | Password for the exported `.p12` certificate |
| `APPLE_PROVISIONING_PROFILE_BASE64` | iOS Build | Secret | **MISSING** | **MISSING** | App Store Provisioning Profile `.mobileprovision` (Base64) |
| `APPLE_TEAM_ID` | iOS Build | Variable | **MISSING** | **MISSING** | 10-character Apple Developer Team ID |
| `APNS_KEY_ID` | Push (iOS) | Secret | **MISSING** | **MISSING** | Apple APNs auth key ID |
| `APNS_TEAM_ID` | Push (iOS) | Secret | **MISSING** | **MISSING** | Apple Developer Team ID for APNs |
| `APNS_PRIVATE_KEY` | Push (iOS) | Secret | **MISSING** | **MISSING** | Apple APNs `.p8` private key content |
| `APNS_BUNDLE_ID` | Push (iOS) | Variable | **SET** | **MISSING** | iOS Bundle ID (`org.capacitor.bandstr`) |
| `VAPID_PUBLIC_KEY` | Push (Web) | Variable | **MISSING** | **MISSING** | VAPID public key for Web Push client subscription |
| `VAPID_PRIVATE_KEY` | Push (Web) | Secret | **MISSING** | **MISSING** | VAPID private key for Web Push backend signing |
| `VAPID_SUBJECT` | Push (Web) | Variable | **MISSING** | **MISSING** | `mailto:admin@bandstr.com` or app URL |

---

### 2.2 Google Play Store Prerequisites
1. **Google Play Developer Account:** Active developer account registered at play.google.com/console ($25 one-time fee).
2. **App Created in Play Console:** App with package ID matching `capacitor.config.json` (`org.capacitor.bandstr`).
3. **Manual First Upload:** Google Play Console API enforces that the **first release artifact (.aab)** must be uploaded manually through the Play Console web UI before automated API uploads will be accepted.
4. **Google Cloud Service Account:**
   - In Google Cloud Console, enable "Google Play Android Developer API".
   - Create a Service Account and download the JSON key.
   - In Google Play Console under **API Access**, link the service account and grant permissions: **Releases: Create, edit, and roll back releases**, **Manage testing tracks**, and **View app information**.

---

### 2.3 Apple App Store & TestFlight Prerequisites
1. **Apple Developer Program Membership:** Active organization or individual Apple Developer membership ($99/year).
2. **App Record in App Store Connect:** App created with bundle identifier matching `org.capacitor.bandstr` (SKU and Name configured).
3. **App Store Connect API Key:**
   - In App Store Connect -> Users and Access -> Integrations -> App Store Connect API.
   - Generate a Key with role **App Manager** or **Admin**.
   - Download the `.p8` file (note Key ID and Issuer ID).
4. **Signing Credentials for CI:**
   - **Distribution Certificate (`.p12`):** Generated in Apple Developer portal, exported from macOS Keychain with a passphrase.
   - **App Store Provisioning Profile (`.mobileprovision`):** Tied to the App ID and Distribution Certificate.
   - Both encoded in Base64 for GitHub Actions secrets.

---

## 3. Workflows Architecture Plan

```
.github/workflows/
├── ci.yml                 # Runs on Pull Request and Push to main/dev
│   ├── backend-lint-test  # Typecheck, lint, vitest
│   ├── web-lint-test      # Typecheck, lint, vitest (web)
│   ├── android-test       # Gradle unit tests (JDK 21)
│   └── ios-verify         # macOS runner: build check (CODE_SIGNING_ALLOWED=NO)
├── deploy-backend.yml     # Runs on push to main (or manual dispatch)
│   └── coolify-deploy     # Triggers Coolify webhook deploy
├── deploy-android.yml     # Runs on manual dispatch or version tag
│   └── play-store-testing # Builds signed AAB, uploads to Google Play internal track
└── deploy-ios.yml         # Runs on manual dispatch or version tag
    └── testflight-deploy  # Sets up temporary keychain, builds IPA, uploads via iTMSTransporter
```

---

## 4. WebApp Push Notification Architecture

1. **Client Service Worker:** Add `service-worker.js` / Web Push handler in `packages/web/public/sw.js` capable of receiving push events and opening routes on click.
2. **Web Push Boot Handler:** Extend `packages/web/src/boot/push.ts` to detect `!Capacitor.isNativePlatform()` and initialize `navigator.serviceWorker` with standard `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })`.
3. **Backend Route & Schema Update:**
   - Update `packages/api/src/routes/notifications.ts` schema: allow `platform: 'web'` and `tokenType: 'web_push'`.
   - Update `packages/api/src/lib/push-delivery.ts` to include Web Push delivery using VAPID credentials via standard HTTP request or `web-push`.

---

## 5. Implementation Tasks

### Task 1: WebUI Unit Testing Setup
- Add Vitest + `@vue/test-utils` + `happy-dom` to `packages/web`.
- Add test script `pnpm --filter @bandstr/web run test` and write initial component/store tests.
- Ensure `pnpm test` or root test command covers both API and Web.

### Task 2: WebApp Push Notification Support
- Generate VAPID key pairs and document configuration.
- Implement `public/sw.js` push listener and notification click handler.
- Update `packages/web/src/boot/push.ts` to register Web Push subscriptions with backend.
- Update `packages/api/src/routes/notifications.ts` to accept `platform: 'web'`, `tokenType: 'web_push'`.
- Update `packages/api/src/lib/push-delivery.ts` to deliver notifications to Web Push endpoints.

### Task 3: Unified CI Workflow (`ci.yml`)
- Create `.github/workflows/ci.yml`.
- Job 1: `backend-ci` (setup-node, pnpm install, typecheck, vitest).
- Job 2: `web-ci` (setup-node, pnpm install, typecheck, eslint, vitest).
- Job 3: `android-test` (setup-java temurin 21, setup-android, `./gradlew testDebugUnitTest`).
- Job 4: `ios-build-check` (macos-14 runner, setup-node, build web assets, `xcodebuild build CODE_SIGNING_ALLOWED=NO`).

### Task 4: Automated Backend Deployment Workflow (`deploy-backend.yml`)
- Create `.github/workflows/deploy-backend.yml`.
- Trigger on `workflow_dispatch` and `push` to `main` (paths: `packages/api/**`, `packages/shared/**`, `Dockerfile`, `docker-compose*`).
- Triggers Coolify deployment webhook with timeout and response validation.

### Task 5: Android Google Play Store Deployment Workflow (`deploy-android.yml`)
- Create `.github/workflows/deploy-android.yml`.
- Trigger on `workflow_dispatch` (with input for track: `internal`, `alpha`, `beta`) or release tag.
- Setup JDK 21 and Android SDK.
- Decode keystore and build signed `.aab` using `./do create-apk-bundle production`.
- Run `node scripts/deploy-play-console.mjs` using `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`.

### Task 6: iOS TestFlight Deployment Workflow (`deploy-ios.yml`)
- Create `.github/workflows/deploy-ios.yml` running on `macos-14`.
- Trigger on `workflow_dispatch` or release tag.
- Create temporary macOS keychain, import Apple Distribution certificate, and install provisioning profile.
- Build and archive app via `scripts/build-ios.sh production`.
- Upload IPA to App Store Connect / TestFlight via `scripts/upload-ios-appstore.sh`.

### Task 7: GitHub Secrets & Environment Synchronization
- Update `scripts/gh-secrets-upload.sh` to include newly required keys (`GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`, `APPSTORE_CONNECT_*`, `APPLE_*`, `VAPID_*`).
- Update `.env.api.template` and `.env.web.template`.
- Verify secrets configuration against repository.

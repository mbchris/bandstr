# Capacitor Step 6 (Mobile)

This project now has initial Capacitor scaffold in `packages/web/src-capacitor`.
Quasar also requires `packages/web/index.html` as entry template.

## Run setup (PowerShell, copy/paste)

```powershell
Set-Location D:\dev\bandstr
powershell -ExecutionPolicy Bypass -File .\scripts\setup-capacitor.ps1
```

## Prerequisites

- Android build: JDK 21+ (`java -version`)
- Android SDK/Studio installed
- iOS build: macOS + Xcode (script auto-skips iOS on Windows/Linux)

Optional custom app id/name:

```powershell
Set-Location D:\dev\bandstr
powershell -ExecutionPolicy Bypass -File .\scripts\setup-capacitor.ps1 -AppId "com.example.bandstr" -AppName "bandstr" -SkipIos
```

## Manual commands (if script is interrupted)

```powershell
Set-Location D:\dev\bandstr
"org.capacitor.bandstr`nbandstr`n" | pnpm --filter @bandstr/web exec quasar mode add capacitor
pnpm --filter @bandstr/web run build:android
# macOS only:
pnpm --filter @bandstr/web run build:ios
```

## Deep-link placeholders

Current app id is configured in:
- `packages/web/src-capacitor/capacitor.config.json`

## Native Push Notifications

True OS push now uses Capacitor Push Notifications + backend token registration.

Quick command:

```bash
./do push-setup local
```

This validates env vars, explains where to get missing values, can materialize `google-services.json`, and runs `cap sync`.

### Android

1. Add Firebase `google-services.json` to:
   - `packages/web/src-capacitor/android/app/google-services.json`
   - Source: Firebase Console -> Project settings -> General -> Your apps -> Android app -> Download config file
2. Sync Android plugins:

```bash
pnpm --dir packages/web/src-capacitor exec npx cap sync android
```

### iOS

1. Enable **Push Notifications** capability in Xcode.
2. Add `aps-environment` entitlement on the app target (`development` or `production`).
3. APNs key source:
   - Apple Developer -> Certificates, Identifiers & Profiles -> Keys -> create APNs key
   - Use resulting key values for `APNS_KEY_ID` and `APNS_PRIVATE_KEY` + your team `APNS_TEAM_ID`
4. Sync iOS plugins (CocoaPods required):

```bash
pnpm --dir packages/web/src-capacitor exec npx cap sync ios
```

### API Environment

Configure in `.env.api`:
- `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` (or email/private key pair)
- alternatively accepted for FCM auth: `GOOGLE_APPLICATION_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`
- `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_USE_SANDBOX`
- Optional helper inputs for `./do push-setup`:
  - `GOOGLE_SERVICES_JSON_PATH`
  - `GOOGLE_SERVICES_JSON_BASE64`

For production deep links/universal links, complete native platform configs after Android/iOS projects are generated:
- Android intent filters (`AndroidManifest.xml`)
- iOS Associated Domains entitlements (`*.entitlements`)

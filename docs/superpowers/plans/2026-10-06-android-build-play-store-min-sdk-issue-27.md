# Android AGP compileSdk 36 & Play Console minSdk 24 Implementation Plan (Issue #27)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Android build warning regarding compileSdk 36 compatibility with AGP 8.7.2 and fix Play Console release rejection caused by minSdk 23.

**Architecture:** 
1. Upgrade Android Gradle Plugin from `8.7.2` to `8.9.2` in `packages/web/src-capacitor/android/build.gradle` (official compileSdk 36 support on Gradle 8.11.1) and set `android.suppressUnsupportedCompileSdk=36` in `gradle.properties` as fallback protection.
2. Bump `minSdkVersion` from `23` to `24` in `packages/web/src-capacitor/android/variables.gradle` to comply with Google Play automatic protection requirements.
3. Update backlog item `TASK-9009` in `docs/backlog/bugfixing.md` and verify clean builds of both debug APK and release AAB.

**Tech Stack:** Android Gradle Plugin (AGP 8.9.2), Gradle 8.11.1, Capacitor 7, Google Play Console Publishing API.

**Spec:** [GitHub Issue #27](https://github.com/prj120/bandstr/issues/27) — "[Support][Bug] Error during build, should be addressed: prj120/bandstr#27"

## Global Constraints

- Android build tooling targets `compileSdk = 36` and `targetSdk = 36`.
- Gradle distribution is `gradle-8.11.1-all.zip`.
- Java version for Android builds is Java 21 LTS (`min_java_major=21`, `max_java_major=23` in `./do`).
- Google Play requirement: `minSdkVersion >= 24` for automatic protection.

## Review Focus

1. **Gradle and AGP compatibility** — Ensure AGP 8.9.2 works seamlessly with Gradle 8.11.1 wrapper without plugin breakage.
2. **Capacitor Android plugins compatibility** — Confirm all Capacitor Cordova & Capacitor core plugins (`@capacitor/android`, `@capacitor/filesystem`, etc.) build cleanly under AGP 8.9.2.
3. **App Bundle Manifest verification** — Ensure `android:minSdkVersion="24"` is baked into the generated `.aab` bundle manifest, not just the debug APK.
4. **Build script behavior** — Ensure `./do create-apk-bundle` and `./do build-apk` execute without sdk warnings or Java mismatch.
5. **No regressions on existing web/api code** — Android configuration changes must remain localized under `packages/web/src-capacitor/android/`.

---

### Task 1: Update AGP to 8.9.2 and Set Suppress Property in Gradle Configuration

**Files:**
- Modify: `packages/web/src-capacitor/android/build.gradle:10`
- Modify: `packages/web/src-capacitor/android/gradle.properties:23`

**Interfaces:**
- Consumes: `compileSdkVersion = 36` in `variables.gradle`
- Produces: AGP 8.9.2 dependency resolution; zero compileSdk 36 warnings during build.

- [ ] **Step 1: Check existing build warning on AGP 8.7.2**

Run: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" packages/web/src-capacitor/android/gradlew help -p packages/web/src-capacitor/android`
Expected: Output shows "WARNING: We recommend using a newer Android Gradle plugin to use compileSdk = 36".

- [ ] **Step 2: Update AGP classpath in `packages/web/src-capacitor/android/build.gradle`**

Change line 10:
```groovy
classpath 'com.android.tools.build:gradle:8.9.2'
```

- [ ] **Step 3: Add compileSdk warning suppression property in `packages/web/src-capacitor/android/gradle.properties`**

Append to `packages/web/src-capacitor/android/gradle.properties`:
```properties
android.suppressUnsupportedCompileSdk=36
```

- [ ] **Step 4: Verify build succeeds without compileSdk warning**

Run: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" packages/web/src-capacitor/android/gradlew assembleDebug -p packages/web/src-capacitor/android`
Expected: BUILD SUCCESSFUL with 0 compileSdk warnings.

- [ ] **Step 5: Commit changes**

```bash
git add packages/web/src-capacitor/android/build.gradle packages/web/src-capacitor/android/gradle.properties
git commit -m "build(android): upgrade AGP to 8.9.2 and suppress unsupported compileSdk warning"
```

---

### Task 2: Bump minSdkVersion to 24 for Google Play Store Automatic Protection

**Files:**
- Modify: `packages/web/src-capacitor/android/variables.gradle:2`

**Interfaces:**
- Consumes: `rootProject.ext.minSdkVersion` in `packages/web/src-capacitor/android/app/build.gradle`
- Produces: `minSdkVersion = 24` across all Android build variants.

- [ ] **Step 1: Verify current minSdkVersion in bundle manifest**

Check `packages/web/src-capacitor/android/app/build/intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml`
Confirm current value is `23`.

- [ ] **Step 2: Update minSdkVersion to 24 in `packages/web/src-capacitor/android/variables.gradle`**

Change line 2:
```groovy
minSdkVersion = 24
```

- [ ] **Step 3: Build release bundle and verify minSdkVersion in merged bundle manifest**

Run: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" packages/web/src-capacitor/android/gradlew bundleRelease -p packages/web/src-capacitor/android`
Expected: BUILD SUCCESSFUL.
Run: `grep -i "minSdkVersion" packages/web/src-capacitor/android/app/build/intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml`
Expected: `android:minSdkVersion="24"`.

- [ ] **Step 4: Commit changes**

```bash
git add packages/web/src-capacitor/android/variables.gradle
git commit -m "build(android): bump minSdkVersion to 24 for Google Play compliance"
```

---

### Task 3: Backlog Documentation & Full End-to-End Build Verification

**Files:**
- Modify: `docs/backlog/bugfixing.md`

- [ ] **Step 1: Add TASK-9009 to `docs/backlog/bugfixing.md`**

Append:
```markdown
## TASK-9009: Android compileSdk 36 warning and Play Console minSdk 24 rejection
- **Status:** done
- **Labels:** bug, android
- **Acceptance Criteria:**
  - [x] Android Gradle Plugin updated to 8.9.2 with official compileSdk 36 support.
  - [x] compileSdk warning suppressed/resolved in gradle.properties and root build.gradle.
  - [x] minSdkVersion bumped to 24 in variables.gradle to satisfy Google Play automatic protection.
  - [x] Release App Bundle (.aab) builds cleanly with minSdk 24.
```

- [ ] **Step 2: Verify ./do bundle build pipeline**

Run: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./do create-apk-bundle local`
Expected: Release bundle generated at `packages/web/src-capacitor/android/app/build/outputs/bundle/release/app-release.aab`.

- [ ] **Step 3: Commit backlog update**

```bash
git add docs/backlog/bugfixing.md
git commit -m "docs: add TASK-9009 for issue #27 in bugfixing backlog"
```

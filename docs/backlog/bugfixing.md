# Bug Fixing

<!-- iteration: Bug Fixing -->

## TASK-9000: Logo not shown
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
  - [x] the logo is not shown in the header
  **File hints:** `assets/bandstr_rect_wh.png`

## TASK-9001: DEVMODE not working
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
  - [x] DEVMODE is set to true, but login is still required. Only If DEVMODE is set to false, login is required. 
  - [x] DEVMODE=true: consider user being chris@example.org

  ## TASK-9002: cannot login
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
    - [x] Login with 'schneider.chris@gmx.de' not possible using github, even it is whitelisted. add debug to the output which mail addresses is reported and try to fix.
    - [x] write the user information to stdout when trying to login
  
  ## TASK-9003: Preview shows HTTP 404
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
    - [x] Song in voting list shows 'http 404' in the preview, although spotify link is added.
    
  **File hints:** ``

 ## TASK-9003: Voting reaction
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
    - [x] Clicking on votes sometimes selects the wrong line and changes the wrong voting
    
  **File hints:** ``
  ## TASK-9004: Invalid Redirect URL in OIDC
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
    - [x] OIDC login (GitHub/Google) uses an invalid redirect URL missing the `/bandstr` subpath.
    - [x] Add detailed access logs to debug auth process.
  **File hints:** `nuxt.config.ts`, `server/api/auth/[...].ts`

## Task-xxxx: Gig setlist cannot be sorted
- **Labels:** bug
- **Acceptance Criteria:**
    - [ ] Sorting Songs in the Gig Setlist is not possible. An error message is shown instead
    

## Task-xxxx: Position of error and information messages
- **Labels:** bug
- **Acceptance Criteria:**
    - [ ] Error and information overlays are shown at the bottom of the app. This conflicts with the button bar position. They shall be shown in the upper 1/3 of the screen instead.
    - [ ] Error and information overlays shall be shown in a slightly transparent box with rounded corners 


## Feature-xxxx: Position of error and information messages
- **Labels:** feature
- **Acceptance Criteria:**
    - [ ] Error and information overlays are shown at the bottom of the app. This conflicts with the button bar position. They shall be shown in the upper 1/3 of the screen instead.
    - [ ] Error and information overlays shall be shown in a slightly transparent box with rounded corners 

## TASK-9005: New gig creation from Home page upcoming gigs section fails to add
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
  - [x] Adding a new gig from the home page popup and saving works, even if there are already 3+ upcoming gigs.
  - [x] Editing existing gigs in the popup doesn't fail due to null descriptions.

## TASK-9006: Login page is not scrollable on Android and iOS
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
  - [x] Login page can be scrolled vertically on mobile devices (Android and iOS).
  - [x] Card is vertically centered on larger screens and scrolls gracefully when content overflows.
  - [x] Background video and dark overlay remain fixed without clipping page content.
  - [x] Mobile safe-area insets are respected for top and bottom footer.

## TASK-9007: App crashes on startup on iOS 27
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
  - [x] Migrate from legacy UIApplicationDelegate lifecycle to UIScene-based lifecycle (mandatory in iOS 27).
  - [x] Add `SceneDelegate.swift` with window setup and Capacitor URL/Universal Link forwarding.
  - [x] Add `UIApplicationSceneManifest` to `Info.plist` with scene configuration.
  - [x] Update `AppDelegate.swift` with `configurationForConnecting` and remove legacy lifecycle methods.
  - [x] Register `SceneDelegate.swift` in Xcode project (`project.pbxproj`).

## TASK-9008: Further Usability Findings
- **Status:** done
- **Labels:** bug
- **Acceptance Criteria:**
  - [x] "Gig Setlist" dropdown is an autocomplete textfield, reduced in size by 30%, with selection centered vertically.
  - [x] Removed "+ new Gig Setlist" button and added "New Gig Setlist..." option just below the "Master Setlist" entry in the dropdown.
  - [x] Calendar "Rehearsal" description field is 4 lines instead of a 1-line field.

## TASK-9009: Android compileSdk 36 warning and Play Console minSdk 24 rejection (#27)
- **Status:** done
- **Labels:** bug, android
- **Acceptance Criteria:**
  - [x] Android Gradle Plugin updated to 8.9.2 with official compileSdk 36 support.
  - [x] compileSdk warning suppressed/resolved in gradle.properties and root build.gradle.
  - [x] minSdkVersion bumped to 24 in variables.gradle to satisfy Google Play automatic protection.
  - [x] Release App Bundle (.aab) builds cleanly with minSdk 24.


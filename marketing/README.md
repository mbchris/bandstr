# bandstr App Store artwork

## Upload-ready files

- `screenshots/ipad-13/`: portrait PNGs at 2064 × 2752 (13-inch iPad slot)
- `screenshots/iphone-6.9/`: portrait PNGs at 1320 × 2868
- `screenshots/iphone-6.5/`: portrait PNGs at 1284 × 2778 — **this is the set App
  Store Connect's iPhone slot accepts** (it takes 1242 × 2688 or 1284 × 2778;
  1320 × 2868 is rejected as wrong dimensions)
- `screenshots/en/…`: the same panels with English headlines
- `raw/`: unedited simulator captures

All displayed band names, members, e-mail addresses, songs and gigs are
fictional and come from `scripts/seed_demo.sql`. They are not bundled with the
shipping app and no real user data appears.

## Rebuilding

Stage 2 only — recompose from the raw captures already in `raw/`:

```bash
python3 marketing/build_marketing_screenshots.py
```

Requires Pillow (`pip3 install --user Pillow`). Panels whose raw capture is
missing are skipped, so a partial set is fine.

## Recapturing (stage 1)

1. Start Postgres and seed the fictional demo band, which also mints a session
   token so the simulator can sign in without a password:

   ```bash
   ./scripts/seed-demo.sh
   ```

2. Start the API with that environment:

   ```bash
   set -a && . ./.env.api && set +a && pnpm dev:api
   ```

3. Build the app against the local API and install it on the 13-inch iPad
   simulator:

   ```bash
   API_URL=http://localhost:3001 pnpm --filter @bandstr/web exec quasar build -m capacitor -T ios --skip-pkg
   cd packages/web/src-capacitor/ios/App
   xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
     -sdk iphonesimulator -derivedDataPath build/SimDerivedData \
     -destination 'name=iPad Pro 13-inch (M4)' CODE_SIGNING_ALLOWED=NO build
   xcrun simctl install booted build/SimDerivedData/Build/Products/Debug-iphonesimulator/App.app
   ```

4. Launch it, then sign in with the deep link printed by `seed-demo.sh`:

   ```bash
   xcrun simctl openurl booted "org.capacitor.bandstr://localhost/#/login?token=<token>"
   ```

5. Switch the app to dark mode, then capture each screen:

   ```bash
   xcrun simctl io booted screenshot marketing/raw/ipad-13/setlist.png
   ```

   Filenames must match the third column of `PANELS` in
   `build_marketing_screenshots.py`.

**After recapturing, rebuild the production web assets** — step 3 leaves
`src-capacitor/ios/App/App/public` pointing at `http://localhost:3001`:

```bash
./scripts/build-ios.sh production
```

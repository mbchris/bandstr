# Iteration 11 — iOS app

- [x] Ensure Capacitor iOS project is configured and buildable from this repository.
- [x] Add native iOS Apple In-App Purchase integration for subscription products.
- [x] Wire Billing UI to use Apple in-app subscriptions on iOS devices.
- [x] Keep Android Google Play Billing and web Stripe checkout/portal flows unchanged.
- [x] Add backend activation endpoint for Apple purchases to update band plan status.
- [x] Add environment variables for Apple bundle and product identifiers.
- [x] Add `./do build-ios` command for iOS archive/IPA build.
- [x] Add `./do deploy-ios` command for local deployment to connected devices.
- [x] Add App Store upload tooling scripts for iOS IPA upload.
- [x] Align iOS upload flow with the same `./do <command> [local|production]` profile pattern used by Android release commands.
- [x] Add an Apple account-owner/App Store Connect checklist for friend-managed Apple Developer accounts.
- [ ] Have the Apple account owner create the App Store Connect app, bundle capabilities, and signing assets for the final bundle ID.
- [ ] Have the Apple account owner create the Apple subscription products matching `APPLE_PRODUCT_PRO_MONTHLY` and `APPLE_PRODUCT_PRO_YEARLY`.
- [ ] Decide and document whether final App Store/TestFlight upload happens from your Mac or your friend's Mac/account.
- [ ] Add automated tests for iOS billing flow and server-side purchase verification.

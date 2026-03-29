# Iteration 9 — Monetization

- [x] Introduce subscription plan model for bands: `free`, `pro`, `pro-zero`.
- [x] Add billing interval support for `pro`: monthly and yearly.
- [x] Integrate payment checkout flow for `pro` plan upgrades.
- [x] Implement subscription status sync (active, canceled, past_due, trialing if used).
- [x] Add webhook handling to keep subscription state in sync with billing provider.
- [x] Keep `pro-zero` as internal-only (not available in public checkout UI/API).
- [x] Add admin/dev-only endpoint or workflow to assign `pro-zero`.
- [x] Enforce free-plan song limit (max 15 setlist songs) on API level.
- [x] Enforce free-plan member limit (max 5 members) on API level.
- [x] Keep free-plan features usable: voting, calendar, availabilities, bierwart, gig setlists.
- [x] Gate shared notes on songs as pro-only (API and UI).
- [x] Gate personal notes on songs as pro-only (API and UI).
- [x] Gate import/export functionality as pro-only (API and UI).
- [x] Update Billing page to show current plan, limits, renewal/cancel info, and upgrade CTA.
- [x] Update Dashboard subscription card to reflect live plan and status.
- [x] Implement downgrade behavior: preserve existing data, block creating items above limit.
- [x] Add clear user-facing messages when limits are reached.
- [ ] Add tests for plan enforcement and subscription transitions.

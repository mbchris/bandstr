# Iteration 12 - User self-registration

**Goal:** Users who do not want to use Google/GitHub can create and manage a credential-based account.

## Acceptance criteria

- [x] An account can be created for an email address
- [x] The email address needs to be verified
- [x] The user can change the own email address (needs to be re-verified)
- [x] The user can set a password
- [x] Password is stored encrypted
- [x] User can reset the password
- [x] User can delete the account

## Notes

- Email/password auth, reset and verification are provided by Better Auth endpoints under `/api/auth/*`.
- Delivery of auth emails is wired through `AUTH_EMAIL_WEBHOOK_URL` (with console fallback in development).
- Account deletion keeps using the guarded `/api/account` endpoint to preserve band ownership constraints.


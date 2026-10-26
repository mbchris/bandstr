# Incident: credentials committed to public repository (2026-10-26)

## Summary

Production credentials were committed to `mbchris/bandstr` (alias `prj120/bandstr`), a **public** GitHub
repository. Google detected the Firebase Admin SDK service-account key and disabled it on 2026-10-26:

> `firebase-adminsdk-fbsvc@fourki-projects.iam.gserviceaccount.com`, key ID `114308485a8661e0ad13e5cc95e1cf9e7fcdec61`

All values below must be treated as **compromised**, regardless of the history rewrite: the repo was public
for months and may have been cloned, forked, or scraped.

## Root cause

Local credential files were committed by catch-all commits (`git add .`) because their names did not match
`.gitignore` (which only covered `.env`, `.env.local`, `.env.production`, ...):

| File | First committed | Commit | Contents |
|---|---|---|---|
| `.env.old` | 2026-06-15 | `a67c578` | Full production env (see list below) |
| `.fourki-projects-firebase-adminsdk-fbsvc-114308485a.json` | 2026-06-15 | `a67c578` | Firebase Admin service-account private key |
| `.tools/play-console-creds-temp.json` | 2026-06-15 | `a67c578` | `bandstr-deployment@bandstr.iam.gserviceaccount.com` private key (ID `86fe007136…`) |
| `.env.bak_before_template_sync` | 2026-09-26 | `7dc6aa9`, `0d990fa` | Full production env incl. APNs key |
| `.env.coolify20260926` | 2026-09-26 | local stash only | Production env (never pushed) |
| `problem_inspection.MD` | 2026-03-30 | `689cbc5` | Pasted `INTERNAL_ADMIN_TOKEN` value |

## Remediation done

1. Backed up the full repo as a git bundle before rewriting.
2. Rewrote all branches, tags and the stash with `git filter-repo`:
   - removed the five files above from every commit;
   - replaced every leaked secret value anywhere in history (e.g. `problem_inspection.MD`) with `***REMOVED***`.
3. Verified no leaked file path or secret value remains in any reachable object.
4. Added the leaked file patterns to `.gitignore`. Local copies were kept on disk, untracked.
5. Force-pushed all rewritten branches and tags to GitHub.

## Still required

### Rotate (the current `.env` still uses the leaked value)

| Secret | Where to rotate | Priority |
|---|---|---|
| `FCM_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS*` (Firebase Admin key `114308485a`) | GCP → IAM → Service accounts → fourki-projects → new key. **Already disabled by Google → push notifications are broken until replaced.** | Critical |
| `GPLAY_SERVICE_ACCOUNT_JSON` + `.tools/play-console-creds-temp.json` (`bandstr-deployment@bandstr`, key `86fe007136`) | GCP → bandstr → Service accounts → delete key, create new | Critical |
| `DATABASE_URL` (password) | Change DB user password in Coolify/Postgres | Critical |
| `COOLIFY_AUTH_TOKEN` | Coolify → Keys & Tokens → revoke + new token | Critical |
| `AUTH_SECRET` | Generate new random secret (invalidates all sessions) | High |
| `INTERNAL_ADMIN_TOKEN` | Generate new random value | High |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client → reset secret | High |
| `GHUB_CLIENT_SECRET` | GitHub → Developer settings → OAuth App → new client secret | High |
| `GPLAY_RTDN_TOKEN` | New random value; update Pub/Sub push subscription URL | Medium |
| `ANDROID_SIGNING_KEYSTORE_*` (keystore + passwords) | If this is the Play **upload** key: Play Console → App integrity → request upload key reset. If it is the app signing key itself, contact Play support. | High |

### Revoke (already replaced in `.env`, but the old values leaked)

- Old `APNS_PRIVATE_KEY` / `APNS_KEY_ID` → Apple Developer → Keys → revoke the old key ID.
- Old `SUPPORT_GITHUB_TOKEN` → GitHub → Settings → Tokens → make sure it is revoked.

### GitHub cleanup

- Ask GitHub Support to purge cached views and dangling commits (old SHAs such as `a67c578`, `0d990fa` stay
  reachable by URL until they do): <https://support.github.com/contact> → "Remove sensitive data".
- Anyone with an existing clone must re-clone (or hard-reset every branch); merging from an old clone
  reintroduces the secrets.

### Checks

- Review GCP audit logs, Coolify logs and DB connection logs since 2026-06-15 for unknown access.

## Prevention

- Keep secrets only in Vaultwarden / GitHub Actions secrets (`creds.sh`, `scripts/sync-ios-secrets-to-env.sh`).
- Never use `git add .` / `git add -A` in the repo root; stage files explicitly.
- Consider a pre-commit secret scanner (`gitleaks protect --staged`) and enabling GitHub push protection
  (Settings → Code security → Secret scanning → Push protection).

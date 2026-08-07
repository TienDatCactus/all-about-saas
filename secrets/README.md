# Compose secrets

Files in this directory are mounted into containers at `/run/secrets/<name>` by
`docker-compose.prod.yml`. Everything here except this README is gitignored.

A secret in a file rather than an environment variable is not inherited by child
processes, does not appear in `docker inspect`, is not readable through
`/proc/<pid>/environ`, and is not swept up by anything that dumps the environment
on a crash.

## Create them (once, on the host)

```bash
mkdir -p secrets
openssl rand -hex 32    | tr -d '\r\n' > secrets/jwt_secret   # >=32 chars, enforced at boot
openssl rand -base64 24 | tr -d '\r\n' > secrets/db_password
# Password stamped onto accounts created through OAuth (see .env.prod.example):
openssl rand -base64 24 | tr -d '\r\n' > secrets/base_password
# OAuth client secrets, pasted from each provider's console. printf, not echo —
# echo appends a newline. Compose needs every listed file to EXIST, so create
# an empty one (plain `touch`) for any provider you don't use; it is only read
# when that provider's CLIENT_ID is set in .env.prod.
printf '%s' '<google client secret>'   > secrets/google_client_secret
printf '%s' '<github client secret>'   > secrets/github_client_secret
printf '%s' '<facebook client secret>' > secrets/facebook_client_secret
chmod 600 secrets/*
```

`tr -d '\r\n'` is not decoration. Under Git Bash `openssl` writes CRLF, and a
trailing carriage return becomes part of the password — the Postgres image drops
it when it initialises the database, so the two ends disagree and you get
`password authentication failed` with nothing to see on either side. The app now
strips one trailing terminator in any form (see `file-secrets.spec.ts`), but a
file with no stray bytes in it is one less thing to reason about.

`jwt_secret` must not be rotated casually: every access and refresh token in
circulation is signed with it, so replacing it logs out every user immediately.

## How the app reads them

The API resolves `<NAME>_FILE` into `<NAME>` at startup
(`apps/api/src/common/config/file-secrets.ts`), the same convention the official
Postgres image uses. Plain environment variables still work, which is what local
development and CI use — nothing in the app's config code has to know the
difference.

Adding a new file-backed secret means adding its name to `FILE_BACKED` in that
file; the allowlist is deliberate, so an unrelated variable ending in `_FILE`
can't be mistaken for a path.

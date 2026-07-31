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
openssl rand -hex 32    > secrets/jwt_secret    # >=32 chars, enforced at boot
openssl rand -base64 24 > secrets/db_password
chmod 600 secrets/*
```

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

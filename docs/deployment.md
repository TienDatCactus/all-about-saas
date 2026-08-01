# Deployment — twinfoundry.org

Single VPS, **existing nginx + certbot** terminating TLS, the app running as a
Docker Compose stack published on loopback only. CI builds images, CD pushes
them to GHCR and swaps them on the server.

```
internet ──443──▶ nginx (host)
                    ├── twinfoundry.org      ──▶ 127.0.0.1:3000  web  (container)
                    └── api.twinfoundry.org  ──▶ 127.0.0.1:8000  api  (container)
                                                       │
                                          internal docker network
                                                       ├── postgres (not published)
                                                       └── backup sidecar
```

Caddy is still in `docker-compose.prod.yml` but behind a `caddy` profile, so it
does **not** start unless you ask for it. Two servers cannot both own :80/:443.

---

## One-time server setup

### 1. DNS

`api.twinfoundry.org` must resolve to the VPS **before** requesting a
certificate — ACME validation fails otherwise.

### 2. Certificate covering both hosts

```bash
sudo certbot --nginx -d twinfoundry.org -d www.twinfoundry.org -d api.twinfoundry.org
```

### 3. nginx config

```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp deploy/nginx/aas-proxy.conf        /etc/nginx/snippets/aas-proxy.conf
sudo cp deploy/nginx/twinfoundry.org.conf  /etc/nginx/sites-available/twinfoundry.org
sudo ln -sf /etc/nginx/sites-available/twinfoundry.org /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

> **Do not skip the proxy snippet.** `main.ts` sets `trust proxy: 1`, meaning
> Express reads the client IP from the rightmost `X-Forwarded-For` entry. The
> previous config never sent that header, so `req.ip` was `127.0.0.1` on every
> request — which collapses the rate limiter into one shared bucket (the 5/min
> login limit then applies to the whole internet at once), records `127.0.0.1`
> as every session's origin, and makes `req.protocol` read `http` behind TLS.

### 4. Checkout and secrets

```bash
sudo mkdir -p /srv/all-about-saas && sudo chown "$USER" /srv/all-about-saas
git clone <repo> /srv/all-about-saas && cd /srv/all-about-saas

mkdir -p secrets
openssl rand -hex 32    | tr -d '\r\n' > secrets/jwt_secret
openssl rand -base64 24 | tr -d '\r\n' > secrets/db_password
chmod 600 secrets/*

cp .env.prod.example .env.prod   # then edit — see below
```

`tr -d '\r\n'` matters: a trailing byte in the password file means Postgres
initialises with one value and the API sends another, and the only symptom is
`password authentication failed` with nothing to see on either side.

`.env.prod` for this host:

```dotenv
DOMAIN=twinfoundry.org
API_DOMAIN=api.twinfoundry.org
ACME_EMAIL=you@example.com          # only used by the caddy profile
DATABASE_USER=aas
DATABASE_NAME=aas
FRONTEND_URL=https://twinfoundry.org
VITE_API_BASE_URL=https://api.twinfoundry.org
API_IMAGE=ghcr.io/tiendatcactus/all-about-saas-api
WEB_IMAGE=ghcr.io/tiendatcactus/all-about-saas-web
```

### 5. First deploy by hand

Prove the stack before letting CI drive it:

```bash
cd /srv/all-about-saas
echo <a-github-PAT-with-read:packages> | docker login ghcr.io -u <user> --password-stdin
IMAGE_TAG=latest ./scripts/deploy.sh
```

### 6. Firewall

```bash
sudo ufw allow 80,443/tcp && sudo ufw enable
```

The compose services bind `127.0.0.1` explicitly. That is load-bearing: a bare
`"8000:8000"` binds `0.0.0.0`, and Docker writes iptables rules that sit *in
front of* ufw — the port would be reachable from the internet while ufw still
reported it closed.

---

## What you must create in GitHub

**Settings → Secrets and variables → Actions.** Add these yourself; they should
never be pasted into a chat, a file, or a commit.

### Secrets

| Name | Value |
|---|---|
| `DEPLOY_HOST` | VPS IP or hostname |
| `DEPLOY_USER` | SSH user that owns `/srv/all-about-saas` |
| `DEPLOY_SSH_KEY` | Private key, **full PEM including header/footer lines** |
| `DEPLOY_PORT` | Only if SSH is not on 22 |

`GITHUB_TOKEN` is built in — GHCR needs no secret of its own.

Generate a deploy-only keypair rather than reusing a personal one:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/aas_deploy -N ""
ssh-copy-id -i ~/.ssh/aas_deploy.pub <user>@<host>
# private half (~/.ssh/aas_deploy) → DEPLOY_SSH_KEY
```

### Variables (not secrets — these are public by nature)

| Name | Value |
|---|---|
| `DEPLOY_PATH` | `/srv/all-about-saas` |
| `VITE_API_BASE_URL` | `https://api.twinfoundry.org` |
| `PUBLIC_WEB_URL` | `twinfoundry.org` |
| `PUBLIC_API_URL` | `api.twinfoundry.org` |

`VITE_API_BASE_URL` is a variable on purpose: Vite inlines it into the shipped
JavaScript, so it is public the moment anyone loads the page. Marking it secret
would hide it from you, not from them.

### Optional gate

Create an environment named **production** (Settings → Environments) with
required reviewers to make every deploy wait for a click. The workflow already
references it; without the environment it deploys straight through.

---

## How a deploy runs

1. Push to `main` → **CI** runs (check-types, lint, build, test, docker build).
2. **CD** triggers on CI *completing successfully* — `workflow_run` fires on
   failure too, so the job explicitly checks the conclusion. It also checks out
   `workflow_run.head_sha`, not the branch tip, so it ships the exact commit CI
   validated.
3. Both images build and push to GHCR tagged with the commit SHA **and** `latest`.
4. SSH to the VPS → `scripts/deploy.sh`:
   - `docker compose pull` first, so a bad tag or expired credential fails while
     the old version is still serving
   - migrations run as a one-shot service, gated on Postgres being healthy
   - `api` and `web` are recreated
   - waits on the compose healthchecks — the API's probe is `/health/ready`,
     which fails when the database is unreachable, so "healthy" means serving
   - on failure: dumps logs and re-invokes itself with the previous tag
   - on success: records the tag in `.last-deployed-tag`
5. A smoke test hits the real public URLs, which is the only step that exercises
   DNS, nginx, TLS and the forwarded headers together.

### Rollback

```bash
# From CI: Actions → CD → Run workflow → image_tag = <older sha>
# On the box:
cd /srv/all-about-saas && IMAGE_TAG=<older-sha> ./scripts/deploy.sh
```

**Migrations do not roll back automatically**, and that is deliberate. An
expand/contract migration is written to be compatible with the previous app
version, so reverting the *app* is safe while reverting a committed *schema*
change can destroy data the old code cannot reconstruct. Failure therefore rolls
the app back and leaves the schema forward. A migration that is not
backwards-compatible needs a planned window, not a rollback button.

---

## Unverified

Written against the config you shared, not yet executed:

- The CD workflow has never run. Its first execution is its first test.
- `deploy.sh` has been syntax-checked (`bash -n`) but never run against a real
  host.
- The nginx config has not been through `nginx -t` on the server.
- Whether `api.twinfoundry.org` is on the certificate depends on the certbot run
  above; if you issued a separate certificate, repoint the `ssl_*` lines in the
  API server block.

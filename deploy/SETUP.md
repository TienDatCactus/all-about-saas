# Fresh VPS → deployed, start to finish

Ubuntu 22.04/24.04. Roughly 30 minutes, most of it waiting on DNS.

Run in this order. Each phase is verifiable on its own, so when something breaks
there is exactly one candidate rather than five.

---

## Phase 0 — DNS first (do this before anything else)

Both records must point at the new VPS **and have propagated** before certbot
runs, or ACME validation fails and Let's Encrypt rate-limits repeated attempts.

| Type | Name | Value |
|---|---|---|
| A | `twinfoundry.org` | new VPS IP |
| A | `www` | new VPS IP |
| A | `api` | new VPS IP |

Verify from your machine, not the server:

```bash
dig +short twinfoundry.org api.twinfoundry.org
```

Both must return the new IP. If you moved from an old VPS, wait out the old
record's TTL.

---

## Phase 1 — Host preparation (as root)

```bash
ssh root@<vps-ip>
git clone https://github.com/TienDatCactus/all-about-saas /tmp/aas
less /tmp/aas/deploy/bootstrap-vps.sh     # read before running
bash /tmp/aas/deploy/bootstrap-vps.sh
```

Installs and configures: security updates (unattended), swap, a non-root
`deploy` user, Docker from the official repo, ufw + a DOCKER-USER chain rule,
fail2ban, journald caps, nginx, certbot. Idempotent — re-run it freely.

**Verify:**

```bash
docker compose version     # v2.x
ufw status verbose         # 22, 80, 443 allowed; default deny incoming
systemctl is-active docker nginx fail2ban chrony
swapon --show
```

---

## Phase 2 — SSH keys, then lock SSH down

There are **three** SSH relationships here and **two** keypairs, which is the
usual source of confusion. One rule settles all of it: *the private key lives
with whoever initiates the connection; the public key goes on whoever accepts
it.*

| Connection | Private key lives | Public key goes |
|---|---|---|
| GitHub Actions → VPS | GitHub Secret `DEPLOY_SSH_KEY` | VPS `/home/deploy/.ssh/authorized_keys` |
| You → VPS | your laptop `~/.ssh/aas_deploy` | the same `authorized_keys` |
| VPS → GitHub (`git fetch`, Phase 3) | VPS `~/.ssh/id_ed25519` | repo → Deploy keys |

So `aas_deploy` is used by two clients — you and GitHub Actions — and **neither
of them is the VPS**. Its private half must never be copied onto the server.

Two separate keypairs on purpose: if the VPS is ever compromised, the attacker
gets read access to the repository, not the key that grants shell access to the
VPS.

**On your laptop**, generate a deploy-only keypair — not a reused personal key,
since this one goes into GitHub Secrets and its blast radius should be one host:

```bash
ssh-keygen -t ed25519 -C "gh-actions-deploy" -f ~/.ssh/aas_deploy -N ""

# sends ONLY the .pub half to the server
ssh-copy-id -i ~/.ssh/aas_deploy.pub deploy@<vps-ip>

# private half -> GitHub Secrets -> DEPLOY_SSH_KEY, whole file including
# the -----BEGIN----- / -----END----- lines
cat ~/.ssh/aas_deploy
```

Generate it here rather than on the server: otherwise the private half has to
travel *off* the VPS to reach GitHub Secrets — through scrollback, shell
history, a clipboard manager, a server backup — and a key that has travelled is
one you can no longer reason about.

**Verify in a second terminal, keeping your root session open:**

```bash
ssh -i ~/.ssh/aas_deploy deploy@<vps-ip> 'docker ps && echo OK'
```

Only after that prints `OK`, harden SSH from the root session:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'                      /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/'        /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl reload ssh
```

`sshd -t` validates the config before reload. Skipping the verification step
above is the single most common way to lock yourself out of a VPS.

---

## Phase 3 — Repository access

`scripts/deploy.sh` runs `git fetch` on every deploy, so the server needs read
access permanently — not just for the first clone.

**If the repo is public:** nothing to do; clone over HTTPS.

**If private**, add a read-only deploy key. This one **is** generated on the
VPS — here the VPS is the client, connecting out to GitHub, so its private half
belongs there and never leaves. Same rule as Phase 2, opposite direction.

```bash
ssh -i ~/.ssh/aas_deploy deploy@<vps-ip>
ssh-keygen -t ed25519 -C "vps-readonly" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Paste that into **repo → Settings → Deploy keys → Add**, leave *Allow write
access* **unchecked**, then confirm:

```bash
ssh -T git@github.com     # "You've successfully authenticated"
```

---

## Phase 4 — Clone and configure (as `deploy`)

```bash
ssh -i ~/.ssh/aas_deploy deploy@<vps-ip>
git clone <repo-url> /srv/all-about-saas
cd /srv/all-about-saas

mkdir -p secrets
openssl rand -hex 32    | tr -d '\r\n' > secrets/jwt_secret
openssl rand -base64 24 | tr -d '\r\n' > secrets/db_password
chmod 600 secrets/*
```

`tr -d '\r\n'` is not optional. A trailing byte means Postgres initialises with
one password and the API sends another, and the only symptom is
`password authentication failed` with nothing visibly wrong on either side.

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

```dotenv
DOMAIN=twinfoundry.org
API_DOMAIN=api.twinfoundry.org
ACME_EMAIL=you@example.com
DATABASE_USER=aas
DATABASE_NAME=aas
FRONTEND_URL=https://twinfoundry.org
VITE_API_BASE_URL=https://api.twinfoundry.org
# lowercase — GHCR rejects capitals, and your org name has them
API_IMAGE=ghcr.io/tiendatcactus/all-about-saas-api
WEB_IMAGE=ghcr.io/tiendatcactus/all-about-saas-web
BACKUP_KEEP_DAYS=14
BACKUP_INTERVAL_SECONDS=86400
```

---

## Phase 5 — nginx and TLS

```bash
sudo certbot --nginx -d twinfoundry.org -d www.twinfoundry.org -d api.twinfoundry.org

sudo mkdir -p /etc/nginx/snippets
sudo cp deploy/nginx/aas-proxy.conf       /etc/nginx/snippets/
sudo cp deploy/nginx/twinfoundry.org.conf /etc/nginx/sites-available/twinfoundry.org
sudo ln -sf /etc/nginx/sites-available/twinfoundry.org /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Verify renewal actually works** — a certificate that cannot renew is a 90-day
timer on an outage:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

---

## Phase 6 — First deploy, by hand

Do this before letting CI drive, so a failure has one possible cause.

```bash
cd /srv/all-about-saas
echo <github-PAT-with-read:packages> | docker login ghcr.io -u TienDatCactus --password-stdin
IMAGE_TAG=latest ./scripts/deploy.sh
```

**Verify:**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps   # all healthy
curl -s https://api.twinfoundry.org/health/ready                    # database: "up"
curl -sI https://twinfoundry.org | head -1                          # 200
```

Then the check nothing else covers — that `X-Forwarded-For` reaches the API.
Log in through the site, then:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres \
  psql -U aas -d aas -c 'SELECT "ipAddress" FROM session ORDER BY "createdAt" DESC LIMIT 1;'
```

Your real public IP means per-client rate limiting works. `127.0.0.1` or
`172.x.x.x` means the proxy snippet is not loaded, and the 5/min login limit is
currently shared by the entire internet.

---

## Phase 7 — Hand over to CI

**Settings → Secrets and variables → Actions**, scoped to the **`AAS`**
environment (the deploy job declares `environment: AAS`; a mismatch makes every
secret resolve to an empty string with no warning).

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | VPS IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/aas_deploy`, including the BEGIN/END lines |
| `SSH_HOST_FINGERPRINT` | `ssh-keyscan -t ed25519 <ip> \| ssh-keygen -lf - \| awk '{print $2}'` |

Variables — required, because the smoke-test step reads them without a default:

| Variable | Value |
|---|---|
| `PUBLIC_WEB_URL` | `twinfoundry.org` |
| `PUBLIC_API_URL` | `api.twinfoundry.org` |
| `DEPLOY_PATH` | `/srv/all-about-saas` (optional; defaults to this) |
| `VITE_API_BASE_URL` | `https://api.twinfoundry.org` (optional; defaults to this) |

Then push to `main` and watch **Actions → CD**.

---

# Making it bullet-proof

The setup above is solid. These are what separate "it works" from "it keeps
working when something goes wrong at 3am".

### 1. Offsite backups — the only one that is non-negotiable

The `backup` sidecar dumps to `./backups` **on the same disk as the database**.
That protects against `DROP TABLE`, not against the disk failing — which is the
failure it exists for.

```bash
sudo apt-get install -y rclone
rclone config          # add an S3 / B2 / Drive remote named e.g. "offsite"
echo 'BACKUP_REMOTE=offsite:aas-backups/postgres' >> /srv/all-about-saas/.env.prod
crontab -e
#  15 4 * * * cd /srv/all-about-saas && ./scripts/backup-db.sh >> /var/log/aas-backup.log 2>&1
```

**Then prove a restore works**, because an untested backup is a hypothesis:

```bash
./scripts/backup-db.sh --verify-latest
```

Put a monthly reminder on that. Backups rot silently — a schema change, a
Postgres major upgrade, a full disk mid-dump.

### 2. External uptime monitoring

The one thing the server cannot do for itself is notice it is down. Point a free
monitor (UptimeRobot, Betterstack, Healthchecks.io) at
`https://api.twinfoundry.org/health/ready` every 5 minutes. That endpoint fails
when Postgres is unreachable, so it catches a dead database, not just a dead
process.

Add a second check on `https://twinfoundry.org`.

### 3. Auto-restart on *unhealthy*, not just on exit

`restart: unless-stopped` restarts a container that **exits**. A container that
is running but failing its healthcheck — wedged event loop, exhausted pool —
stays up forever. Docker has no built-in fix:

```bash
docker run -d --name autoheal --restart unless-stopped \
  -e AUTOHEAL_CONTAINER_LABEL=all \
  -v /var/run/docker.sock:/var/run/docker.sock \
  willfarrell/autoheal
```

Trade-off worth knowing: it mounts the Docker socket, which is root-equivalent.
Acceptable for a single-tenant VPS you control; not something to run casually.

### 4. Disk space alerting

Postgres and Docker images fill disks quietly, and Postgres does not fail
gracefully when it runs out.

```bash
sudo tee /etc/cron.daily/disk-alert >/dev/null <<'EOF'
#!/bin/sh
USE=$(df / --output=pcent | tr -dc '0-9')
[ "$USE" -lt 85 ] || echo "Disk at ${USE}% on $(hostname)" | \
  mail -s "DISK WARNING $(hostname)" you@example.com
EOF
sudo chmod +x /etc/cron.daily/disk-alert
docker system prune -af --filter "until=720h"   # monthly, keeps recent rollback images
```

### 5. Know your rollback before you need it

```bash
# From CI: Actions → CD → Run workflow → image_tag = <older sha>
# On the box:
cd /srv/all-about-saas && IMAGE_TAG=<older-sha> ./scripts/deploy.sh
```

Do this once, deliberately, while nothing is wrong. A rollback path you have
never exercised is not a rollback path.

Remember migrations do **not** roll back automatically, and that is intentional:
an expand/contract migration is written to be compatible with the previous app
version, so reverting the app is safe where reverting committed schema can
destroy data the old code cannot reconstruct.

### 6. Postgres major upgrades

`postgres:16-alpine` is pinned. Bumping to 17 will **not** work by simply
changing the tag — the data directory format differs and the container will
refuse to start. That is a planned migration: dump, upgrade, restore, verify.
Pinning is what stops it happening by accident.

### 7. Rotate the JWT secret only deliberately

Replacing `secrets/jwt_secret` invalidates every access and refresh token in
circulation and logs out every user at once. That is the right lever after a
suspected compromise, and the wrong thing to do casually.

### 8. Snapshots

Most providers offer automatic volume snapshots for a few dollars a month.
Enable them. They recover from the mistakes no application-level backup
covers — `rm -rf` in the wrong directory, a bad `docker compose down -v`.

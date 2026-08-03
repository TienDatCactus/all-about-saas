# Fresh VPS → deployed, start to finish

Ubuntu 22.04/24.04. Roughly 30 minutes, most of it waiting on DNS.

**Every command block below is labelled with where it runs.** Three different
machines are involved and mixing them up is the main way this goes wrong:

| Label | Where | Prompt looks like |
|---|---|---|
| 💻 **LOCAL** | your own computer | `you@laptop:~$` |
| 🖥️ **SERVER (root)** | the VPS, as `root` | `root@instance-…:~#` |
| 🖥️ **SERVER (deploy)** | the VPS, as the `deploy` user | `deploy@instance-…:~$` |
| 🌐 **BROWSER** | GitHub / your DNS provider | — |

**`deploy` effectively cannot use `sudo`.** The bootstrap creates it with
`--disabled-password`, so any `sudo` password prompt is unanswerable, and the
sudoers rule it installs permits exactly two commands (`nginx -t` and
`systemctl reload nginx`). Anything needing root — `apt-get`, writes under
`/etc` — is labelled **SERVER (root)**. If you find yourself typing a password
for `deploy`, you are on the wrong line: there is no password to type.

Switch between them with `su - deploy` (from root) and `exit` (back to root).

Run the phases in order. Each is verifiable on its own, so when something breaks
there is exactly one candidate cause rather than five.

---

## Choose a layout first

Two supported shapes. **Single domain is recommended** — pick it unless you have
a reason to split.

| | Single domain (recommended) | Two domains |
|---|---|---|
| Web | `twinfoundry.org` | `twinfoundry.org` |
| API | `twinfoundry.org/api` | `api.twinfoundry.org` |
| nginx file | `twinfoundry.org-single-domain.conf` | `twinfoundry.org.conf` |
| DNS records | apex + `www` | apex + `www` + `api` |
| CORS | **none** — same origin | required, and a real source of bugs |
| CSP `connect-src` | `'self'` | `'self' https://api.…` |

Single domain removes an entire class of failure: no CORS preflights, no
`SameSite=None` cookie questions, one certificate, one DNS record. The only
thing you give up is repointing the API to a different host purely via DNS.

> Note: owning `twinfoundry.org` **already includes every subdomain** —
> `api.twinfoundry.org` is a free DNS record you create, not a separate
> purchase. So the two-domain option is available to you either way; single
> domain is just the better default.

Everything below marks where the two paths differ. Pick one and stay on it.

---

## Phase 0 — DNS

🌐 **BROWSER** — at your DNS provider:

| Type | Name | Value | Needed for |
|---|---|---|---|
| A | `twinfoundry.org` | new VPS IP | both layouts |
| A | `www` | new VPS IP | both layouts |
| A | `api` | new VPS IP | **two-domain only** |

💻 **LOCAL** — confirm they resolve before going further. Certbot fails if they
do not, and Let's Encrypt rate-limits repeated attempts:

```bash
# single domain
dig +short twinfoundry.org www.twinfoundry.org

# two domains — add this
dig +short api.twinfoundry.org
```

All must return the new IP. Migrating from an old VPS? Wait out the old record's
TTL first.

---

## Phase 1 — Host preparation

💻 **LOCAL** — connect as root (your provider's initial credentials):

```bash
ssh root@<vps-ip>
```

🖥️ **SERVER (root)** — everything from here until Phase 2 runs on the VPS:

```bash
git clone https://github.com/TienDatCactus/all-about-saas /tmp/aas
less /tmp/aas/deploy/bootstrap-vps.sh     # read it before you run it
bash /tmp/aas/deploy/bootstrap-vps.sh
```

**Shortcut worth taking:** generate your deploy key first (Phase 2's first
command), then pass the public half here — it saves a step and avoids the
`ssh-copy-id` trap described in Phase 2.

🖥️ **SERVER (root)**:

```bash
DEPLOY_PUBKEY="<paste contents of ~/.ssh/aas_deploy.pub>" bash /tmp/aas/deploy/bootstrap-vps.sh
```

Installs: unattended security updates, chrony, swap, the non-root `deploy`
user, Docker from the official repo, ufw + a DOCKER-USER chain rule, fail2ban,
journald caps, nginx, certbot. Idempotent — safe to re-run.

🖥️ **SERVER (root)** — verify:

```bash
docker compose version                              # v2.x
ufw status verbose                                  # 22, 80, 443; default deny in
systemctl is-active docker nginx fail2ban chrony
swapon --show
```

**Stay logged in as root** for Phase 2 — you will need this session as a
lifeline.

---

## Phase 2 — SSH keys, then lock SSH down

Three SSH relationships, two keypairs. One rule settles all of it: *the private
key lives with whoever initiates the connection; the public key goes on whoever
accepts it.*

| Connection | Private key lives | Public key goes |
|---|---|---|
| GitHub Actions → VPS | GitHub Secret `DEPLOY_SSH_KEY` | VPS `/home/deploy/.ssh/authorized_keys` |
| You → VPS | 💻 laptop `~/.ssh/aas_deploy` | the same `authorized_keys` |
| VPS → GitHub (Phase 3) | 🖥️ VPS `~/.ssh/id_ed25519` | repo → Deploy keys |

`aas_deploy` is used by two clients — you and GitHub Actions — and **neither is
the VPS**. Its private half must never be copied onto the server.

Two separate keypairs on purpose: if the VPS is compromised, the attacker gets
read access to the repository, not the key granting shell access to the VPS.

💻 **LOCAL** — in a *new terminal on your laptop*, not the SSH session:

```bash
ssh-keygen -t ed25519 -C "gh-actions-deploy" -f ~/.ssh/aas_deploy -N ""
```

Generated on the laptop deliberately: otherwise the private half must travel
*off* the VPS to reach GitHub Secrets — through scrollback, shell history, a
clipboard manager, a server backup — and a key that has travelled is one you can
no longer reason about.

💻 **LOCAL** — install the public half **through root**, not with
`ssh-copy-id`:

```bash
cat ~/.ssh/aas_deploy.pub | ssh root@<vps-ip> \
  'install -d -m700 -o deploy -g deploy /home/deploy/.ssh \
   && cat >> /home/deploy/.ssh/authorized_keys \
   && chown deploy:deploy /home/deploy/.ssh/authorized_keys \
   && chmod 600 /home/deploy/.ssh/authorized_keys \
   && echo INSTALLED'
```

> **Why not `ssh-copy-id`?** The bootstrap creates `deploy` with
> `--disabled-password`, so the account has no password and never will.
> `ssh-copy-id` has to log in *as that user* to append the key — but the key is
> the only credential it would have, and it is not installed yet. It fails with
> an unanswerable password prompt. Root is the way in until the key exists.
>
> Cleaner still: pass the key to the bootstrap script and skip this entirely —
> `DEPLOY_PUBKEY="$(cat ~/.ssh/aas_deploy.pub)" bash bootstrap-vps.sh`.

Only `chmod 600` and a `700` `.ssh` directory will do: sshd silently ignores an
`authorized_keys` that is group- or world-writable, and tells the client nothing
beyond `Permission denied`.

💻 **LOCAL** — verify the key works **before** disabling passwords:

```bash
ssh -i ~/.ssh/aas_deploy deploy@<vps-ip> 'docker ps && echo OK'
```

Only once that prints `OK`:

🖥️ **SERVER (root)** — back in your still-open root session:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'                           /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/'             /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl reload ssh
```

`sshd -t` validates before reloading. Skipping the verification step above is
the single most common way to lock yourself out of a VPS.

💻 **LOCAL** — capture the host fingerprints for GitHub (Phase 7):

```bash
ssh-keyscan <vps-ip> 2>/dev/null | ssh-keygen -lf -
```

Three lines come back — ECDSA, ED25519, RSA. **Use the ECDSA one**, and only the
`SHA256:…` token.

Why not ed25519, the modern choice? The Action verifies whichever host key the
handshake *negotiates*, and Go's SSH client — which drone-ssh is built on —
generally prefers ECDSA when the server offers it. Pinning ed25519 then fails
with `ssh: handshake failed: ssh: host key fingerprint mismatch` even though the
value was copied perfectly, which reads like a key problem and is not one.

If it still mismatches, try the ED25519 then RSA line. And note this value is
**per-machine**: rebuild or replace the VPS and it changes, so a stale secret
from a previous host produces the identical error.
SHA256:2xLx4ktHvLNCweF0IlxDWaD0q9ecwRmIuLshiLrPtr4

---

## Phase 3 — Repository access for the server

`scripts/deploy.sh` runs `git fetch` on **every** deploy, so the server needs
read access permanently — not just for the first clone.

**Public repo:** nothing to do, clone over HTTPS in Phase 4. Skip to Phase 4.

**Private repo** — this key *is* generated on the VPS, because here the VPS is
the client connecting out to GitHub. Same rule, opposite direction.

💻 **LOCAL** — log in as the deploy user:

```bash
ssh -i ~/.ssh/aas_deploy deploy@<vps-ip>
```

🖥️ **SERVER (deploy)**:

```bash
ssh-keygen -t ed25519 -C "vps-readonly" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAvnl1S9n0yBVn4HL2q70humpCN+Ie0HYpsd8PGbVQ9F vps-readonly

🌐 **BROWSER** — repo → Settings → Deploy keys → **Add deploy key**. Paste it.
Leave *Allow write access* **unchecked**.

🖥️ **SERVER (deploy)** — confirm:

```bash
ssh -T git@github.com      # "You've successfully authenticated"
```

---

## Phase 4 — Clone and configure the app

🖥️ **SERVER (deploy)** — all of Phase 4 runs as the `deploy` user:

```bash
git clone <repo-url> /srv/all-about-saas
cd /srv/all-about-saas

mkdir -p secrets
openssl rand -hex 32    | tr -d '\r\n' > secrets/jwt_secret
openssl rand -base64 24 | tr -d '\r\n' > secrets/db_password
chmod 600 secrets/*
```

`tr -d '\r\n'` is not optional. A trailing byte means Postgres initialises with
one password while the API sends another, and the only symptom is
`password authentication failed` with nothing visibly wrong on either side.

🖥️ **SERVER (deploy)** — still in `/srv/all-about-saas`:

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

🖥️ **SERVER (deploy)** — the contents to write into that file:

**Single domain** (recommended):

```dotenv
DOMAIN=twinfoundry.org
ACME_EMAIL=you@example.com
DATABASE_USER=aas
DATABASE_NAME=aas
FRONTEND_URL=https://twinfoundry.org
VITE_API_BASE_URL=https://twinfoundry.org/api
# lowercase — GHCR rejects capitals, and the org name has them
API_IMAGE=ghcr.io/tiendatcactus/all-about-saas-api
WEB_IMAGE=ghcr.io/tiendatcactus/all-about-saas-web
BACKUP_KEEP_DAYS=14
BACKUP_INTERVAL_SECONDS=86400
```

**Two domains** — same as above but with these two lines instead:

```dotenv
API_DOMAIN=api.twinfoundry.org
VITE_API_BASE_URL=https://api.twinfoundry.org
```

`VITE_API_BASE_URL` is compiled into the browser bundle at **image build time**,
not read at runtime — so changing it here does nothing on its own. CI reads the
GitHub variable of the same name when it builds the web image (Phase 7); this
entry only matters if you ever build images on the server.

---

## Phase 5 — nginx and TLS

**Use `certonly`, not `--nginx`.** The `--nginx` *installer* edits an existing
server block to add TLS — but there is no such block yet, so it fails with
*"Could not automatically find a matching server block"*. More importantly we do
not want it editing the config: the files below already declare the certificate
paths. Certbot's only job here is issuance.

If you already ran `certbot --nginx` and saw that error: the certificate was
still **issued successfully**, which is all that was needed. Skip to the config
step and do **not** run `certbot install`.

🖥️ **SERVER (root)** — **single domain** (recommended):

```bash
cd /srv/all-about-saas
certbot certonly --nginx -d twinfoundry.org -d www.twinfoundry.org

mkdir -p /etc/nginx/snippets
cp deploy/nginx/aas-proxy.conf /etc/nginx/snippets/
cp deploy/nginx/twinfoundry.org-single-domain.conf \
   /etc/nginx/sites-available/twinfoundry.org
ln -sf /etc/nginx/sites-available/twinfoundry.org /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

🖥️ **SERVER (root)** — **two domains** instead:

```bash
cd /srv/all-about-saas
certbot certonly --nginx -d twinfoundry.org -d www.twinfoundry.org -d api.twinfoundry.org

mkdir -p /etc/nginx/snippets
cp deploy/nginx/aas-proxy.conf       /etc/nginx/snippets/
cp deploy/nginx/twinfoundry.org.conf /etc/nginx/sites-available/twinfoundry.org
ln -sf /etc/nginx/sites-available/twinfoundry.org /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Enable **one** of the two — both declare `server_name twinfoundry.org` and nginx
will refuse or silently pick one.

`nginx -t` fails if a referenced file is absent. If it names
`/etc/letsencrypt/ssl-dhparams.pem`, certbot never wrote it — the nginx plugin
normally does that during install, which `certonly` skips.

🖥️ **SERVER (root)** — only if `nginx -t` complains about it:

```bash
curl -fsSL https://raw.githubusercontent.com/certbot/certbot/main/certbot/certbot/ssl-dhparams.pem \
  -o /etc/letsencrypt/ssl-dhparams.pem
nginx -t && systemctl reload nginx
```

> Run these as root rather than `deploy`: the bootstrap's sudo rule is
> deliberately narrow (`systemctl reload nginx` and `nginx -t` only), so
> `certbot` and writes into `/etc/nginx/` are not covered. Widening it would give
> the deploy key more power than a deploy needs — and this is one-time setup, not
> part of any deploy.

> If `certbot` or `cp` is refused, the bootstrap's narrow sudo rule does not
> cover them. Run these four as **SERVER (root)** instead — they are one-time
> setup, not part of any deploy.

🖥️ **SERVER (root)** — a reload hook, which `certonly` makes **mandatory**:

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' \
  > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

With no certbot *installer* managing the config, **nothing reloads nginx when
the certificate is replaced**. The renewal timer would succeed every 60 days
while nginx kept serving the certificate it loaded at boot — a silent 90-day
fuse that looks perfectly healthy right up to the outage. Hooks under
`renewal-hooks/deploy/` run only after an actual renewal, not on every tick.

(The bootstrap script writes this hook too; this is here for hosts prepared
before that was added, and it is idempotent either way.)

🖥️ **SERVER (root)** — verify renewal works end to end:

```bash
certbot renew --dry-run
systemctl list-timers | grep certbot
```

---

## Phase 6 — First deploy, by hand

Do this before letting CI drive, so a failure has one possible cause.

🌐 **BROWSER** — create a PAT with `read:packages` scope
(github.com/settings/tokens).

🖥️ **SERVER (deploy)**:

```bash
cd /srv/all-about-saas
echo <that-PAT> | docker login ghcr.io -u TienDatCactus --password-stdin
IMAGE_TAG=latest ./scripts/deploy.sh
```

🖥️ **SERVER (deploy)** — verify:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps    # all healthy
```

💻 **LOCAL** — verify from outside, which is what actually matters:

```bash
# single domain
curl -s  https://twinfoundry.org/api/health/ready     # database: "up"

# two domains
curl -s  https://api.twinfoundry.org/health/ready     # database: "up"

# both
curl -sI https://twinfoundry.org | head -1            # 200
```

🌐 **BROWSER** — sign up and log in at `https://twinfoundry.org`. Then the check
nothing else covers:

🖥️ **SERVER (deploy)**:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres \
  psql -U aas -d aas -c 'SELECT "ipAddress" FROM session ORDER BY "createdAt" DESC LIMIT 1;'
```

Your real public IP → per-client rate limiting works. `127.0.0.1` or
`172.x.x.x` → the proxy snippet is not loaded, and the 5/min login limit is
currently shared by the entire internet.

---

## Phase 7 — Hand over to CI

🌐 **BROWSER** — repo → Settings → Secrets and variables → Actions, scoped to
the **`AAS`** environment. The deploy job declares `environment: AAS`; a
mismatch makes every secret resolve to an empty string with no warning.

| Secret | Value | Where you got it |
|---|---|---|
| `DEPLOY_HOST` | VPS IP | your provider |
| `DEPLOY_USER` | `deploy` | — |
| `DEPLOY_SSH_KEY` | 💻 `cat ~/.ssh/aas_deploy` — whole file, BEGIN/END lines included | Phase 2 |
| `SSH_HOST_FINGERPRINT` | the **ECDSA** `SHA256:…` token | Phase 2 |

`SSH_HOST_FINGERPRINT` is optional — omit it and the Action accepts whatever key
the server presents, which is a first-connection MITM window but unblocks a
deploy. It is also **per-machine**: replacing or rebuilding the VPS invalidates
it, and a stale value fails with `host key fingerprint mismatch`, which looks
like an authentication problem and is not one.

Variables — `PUBLIC_WEB_URL` and `PUBLIC_API_URL` are **required** (the
smoke-test step reads them with no default):

| Variable | Single domain | Two domains |
|---|---|---|
| `PUBLIC_WEB_URL` | `twinfoundry.org` | `twinfoundry.org` |
| `PUBLIC_API_URL` | `twinfoundry.org/api` | `api.twinfoundry.org` |
| `VITE_API_BASE_URL` | `https://twinfoundry.org/api` | `https://api.twinfoundry.org` |
| `DEPLOY_PATH` | `/srv/all-about-saas` | `/srv/all-about-saas` |

`VITE_API_BASE_URL` **must** be set for single domain — the workflow's default is
the two-domain value, so leaving it unset ships a bundle that calls a host you do
not have. The smoke test would not catch it: the API answers on `/api` either
way, and only a browser actually loading the page would fail.

💻 **LOCAL** — push and watch Actions → CD:

```bash
git push origin main
```

---

# Making it bullet-proof

The setup above is solid. These separate "it works" from "it keeps working when
something goes wrong at 3am".

### 1. Offsite backups — the only non-negotiable one

The `backup` sidecar dumps to `./backups` **on the same disk as the database**.
That protects against `DROP TABLE`, not against the disk failing — which is the
failure it exists for.

🖥️ **SERVER (root)** — install the package. `deploy` cannot: it has no password
(`--disabled-password`), so its `sudo` prompt is unanswerable, and the sudoers
rule the bootstrap writes deliberately covers only `nginx -t` and
`systemctl reload nginx`:

```bash
apt-get install -y rclone
```

🖥️ **SERVER (deploy)** — configure and schedule as the user that owns the
checkout and is in the `docker` group. No `sudo` anywhere here:

```bash
rclone config                    # create a remote named e.g. "offsite"
echo 'BACKUP_REMOTE=offsite:aas-backups/postgres' >> /srv/all-about-saas/.env.prod
crontab -e
#  15 4 * * * cd /srv/all-about-saas && ./scripts/backup-db.sh >> /home/deploy/aas-backup.log 2>&1
```

The log goes to the home directory, not `/var/log/` — that is root-owned, and
the redirect would fail silently every night, leaving a cron job that appears to
run and records nothing.

Cron matters more than it looks: `rclone` reads its config from
`$HOME/.config/rclone/`, so the crontab must belong to the **same user** that ran
`rclone config`. A root crontab calling this script finds no remote and quietly
skips the upload, having reported success.

🖥️ **SERVER (deploy)** — then **prove a restore works**, because an untested
backup is a hypothesis:

```bash
cd /srv/all-about-saas && ./scripts/backup-db.sh --verify-latest
```

Put a monthly reminder on that. Backups rot silently — a schema change, a
Postgres major upgrade, a full disk mid-dump.

### 2. External uptime monitoring

🌐 **BROWSER** — the one thing a server cannot do is notice it is down. Point a
free monitor (UptimeRobot, Betterstack, Healthchecks.io) at
`https://api.twinfoundry.org/health/ready` every 5 minutes. That endpoint fails
when Postgres is unreachable, so it catches a dead *database*, not just a dead
process. Add a second check on `https://twinfoundry.org`.

### 3. Auto-restart on *unhealthy*, not just on exit

`restart: unless-stopped` restarts a container that **exits**. One that is
running but failing its healthcheck — wedged event loop, exhausted pool — stays
broken forever. Docker has no built-in answer.

🖥️ **SERVER (deploy)**:

```bash
docker run -d --name autoheal --restart unless-stopped \
  -e AUTOHEAL_CONTAINER_LABEL=all \
  -v /var/run/docker.sock:/var/run/docker.sock \
  willfarrell/autoheal
```

Trade-off: it mounts the Docker socket, which is root-equivalent. Fine on a
single-tenant VPS you control; not something to run casually.

### 4. Disk alerting

Postgres and Docker images fill disks quietly, and Postgres does not fail
gracefully when it runs out.

🖥️ **SERVER (root)**:

```bash
tee /etc/cron.daily/disk-alert >/dev/null <<'EOF'
#!/bin/sh
USE=$(df / --output=pcent | tr -dc '0-9')
[ "$USE" -lt 85 ] || echo "Disk at ${USE}% on $(hostname)" | \
  mail -s "DISK WARNING $(hostname)" you@example.com
EOF
chmod +x /etc/cron.daily/disk-alert
```

🖥️ **SERVER (deploy)** — monthly, keeps recent images for rollback:

```bash
docker system prune -af --filter "until=720h"
```

### 5. Rehearse the rollback before you need it

🌐 **BROWSER**: Actions → CD → Run workflow → `image_tag` = an older SHA.

🖥️ **SERVER (deploy)**:

```bash
cd /srv/all-about-saas && IMAGE_TAG=<older-sha> ./scripts/deploy.sh
```

Do it once, deliberately, while nothing is wrong. A rollback path you have never
exercised is not a rollback path.

Migrations do **not** roll back automatically, by design: an expand/contract
migration is written to stay compatible with the previous app version, so
reverting the app is safe where reverting committed schema can destroy data the
old code cannot reconstruct.

### 6. Postgres major upgrades

`postgres:16-alpine` is pinned. Changing the tag to 17 will **not** work — the
data directory format differs and the container refuses to start. That is a
planned migration: dump, upgrade, restore, verify. The pin is what stops it
happening by accident.

### 7. Rotate the JWT secret only deliberately

Replacing `secrets/jwt_secret` invalidates every access and refresh token in
circulation and signs out every user at once. Right lever after a suspected
compromise; wrong thing to do casually.

### 8. Provider snapshots

🌐 **BROWSER** — most providers offer automatic volume snapshots for a few
dollars a month. Enable them. They cover the mistakes no application-level
backup does: `rm -rf` in the wrong directory, a stray `docker compose down -v`.

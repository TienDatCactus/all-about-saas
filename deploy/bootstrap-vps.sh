#!/usr/bin/env bash
#
# One-time host preparation for a fresh Ubuntu 22.04/24.04 VPS.
#
#   ssh root@<new-vps>
#   curl -fsSL <raw-url>/deploy/bootstrap-vps.sh -o bootstrap-vps.sh
#   less bootstrap-vps.sh          # read it before running it
#   bash bootstrap-vps.sh
#
# Idempotent: safe to re-run. It does NOT deploy the app and does NOT disable
# password SSH — that last step is deliberately manual, because getting it wrong
# locks you out of your own machine. See the printed instructions at the end.
#
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/srv/all-about-saas}"
SWAP_GB="${SWAP_GB:-2}"

# Public key to install for the deploy user. Strongly recommended:
#
#   DEPLOY_PUBKEY="$(cat ~/.ssh/aas_deploy.pub)" bash bootstrap-vps.sh
#
# The user is created with --disabled-password, so it has no password and never
# will. That means `ssh-copy-id` CANNOT be used to add the key afterwards —
# ssh-copy-id has to log in as that user to append it, and there is no
# credential to log in with. Installing the key here, while we are already root,
# is the only step that closes that loop. Left unset, the script prints the
# recovery command instead.
DEPLOY_PUBKEY="${DEPLOY_PUBKEY:-}"

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }

# ---------------------------------------------------------------------------
step "1/10  Base packages and security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
	ca-certificates curl gnupg git ufw fail2ban unattended-upgrades \
	apt-listchanges chrony jq

# Security patches applied without anyone remembering to log in. A VPS that is
# only patched when someone thinks of it is patched roughly never.
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

# TLS certificate validation is time-sensitive: a clock that drifts far enough
# makes valid certificates look expired (or not yet valid) in both directions.
systemctl enable --now chrony >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
step "2/10  Swap (${SWAP_GB}G)"
# Postgres and two Node processes on a small VPS will hit the OOM killer during
# a build or a large query, and the kernel picks the victim, not you. Swap turns
# "a container is silently gone" into "things got slow".
if ! swapon --show | grep -q .; then
	fallocate -l "${SWAP_GB}G" /swapfile
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
	# Prefer RAM; use swap as a safety net rather than routinely.
	sysctl -qw vm.swappiness=10
	grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >>/etc/sysctl.conf
	note "swap enabled"
else
	note "swap already present, skipping"
fi

# ---------------------------------------------------------------------------
step "3/10  Deploy user"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
	adduser --disabled-password --gecos "" "$DEPLOY_USER"
	note "created $DEPLOY_USER"
else
	note "$DEPLOY_USER already exists"
fi
# Passwordless sudo ONLY for systemctl reload of nginx, so deploys never need
# a full-root key. Everything else the deploy does is inside Docker.
cat >/etc/sudoers.d/90-"$DEPLOY_USER" <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx, /usr/sbin/nginx -t
EOF
chmod 440 /etc/sudoers.d/90-"$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH_KEYS"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_KEYS"
# sshd silently ignores authorized_keys if it is group- or world-writable, and
# reports nothing more useful than "Permission denied" to the client.
chmod 600 "$AUTH_KEYS"

if [ -n "$DEPLOY_PUBKEY" ]; then
	# Appended, not overwritten — re-running must not evict a key that already
	# works. grep -qF makes it idempotent.
	if grep -qF "$DEPLOY_PUBKEY" "$AUTH_KEYS" 2>/dev/null; then
		note "public key already present"
	else
		printf '%s\n' "$DEPLOY_PUBKEY" >>"$AUTH_KEYS"
		note "installed public key for $DEPLOY_USER"
	fi
	KEY_INSTALLED=yes
else
	KEY_INSTALLED=no
	note "DEPLOY_PUBKEY not set — no key installed (recovery command printed at the end)"
fi

# ---------------------------------------------------------------------------
step "4/10  Docker (official repo)"
# NOT the snap. Snap's Docker is strictly confined and cannot bind-mount from
# arbitrary host paths — which breaks ./secrets and ./backups, the two mounts
# this stack depends on, in ways that look like permission bugs.
if ! command -v docker >/dev/null 2>&1; then
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
		gpg --dearmor -o /etc/apt/keyrings/docker.gpg
	chmod a+r /etc/apt/keyrings/docker.gpg
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
		>/etc/apt/sources.list.d/docker.list
	apt-get update -qq
	apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
		docker-buildx-plugin docker-compose-plugin
else
	note "docker already installed"
fi

# Global log caps. docker-compose.prod.yml sets these per service, but anything
# started outside it — a debug `docker run`, a future service — would otherwise
# write unbounded json logs until the disk fills.
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
EOF
systemctl enable --now docker >/dev/null 2>&1 || true
systemctl restart docker
usermod -aG docker "$DEPLOY_USER"
note "added $DEPLOY_USER to the docker group"
note "NOTE: the docker group is root-equivalent — anyone in it can mount / and escalate."

# ---------------------------------------------------------------------------
step "5/10  Firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status verbose | sed 's/^/    /'

# Docker writes its own iptables rules in the DOCKER-USER chain, which is
# consulted BEFORE ufw's — so a container published with "-p 8000:8000" is
# reachable from the internet while `ufw status` still says the port is closed.
# This stack binds everything to 127.0.0.1 so it does not arise, but one
# forgetful `docker run -p` later would. Close the hole at the chain ufw cannot
# see.
cat >/etc/docker/docker-user-firewall.sh <<'EOF'
#!/bin/sh
# Drop externally-originated traffic to containers; allow established replies
# and anything from the host or docker's own bridges.
iptables -I DOCKER-USER -i eth0 -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN 2>/dev/null || true
iptables -I DOCKER-USER -i eth0 -j DROP 2>/dev/null || true
EOF
chmod +x /etc/docker/docker-user-firewall.sh
cat >/etc/systemd/system/docker-user-firewall.service <<'EOF'
[Unit]
Description=Restrict external access to Docker-published ports
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
ExecStart=/etc/docker/docker-user-firewall.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now docker-user-firewall >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
step "6/10  fail2ban"
cat >/etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban

# ---------------------------------------------------------------------------
step "7/10  journald size cap"
# Default journald can grow to 10% of the disk. On a 25G VPS that is 2.5G of
# logs competing with Postgres for space.
mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/size.conf <<'EOF'
[Journal]
SystemMaxUse=500M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald

# ---------------------------------------------------------------------------
step "8/10  nginx + certbot"
apt-get install -y -qq nginx certbot python3-certbot-nginx
systemctl enable --now nginx >/dev/null 2>&1 || true
# The packaged default site answers unmatched Host headers and gets in the way
# of the app's server blocks. Removed here so it cannot win a load-order race.
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Reload nginx after every successful renewal.
#
# Certificates are obtained with `certonly`, so no certbot *installer* manages
# the nginx config — which also means nothing reloads nginx when the certificate
# is replaced. The renewal timer would quietly succeed every 60 days while nginx
# kept serving the certificate it loaded at startup, until it expired: a silent
# 90-day fuse that looks like nothing is wrong right up to the outage.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
# Runs only after a certificate is actually renewed, not on every timer tick.
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# certbot's nginx plugin normally drops this in during install. With certonly
# that never happens, and a config referencing it fails nginx -t.
if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
	curl -fsSL \
		https://raw.githubusercontent.com/certbot/certbot/main/certbot/certbot/ssl-dhparams.pem \
		-o /etc/letsencrypt/ssl-dhparams.pem 2>/dev/null ||
		note "could not fetch ssl-dhparams.pem — remove the ssl_dhparam line if nginx -t complains"
fi

# ---------------------------------------------------------------------------
step "9/10  Application directory"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
note "$APP_DIR owned by $DEPLOY_USER"

# ---------------------------------------------------------------------------
step "10/10  Host key fingerprints (for SSH_HOST_FINGERPRINT)"
# All of them, not just ed25519. The GitHub Action verifies whichever host key
# the handshake actually negotiates, and Go's SSH client — which drone-ssh uses —
# generally prefers ECDSA when the server offers it. Pinning the ed25519
# fingerprint then fails with "host key fingerprint mismatch" even though the
# value was copied correctly. Use the ECDSA line unless it proves otherwise.
ssh-keyscan localhost 2>/dev/null | ssh-keygen -lf - |
	sed "s/localhost/$(hostname -I 2>/dev/null | awk '{print $1}')/" |
	sed 's/^/    /'
note "^ set the ECDSA one as SSH_HOST_FINGERPRINT (the SHA256:... token only)"

cat <<EOF

============================================================================
Host prepared. NOTHING is deployed yet, and password SSH is still enabled.

NEXT, in order — do not skip the verification step:
EOF

if [ "$KEY_INSTALLED" = no ]; then
	cat <<EOF

 1. Install your public key. NOTE: ssh-copy-id will NOT work — $DEPLOY_USER was
    created with --disabled-password, so it has no credential to authenticate
    with, and ssh-copy-id needs to log in as that user to append the key.
    Push it through root instead, FROM YOUR LAPTOP:

      cat ~/.ssh/aas_deploy.pub | ssh root@<this-host> \\
        'cat >> /home/$DEPLOY_USER/.ssh/authorized_keys'

    Or re-run this script with the key:
      DEPLOY_PUBKEY="\$(cat ~/.ssh/aas_deploy.pub)" bash bootstrap-vps.sh
EOF
else
	cat <<EOF

 1. Public key already installed for $DEPLOY_USER. (Skip.)
EOF
fi

cat <<EOF

 2. VERIFY it works, in a SECOND terminal, keeping this session open:
      ssh -i ~/.ssh/aas_deploy $DEPLOY_USER@<this-host> 'docker ps'

    Only once that succeeds, harden SSH (this is what locks people out):
      sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'            /etc/ssh/sshd_config
      sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
      sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
      sshd -t && systemctl reload ssh

 3. Clone and configure the app as $DEPLOY_USER — see docs/deployment.md.

 4. DNS for both hostnames must resolve here BEFORE requesting certificates.
============================================================================
EOF

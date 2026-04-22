# VPS security hardening (IONOS)

One-time manual steps for the production VPS. None of this is automated by
the deploy pipeline — run it on a fresh host before the first deploy, and
re-check the state after any provider-side intervention (e.g. a rescue
boot).

All commands assume you are logged in as `root` initially via the IONOS
console. After the `deploy` user is set up and verified, subsequent
sessions should use that account (with `sudo` where needed).

## 1. Create an unprivileged deploy user

```
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy       # optional — only if deploy needs sudo for ops tasks
```

`docker` group membership is required so the deploy user can run
`docker compose` commands without sudo.

## 2. SSH key-based auth for the deploy user

From your local workstation, copy your public key onto the VPS:

```
ssh-copy-id deploy@<vps-ip>
```

Or manually:

```
# on the VPS, as root:
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
# paste your public key into authorized_keys:
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Then verify from your local workstation **in a new terminal** (keep the
original root session open until you've confirmed the new login works):

```
ssh deploy@<vps-ip>
```

If this fails, do NOT proceed to step 3 — you will lock yourself out.

## 3. Disable root login and password auth in sshd

Edit `/etc/ssh/sshd_config` and set:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
```

If any of these lines already exist with different values, edit the
existing line rather than adding a second copy (duplicate directives cause
sshd to emit warnings and in some versions refuse to start).

Reload sshd so the change takes effect without killing your current
session:

```
sshd -t                 # syntax-check first — must print nothing
systemctl reload sshd
```

Confirm the new settings are live from a **third** terminal:

```
ssh root@<vps-ip>                     # must fail with "Permission denied"
ssh -o PubkeyAuthentication=no deploy@<vps-ip>   # must fail with "Permission denied"
```

If either of those succeeds, the reload didn't apply — investigate before
disconnecting your working session.

## 4. Rotate the root password

The previous root password was exposed in a session log — rotate it even
though root login over SSH is now disabled. Console / rescue access still
uses the password.

```
passwd root
```

Generate a strong password (20+ chars, mixed case, digits, symbols) with a
password manager and store it there. Do NOT reuse a password from any
other account.

## 5. Host firewall (ufw)

The application sits behind Caddy which needs 80/443; SSH stays on 22.
Everything else should be closed at the host level as defence in depth —
Docker's own iptables rules are not a substitute.

```
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP (Caddy → redirects to HTTPS)
ufw allow 443/tcp       # HTTPS
ufw enable
ufw status verbose      # verify
```

**Docker compatibility note.** ufw and Docker both write to iptables, and
by default Docker publishes container ports via DNAT rules that bypass
ufw's `INPUT` chain. If you publish ports with `-p` / `ports:` in compose
and need them firewalled, set `"iptables": false` in `/etc/docker/daemon.json`
and manage all rules via ufw — OR use the `ufw-docker` helper script. The
current TAKO stack only exposes 80/443 via Caddy on the host network, so
the default behaviour is fine as long as no compose file adds a `ports:`
mapping.

## 6. Remove the stale landing backup

`/opt/tako/landing/index.html.bak` was left on disk during an earlier
deploy and is world-readable. Remove it:

```
rm -f /opt/tako/landing/index.html.bak
```

Grep the landing tree for any other `*.bak` / `*.old` / `*~` stragglers:

```
find /opt/tako/landing -type f \( -name '*.bak' -o -name '*.old' -o -name '*~' \) -print
```

Delete anything that turns up.

## 7. Verify

```
# SSH
sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication'
# expect:
#   permitrootlogin no
#   passwordauthentication no
#   pubkeyauthentication yes

# Firewall
ufw status
# expect: Status: active, 22/tcp/80/tcp/443/tcp ALLOW, everything else denied

# No stale files
ls -la /opt/tako/landing/*.bak 2>/dev/null   # expect: no such file or directory
```

If any of these checks fail, fix before considering the VPS ready for
production traffic.

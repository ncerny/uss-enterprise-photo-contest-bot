# Discord Bot Deployment Guide

This document walks through provisioning a VM, installing dependencies, deploying the USS Enterprise Photo Contest Bot, and keeping it running via `systemd`.

## 1. Prerequisites

- Ubuntu 22.04 (or any systemd-based Linux distro)
- Node.js 18.x LTS + npm 9+
- Git
- Firebase service account JSON (admin SDK)
- Discord bot token + client ID
- `enterprise-photo-contest-bot` Firebase project already configured

Install Node.js via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2. Directory Layout on the VM

```
/opt/enterprise-bot
├── app/                 # git clone lives here
├── shared/.env          # environment file sourced by service
└── logs/                # Writable log directory (optional)
```

## 3. Clone & Build

```bash
sudo mkdir -p /opt/enterprise-bot
sudo chown $USER:$USER /opt/enterprise-bot
cd /opt/enterprise-bot

git clone https://github.com/<owner>/uss-enterprise-photo-contest-bot.git app
cd app
npm install
npm run build --workspace=bot
```

## 4. Environment File (`/opt/enterprise-bot/.env`)

```env
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
FIREBASE_PROJECT_ID=enterprise-photo-contest-bot
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NODE_ENV=production
LOG_LEVEL=info
DISCORD_ERROR_CHANNEL_ID=1234567890123
LOG_TO_FILES=true
```

Ensure this file is owned by `root:root` and `chmod 600`.

## 5. Systemd Service

Create `/etc/systemd/system/enterprise-bot.service`:

```ini
[Unit]
Description=USS Enterprise Photo Contest Bot
After=network.target

[Service]
Type=simple
EnvironmentFile=/opt/enterprise-bot/.env
WorkingDirectory=/opt/enterprise-bot/app/bot
ExecStart=/usr/bin/npm run start --workspace=bot
Restart=on-failure
RestartSec=5s
User=enterprise
Group=enterprise

[Install]
WantedBy=multi-user.target
```

Create the `enterprise` user (non-login) and give it permission to read `/opt/enterprise-bot`.

## 6. Deployment Script

Create `/opt/enterprise-bot/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/enterprise-bot/app
cd "$APP_DIR"

git fetch origin main
if git status -s | grep -q .; then
  echo "Working tree dirty; refusing to deploy." >&2
  exit 1
fi

git checkout main
git pull origin main
npm install
npm run build --workspace=bot
sudo systemctl restart enterprise-bot.service
```

Make it executable (`chmod +x deploy.sh`).

## 7. First Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable enterprise-bot.service
sudo systemctl start enterprise-bot.service
sudo systemctl status enterprise-bot.service -n 50
```

Check logs:

```bash
journalctl -u enterprise-bot.service -f
```

## 8. Health Checks

- Run `/ping` in Discord to ensure the bot is online.
- Verify logs appear under `bot/logs/` if `LOG_TO_FILES=true`.
- Confirm the error channel receives a test alert (temporarily throw an error during dev).

## 9. Updating

Whenever new code lands:

```bash
cd /opt/enterprise-bot
./deploy.sh
```

The script pulls latest code, installs dependencies, builds the bot, and restarts the service.

## 10. Troubleshooting

| Symptom                             | Possible Fix                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `systemctl status` shows crash loop | Check `.env` for missing keys; run bot manually via `npm run start --workspace=bot`        |
| Firebase auth errors                | Ensure service account JSON matches `enterprise-photo-contest-bot` project                 |
| Discord commands missing            | Re-run `npm run commands:deploy` locally to re-register slash commands                     |
| Error alerts missing                | Confirm `DISCORD_ERROR_CHANNEL_ID` and that the bot has permission to post in that channel |

This satisfies `photo-0fc.8`: the VM deployment instructions, scripts, and monitoring hooks are ready for production rollout.

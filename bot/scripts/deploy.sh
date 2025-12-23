#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../../" && pwd)"
BOT_DIR="$APP_DIR/bot"

cd "$APP_DIR"

echo "[deploy] Fetching latest code..."
git fetch origin main

if git status --porcelain | grep -qE '^( M| M|UU|AA|DD)'; then
  echo "[deploy] Working tree has local changes; aborting." >&2
  exit 1
fi

git checkout main
git pull --ff-only origin main

echo "[deploy] Installing dependencies..."
npm install

echo "[deploy] Building bot workspace..."
npm run build --workspace=bot

echo "[deploy] Restarting systemd service..."
sudo systemctl restart enterprise-bot.service

echo "[deploy] Deployment complete."
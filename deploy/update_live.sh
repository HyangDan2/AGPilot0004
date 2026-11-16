#!/usr/bin/env bash
set -euo pipefail

# One-command live update script on Server-HQ (Raspberry Pi)
export PATH="/home/pi/.local/share/hd2lab-tools/node-v22.16.0-linux-arm64/bin:$PATH"
REPO_DIR="/var/www/services/babycare"

echo "1. Pulling latest AGPilot0004 (main)..."
cd "$REPO_DIR"
git pull origin main

echo "2. Building Frontend (Vite + React)..."
cd "$REPO_DIR/services/babycare/frontend"
npm install
npm run build

echo "3. Updating Backend dependencies..."
cd "$REPO_DIR/services/babycare/backend"
.venv/bin/pip install -q -r requirements.txt

echo "4. Restarting systemd service (hd2lab-babycare)..."
sudo systemctl restart hd2lab-babycare
sudo systemctl status hd2lab-babycare --no-pager | head -n 12

echo "✅ Live update completed! Verify at https://hd2lab.duckdns.org/babycare/"

#!/bin/bash
set -e

cd "$(dirname "$0")"

# Ensure swap exists (needed on low-RAM VMs for Next.js builds)
if [ ! -f /swapfile ]; then
  echo "==> Creating 2GB swapfile..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  # Persist across reboots
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "==> Swap created."
elif ! swapon --show | grep -q /swapfile; then
  echo "==> Activating existing swapfile..."
  sudo swapon /swapfile
fi

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Building..."
NODE_OPTIONS="--max-old-space-size=1536" npm run build

echo "==> Restarting app..."
pm2 restart csatradingcards

echo "==> Done."

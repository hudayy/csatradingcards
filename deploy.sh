#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building..."
npm run build

echo "==> Restarting app..."
pm2 restart csatradingcards

echo "==> Done."

#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "      SmartGrid Platform - Frontend Update Script          "
echo "=========================================================="

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (sudo)."
  exit 1
fi

PROJECT_ROOT=$(pwd)

echo "--- Pulling latest code changes ---"
git pull

echo "--- Building React Frontend Production Bundle ---"
cd "$PROJECT_ROOT/frontend"
npm install
NODE_OPTIONS="--max-old-space-size=1024" npm run build

echo "--- Copying built assets to Nginx web root ---"
mkdir -p /var/www/smartgrid/html
cp -r dist/* /var/www/smartgrid/html/
chown -R www-data:www-data /var/www/smartgrid/html
chmod -R 755 /var/www/smartgrid/html

echo "--- Reloading Nginx Web Server ---"
nginx -t
systemctl reload nginx

echo "=========================================================="
echo "Success: Nginx front-end assets successfully compiled."
echo "=========================================================="

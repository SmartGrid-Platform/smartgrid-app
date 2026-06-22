#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "      SmartGrid Platform - Backend Update Script           "
echo "=========================================================="

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (sudo)."
  exit 1
fi

PROJECT_ROOT=$(pwd)

echo "--- Pulling latest code changes ---"
git pull

echo "--- Re-installing dependencies ---"
cd "$PROJECT_ROOT/shared/database"
npm install

SERVICES=("auth-service" "consumer-service" "meter-service" "billing-service" "alert-service")
for SERVICE in "${SERVICES[@]}"; do
  echo "Updating dependencies for $SERVICE..."
  cd "$PROJECT_ROOT/services/$SERVICE"
  npm install
done

echo "--- Running schema migrations ---"
cd "$PROJECT_ROOT/shared/database"
npm run migrate

echo "--- Reloading services in PM2 ---"
pm2 reload all

echo "=========================================================="
echo "Success: Backend microservices successfully updated."
echo "=========================================================="

#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "      SmartGrid Platform - Database Update Script          "
echo "=========================================================="

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (sudo)."
  exit 1
fi

PROJECT_ROOT=$(pwd)

echo "--- Pulling latest code changes ---"
git pull

echo "--- Installing database dependencies ---"
cd "$PROJECT_ROOT/shared/database"
npm install

echo "--- Running database migrations ---"
npm run migrate

echo "=========================================================="
echo "Success: Database update and migration completed."
echo "=========================================================="

#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "      SmartGrid Platform - Backend Installation Script     "
echo "=========================================================="

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (sudo)."
  exit 1
fi

# 1. Interactive Prompts
echo "--- Database Server Settings ---"
read -p "Enter Database Private IP [127.0.0.1]: " DB_HOST
DB_HOST=${DB_HOST:-127.0.0.1}

read -p "Enter Database Port [3306]: " DB_PORT
DB_PORT=${DB_PORT:-3306}

read -p "Enter Database Name [smartgrid]: " DB_NAME
DB_NAME=${DB_NAME:-smartgrid}

read -p "Enter Database User [smartgrid_user]: " DB_USER
DB_USER=${DB_USER:-smartgrid_user}

read -sp "Enter Database Password [password]: " DB_PASS
echo ""
DB_PASS=${DB_PASS:-password}

echo ""
echo "--- SMTP Email Configuration ---"
read -p "Enter SMTP Host [smtp.mailtrap.io]: " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-smtp.mailtrap.io}

read -p "Enter SMTP Port [2525]: " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-2525}

read -p "Enter SMTP Username (Leave blank to simulate logs): " SMTP_USER
read -sp "Enter SMTP Password (Leave blank to simulate logs): " SMTP_PASS
echo ""

read -p "Enter Sender Email [noreply@smartgrid.com]: " SENDER_EMAIL
SENDER_EMAIL=${SENDER_EMAIL:-"noreply@smartgrid.com"}

# 2. Install Node.js (v18 LTS) and PM2
echo "--- Installing Node.js LTS (v18) ---"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "--- Installing PM2 Process Manager globally ---"
npm install -g pm2

# 3. Resolve dependencies
PROJECT_ROOT=$(pwd)
echo "--- Installing Monorepo Dependencies ---"

cd "$PROJECT_ROOT/shared/database"
npm install

SERVICES=("auth-service" "consumer-service" "meter-service" "billing-service" "alert-service")
for SERVICE in "${SERVICES[@]}"; do
  echo "Installing dependencies for services/$SERVICE..."
  cd "$PROJECT_ROOT/services/$SERVICE"
  npm install
done

# 4. Generate Random JWT Secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 5. Generate environment variables files
echo "--- Generating .env files for all microservices ---"

write_env_file() {
  local PATH_TO_ENV=$1
  cat > "$PATH_TO_ENV" <<EOF
NODE_ENV=production
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
JWT_SECRET=$JWT_SECRET
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SENDER_EMAIL=$SENDER_EMAIL
EOF
}

# Write for shared db
write_env_file "$PROJECT_ROOT/shared/database/.env"

# Write for each service
for SERVICE in "${SERVICES[@]}"; do
  write_env_file "$PROJECT_ROOT/services/$SERVICE/.env"
done

# 6. Run Database Migrations (Sequelize Sync)
echo "--- Running Database Schema Migrations ---"
cd "$PROJECT_ROOT/shared/database"
npm run migrate

# 7. Run Admin Bootstrapper
echo "--- Creating Administrator Account ---"
# Run bootstrapper interactively to set name, email, password
npm run bootstrap

# 8. Start Microservices in PM2
echo "--- Starting Microservices via PM2 ---"
pm2 delete all || true

for SERVICE in "${SERVICES[@]}"; do
  echo "Launching $SERVICE..."
  cd "$PROJECT_ROOT/services/$SERVICE"
  pm2 start server.js --name "smartgrid-$SERVICE"
done

# Save PM2 state
pm2 save
echo "--- PM2 Configuration Saved ---"

# 9. Verify Health Endpoints
echo "--- Running Health Check Endpoint Verification ---"
sleep 2

PORTS=(3001 3002 3003 3004 3005)
for i in "${!SERVICES[@]}"; do
  PORT=${PORTS[$i]}
  SERVICE=${SERVICES[$i]}
  echo "Verifying health check of $SERVICE on Port $PORT..."
  curl -s "http://localhost:$PORT/health" || echo "Warning: $SERVICE health check failed!"
done

echo "=========================================================="
echo "Success: Backend microservices successfully deployed."
echo "Use 'pm2 status' and 'pm2 logs' to monitor microservices."
echo "=========================================================="

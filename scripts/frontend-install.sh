#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "      SmartGrid Platform - Frontend Installation Script    "
echo "=========================================================="

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (sudo)."
  exit 1
fi

# 1. Interactive Prompts
echo "--- Backend Server Settings ---"
read -p "Are you using an Internal Load Balancer? (y/n) [n]: " USE_INTERNAL_ALB
USE_INTERNAL_ALB=${USE_INTERNAL_ALB:-n}

if [[ "$USE_INTERNAL_ALB" =~ ^[Yy]$ ]]; then
  read -p "Enter Internal ALB DNS Name: " INTERNAL_ALB_DNS
  if [ -z "$INTERNAL_ALB_DNS" ]; then
    echo "Error: Internal ALB DNS Name cannot be empty when using an Internal ALB."
    exit 1
  fi
else
  read -p "Enter Backend Server Private IP [127.0.0.1]: " BACKEND_IP
  BACKEND_IP=${BACKEND_IP:-127.0.0.1}
fi

# 2. Install Node.js & Nginx
echo "--- Installing Node.js LTS (v18) ---"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs nginx

# 3. Install dependencies and Build Frontend React Application
echo "--- Building React Frontend Production Bundle ---"
PROJECT_ROOT=$(pwd)
cd "$PROJECT_ROOT/frontend"

# Build production distribution
npm install
NODE_OPTIONS="--max-old-space-size=1024" npm run build

# 4. Provision assets to Nginx Root
echo "--- Copying built assets to Nginx web root ---"
mkdir -p /var/www/smartgrid/html
cp -r dist/* /var/www/smartgrid/html/
chown -R www-data:www-data /var/www/smartgrid/html
chmod -R 755 /var/www/smartgrid/html

# 5. Configure Nginx Virtual Host Configuration
echo "--- Writing Nginx reverse-proxy virtual host ---"
NGINX_CONF="/etc/nginx/sites-available/smartgrid"

if [[ "$USE_INTERNAL_ALB" =~ ^[Yy]$ ]]; then
  # Configuration targeting Internal ALB (Single proxy pass location using path-based routing in the ALB)
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name _;

    root /var/www/smartgrid/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy all API requests to the Internal ALB (Port 80)
    location /api/ {
        proxy_pass http://$INTERNAL_ALB_DNS;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
else
  # Legacy configuration proxying individual ports directly to backend private IP
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name _;

    root /var/www/smartgrid/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy to Auth Service (3001)
    location /api/auth {
        proxy_pass http://$BACKEND_IP:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Consumer Service (3002)
    location /api/consumers {
        proxy_pass http://$BACKEND_IP:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Meter Service (3003)
    location /api/meters {
        proxy_pass http://$BACKEND_IP:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Billing Service - Tariffs (3004)
    location /api/tariffs {
        proxy_pass http://$BACKEND_IP:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Billing Service - Recharges (3004)
    location /api/recharges {
        proxy_pass http://$BACKEND_IP:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Billing Service - Bills (3004)
    location /api/bills {
        proxy_pass http://$BACKEND_IP:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Alert Service - Alerts (3005)
    location /api/alerts {
        proxy_pass http://$BACKEND_IP:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Proxy to Alert Service - Inspections (3005)
    location /api/inspections {
        proxy_pass http://$BACKEND_IP:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
fi

# Activate site configuration & remove default configuration
echo "--- Activating site config ---"
ln -sf /etc/nginx/sites-available/smartgrid /etc/nginx/sites-enabled/smartgrid
rm -f /etc/nginx/sites-enabled/default || true

# Test Nginx and restart
echo "--- Restarting Nginx Web Server ---"
nginx -t
systemctl restart nginx
systemctl enable nginx

echo "=========================================================="
echo "Success: Nginx proxy and static front-end assets deployed."
echo "Access portal at: http://YOUR_FRONTEND_SERVER_IP"
echo "=========================================================="

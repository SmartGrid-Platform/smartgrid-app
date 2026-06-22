#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "      SmartGrid Platform - Database Installation Script    "
echo "=========================================================="

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (sudo)."
  exit 1
fi

# 1. Interactive Prompts
echo "--- Configuration setup ---"
read -p "Enter Database Name [smartgrid]: " DB_NAME
DB_NAME=${DB_NAME:-smartgrid}

read -p "Enter Database Username [smartgrid_user]: " DB_USER
DB_USER=${DB_USER:-smartgrid_user}

read -sp "Enter Database Password [password]: " DB_PASS
echo ""
DB_PASS=${DB_PASS:-password}

# 2. Update package list & install MySQL
echo "--- Installing MySQL Server ---"
apt-get update
apt-get install -y mysql-server

# 3. Secure MySQL installation & configure remote access (Private IP)
echo "--- Configuring MySQL network settings ---"
# Set bind-address to 0.0.0.0 to accept connections on private network interface
SED_CONF="/etc/mysql/mysql.conf.d/mysqld.cnf"
if [ -f "$SED_CONF" ]; then
  sed -i "s/bind-address.*/bind-address            = 0.0.0.0/g" "$SED_CONF"
  sed -i "s/mysqlx-bind-address.*/mysqlx-bind-address      = 0.0.0.0/g" "$SED_CONF"
else
  echo "Warning: Could not find mysqld.cnf at $SED_CONF. Please ensure MySQL is listening on private interface manually."
fi

# Restart MySQL to apply bind changes
echo "--- Restarting MySQL Service ---"
systemctl restart mysql
systemctl enable mysql

# 4. Create Database and User with private network permissions
echo "--- Configuring MySQL Schema & User Permissions ---"
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
EOF

echo "=========================================================="
echo "Success: Database server installed and configured."
echo "Connection details:"
echo "  Database Name: $DB_NAME"
echo "  Username:      $DB_USER"
echo "  Password:      [HIDDEN]"
echo "  Bind Interface: 0.0.0.0 (Port 3306)"
echo "Please make sure to open Port 3306 on your Security Groups."
echo "=========================================================="

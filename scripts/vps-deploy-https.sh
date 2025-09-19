#!/bin/bash

# Complete HTTPS VPS Deployment Script for amritanshdairy.com
# Run this script on your Hostinger VPS to deploy with HTTPS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "🚀 Amrit Dairy HTTPS VPS Deployment"
echo "===================================="
echo -e "${NC}"

# Configuration
APP_NAME="amrit-dairy"
APP_DIR="/var/www/$APP_NAME"
DOMAIN="amritanshdairy.com"
NODE_PORT=3000
NGINX_SITE="/etc/nginx/sites-available/$DOMAIN"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run this script as root (use sudo)${NC}"
    exit 1
fi

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install Node.js 20 (LTS)
echo -e "${BLUE}📦 Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | cut -d'v' -f2) -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Verify Node.js version
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Install PM2 globally
echo -e "${BLUE}📦 Installing PM2...${NC}"
npm install -g pm2

# Install Nginx
echo -e "${BLUE}📦 Installing Nginx...${NC}"
apt install -y nginx

# Install SSL tools
echo -e "${BLUE}📦 Installing SSL tools...${NC}"
apt install -y certbot python3-certbot-nginx

# Install PostgreSQL client (if needed)
echo -e "${BLUE}📦 Installing PostgreSQL client...${NC}"
apt install -y postgresql-client

# Create application directory
echo -e "${BLUE}📁 Setting up application directory...${NC}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# If application files exist, backup them
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📋 Backing up existing application...${NC}"
    mkdir -p /tmp/backup-$(date +%Y%m%d_%H%M%S)
    cp -r "$APP_DIR"/* /tmp/backup-$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
fi

# Check if build files are in current directory or need to be extracted
if [ ! -f "package.json" ]; then
    if [ -f "/tmp/amrit-dairy.tar.gz" ]; then
        echo -e "${BLUE}📦 Extracting application files...${NC}"
        tar -xzf /tmp/amrit-dairy.tar.gz -C "$APP_DIR"
    else
        echo -e "${RED}❌ Application files not found!${NC}"
        echo "Please upload your build files to $APP_DIR or /tmp/amrit-dairy.tar.gz"
        exit 1
    fi
fi

# Install dependencies
echo -e "${BLUE}📦 Installing application dependencies...${NC}"
npm install --production

# Create environment file from production template
echo -e "${BLUE}⚙️ Creating environment configuration...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.production.template" ]; then
        echo -e "${GREEN}✅ Using production environment template${NC}"
        cp .env.production.template .env
    else
        echo -e "${YELLOW}⚠️ Creating basic environment template (update from VPS-ENVIRONMENT-SETUP-GUIDE.md)${NC}"
        cat > .env << 'EOF'
# =====================================================================
# PRODUCTION ENVIRONMENT VARIABLES FOR amritanshdairy.com VPS DEPLOYMENT  
# =====================================================================
# 🔐 CRITICAL: Replace ALL placeholder values with actual credentials
# Refer to VPS-ENVIRONMENT-SETUP-GUIDE.md for detailed setup instructions
# =====================================================================

NODE_ENV=production
DOMAIN=amritanshdairy.com
HOST=0.0.0.0
PORT=3000

# Database - REQUIRED (Get from Hostinger or Neon.tech)
DATABASE_URL=postgresql://CHANGE_USERNAME:CHANGE_PASSWORD@CHANGE_HOST:5432/CHANGE_DATABASE?sslmode=require

# Security - REQUIRED (Generate with: openssl rand -base64 32)
SESSION_SECRET=CHANGE_THIS_TO_A_SECURE_32_CHAR_SECRET_GENERATED_WITH_OPENSSL

# Email - REQUIRED (Gmail SMTP with app password)
GMAIL_USER=CHANGE_TO_YOUR_EMAIL@gmail.com
GMAIL_APP_PASSWORD=CHANGE_TO_YOUR_16_CHAR_APP_PASSWORD

# Payments - REQUIRED (Razorpay live keys for production)
RAZORPAY_KEY_ID=rzp_live_CHANGE_TO_YOUR_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=CHANGE_TO_YOUR_RAZORPAY_SECRET_KEY

# Admin & SSL
ADMIN_EMAIL=admin@amritanshdairy.com
ADMIN_PASSWORD=CHANGE_THIS_TO_SECURE_ADMIN_PASSWORD

# Business Configuration
BUSINESS_NAME=Amrit Dairy
BUSINESS_ADDRESS=CHANGE_TO_YOUR_COMPLETE_BUSINESS_ADDRESS
BUSINESS_PHONE=+91-CHANGE_TO_YOUR_PHONE_NUMBER
SUPPORT_EMAIL=support@amritanshdairy.com
EOF
    fi
    
    echo -e "${YELLOW}🔐 CRITICAL SECURITY NOTICE:${NC}"
    echo -e "${RED}   ❌ The .env file contains placeholder values that MUST be updated!${NC}"
    echo -e "${YELLOW}   📖 Follow VPS-ENVIRONMENT-SETUP-GUIDE.md for detailed setup instructions${NC}"
    echo -e "${YELLOW}   🔧 Edit with: nano $APP_DIR/.env${NC}"
else
    echo -e "${GREEN}✅ Environment file already exists${NC}"
fi

# Environment validation
echo -e "${BLUE}🔍 Validating environment configuration...${NC}"
if command -v node &> /dev/null; then
    # Check if environment validation is available
    if [ -f "server/envValidation.ts" ]; then
        echo -e "${BLUE}   Running environment validation checks...${NC}"
        npx tsx server/envValidation.ts || {
            echo -e "${YELLOW}⚠️ Environment validation warnings detected${NC}"
            echo -e "${YELLOW}   Some optional environment variables may not be configured${NC}"
        }
    else
        echo -e "${YELLOW}⚠️ Environment validation not available in this build${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Node.js not available for environment validation${NC}"
fi

# Set proper permissions
echo -e "${BLUE}🔐 Setting file permissions...${NC}"
chown -R www-data:www-data "$APP_DIR"
chmod 600 "$APP_DIR/.env"
chmod 755 "$APP_DIR"

# Create systemd service (alternative to PM2)
echo -e "${BLUE}⚙️ Creating systemd service...${NC}"
cat > /etc/systemd/system/amrit-dairy.service << EOF
[Unit]
Description=Amrit Dairy Application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node vps-index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=amrit-dairy

[Install]
WantedBy=multi-user.target
EOF

# If vps-index.js doesn't exist, use regular index.js or create it
if [ ! -f "vps-index.js" ] && [ -f "index.js" ]; then
    cp index.js vps-index.js
elif [ ! -f "vps-index.js" ] && [ -f "server/index.js" ]; then
    cp server/index.js vps-index.js
elif [ ! -f "vps-index.js" ]; then
    echo -e "${YELLOW}⚠️ No main application file found. Please ensure you have the correct build.${NC}"
fi

# Copy Nginx configuration
echo -e "${BLUE}🌐 Configuring Nginx...${NC}"
if [ -f "scripts/nginx-config.conf" ]; then
    cp scripts/nginx-config.conf "$NGINX_SITE"
else
    echo -e "${YELLOW}⚠️ Nginx config not found in build, using basic configuration...${NC}"
    # Create basic Nginx configuration
    cat > "$NGINX_SITE" << 'EOF'
server {
    listen 80;
    server_name amritanshdairy.com www.amritanshdairy.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name amritanshdairy.com www.amritanshdairy.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
fi

# Enable Nginx site
echo -e "${BLUE}🔗 Enabling Nginx site...${NC}"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo -e "${BLUE}🧪 Testing Nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration error!${NC}"
    exit 1
fi

# Start and enable Nginx
systemctl restart nginx
systemctl enable nginx

# Create public directory for error pages
mkdir -p "$APP_DIR/public"
cat > "$APP_DIR/public/50x.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Service Temporarily Unavailable</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <h1>Service Temporarily Unavailable</h1>
    <p>We're working to restore service. Please try again in a few moments.</p>
</body>
</html>
EOF

# Setup database
echo -e "${BLUE}💾 Setting up database schema...${NC}"
if command -v npm &> /dev/null && [ -f "package.json" ]; then
    npm run db:push || echo -e "${YELLOW}⚠️ Database setup failed - update your DATABASE_URL in .env${NC}"
fi

# Start application with systemd
echo -e "${BLUE}🚀 Starting application...${NC}"
systemctl daemon-reload
systemctl enable amrit-dairy
systemctl start amrit-dairy

# Wait a moment for the app to start
sleep 5

# Check if application is running
if systemctl is-active --quiet amrit-dairy; then
    echo -e "${GREEN}✅ Application is running${NC}"
else
    echo -e "${RED}❌ Application failed to start${NC}"
    echo "Check logs: journalctl -u amrit-dairy -f"
    # Try with PM2 as fallback
    echo -e "${YELLOW}⚠️ Trying PM2 as fallback...${NC}"
    sudo -u www-data pm2 start vps-index.js --name amrit-dairy
    sudo -u www-data pm2 startup
    sudo -u www-data pm2 save
fi

# Setup firewall
echo -e "${BLUE}🔥 Configuring firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22   # SSH
ufw allow 80   # HTTP
ufw allow 443  # HTTPS
ufw --force enable

echo -e "${GREEN}✅ Firewall configured${NC}"

# Test HTTP connectivity before SSL
echo -e "${BLUE}🌐 Testing HTTP connectivity...${NC}"
sleep 5
if curl -s --connect-timeout 10 "http://$DOMAIN/api/health" > /dev/null; then
    echo -e "${GREEN}✅ HTTP connectivity working${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP connectivity test failed - app might still be starting${NC}"
fi

echo ""
echo -e "${PURPLE}📋 Deployment Summary${NC}"
echo "====================="
echo -e "${GREEN}✅ System packages updated${NC}"
echo -e "${GREEN}✅ Node.js $(node -v) installed${NC}"
echo -e "${GREEN}✅ Application deployed to $APP_DIR${NC}"
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo -e "${GREEN}✅ Nginx configured${NC}"
echo -e "${GREEN}✅ Application service configured${NC}"
echo -e "${GREEN}✅ Firewall configured${NC}"
echo ""
echo -e "${BLUE}🔐 Next Steps for HTTPS:${NC}"
echo "1. Update environment variables in: $APP_DIR/.env"
echo "2. Restart the application: systemctl restart amrit-dairy"
echo "3. Run SSL setup: ./ssl-setup.sh"
echo ""
echo -e "${YELLOW}⚠️ CRITICAL: Update your .env file with real credentials!${NC}"
echo ""
echo -e "${BLUE}📊 Management Commands:${NC}"
echo "• Check app status: systemctl status amrit-dairy"
echo "• View app logs: journalctl -u amrit-dairy -f"
echo "• Check Nginx: systemctl status nginx"
echo "• View Nginx logs: tail -f /var/log/nginx/error.log"
echo ""
echo -e "${BLUE}🔗 Test URLs (after SSL setup):${NC}"
echo "• Website: https://$DOMAIN"
echo "• API Health: https://$DOMAIN/api/health"
echo "• Admin Panel: https://$DOMAIN/admin/login"
echo ""
echo -e "${GREEN}🎉 Basic deployment complete! Run SSL setup next.${NC}"
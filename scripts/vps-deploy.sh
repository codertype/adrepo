#!/bin/bash

echo "🚀 Amrit Dairy VPS Deployment Script for amritanshdairy.com"
echo "=================================================="

# Check for build directory
if [ ! -d "dist" ]; then
    echo "❌ Build directory 'dist' not found!"
    echo "📦 Please run './scripts/vps-build.sh' first to create the build"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script as root (use sudo)"
    exit 1
fi

# Variables
APP_NAME="amrit-dairy"
APP_DIR="/var/www/$APP_NAME"
DOMAIN="amritanshdairy.com"
NODE_VERSION="18"

echo "📋 Configuration:"
echo "   Domain: $DOMAIN"
echo "   App Directory: $APP_DIR"
echo "   Node Version: $NODE_VERSION"
echo "   Build Source: $(pwd)/dist"
echo ""

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Create app directory and copy built files
echo "📁 Creating application directory..."
mkdir -p $APP_DIR

echo "📦 Copying built application files..."
cp -r dist/* $APP_DIR/
chmod +x $APP_DIR/vps-index.js

# Change to app directory
cd $APP_DIR

# Install dependencies including devDependencies for database setup
echo "📦 Installing application dependencies..."
npm install

# Setup database schema
echo "🗄️ Setting up database schema..."
if [ -f .env ]; then
  echo "📋 Pushing database schema to production database..."
  npm run db:push
  echo "✅ Database schema synchronized"
else
  echo "⚠️ No .env file found - database setup skipped"
  echo "   Create .env file and run 'npm run db:push' manually after deployment"
fi

# Remove devDependencies after database setup
echo "🧹 Removing development dependencies..."
npm install --production

# Create environment file template
echo "📝 Creating environment file template..."
if [ ! -f .env ]; then
    cat > .env << EOF
# IMPORTANT: Update these with your actual values before starting the application
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
NODE_ENV=production
PORT=3000
DOMAIN=$DOMAIN
HOST=0.0.0.0

# SECURITY: Set a strong admin password for admin operations
ADMIN_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD

# Email configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# Payment configuration
RAZORPAY_KEY_ID=rzp_live_your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret_key

# Session security
SESSION_SECRET=CHANGE_THIS_TO_RANDOM_STRING

# Replit auth (optional - for development)
# REPLIT_DOMAINS=$DOMAIN
# REPL_ID=your-repl-id
EOF
    echo "⚠️  Created .env template - MUST UPDATE WITH REAL VALUES before starting app!"
    echo "📝 Edit $APP_DIR/.env with your actual database, email, and payment credentials"
    echo "🔐 CRITICAL: Change ADMIN_PASSWORD and SESSION_SECRET to secure random values!"
else
    echo "✅ .env file already exists"
fi

# Setup Nginx configuration
echo "🔧 Configuring Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
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
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t
systemctl restart nginx
systemctl enable nginx

# Setup firewall
echo "🔒 Configuring firewall..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# Start application with PM2
echo "🚀 Starting application..."
pm2 start vps-index.js --name $APP_NAME
pm2 startup
pm2 save

# Setup SSL certificate
echo "🔐 Setting up SSL certificate..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is now running at:"
echo "   https://$DOMAIN"
echo ""
echo "📊 Useful commands:"
echo "   pm2 status                 - Check application status"
echo "   pm2 logs $APP_NAME         - View application logs"
echo "   pm2 restart $APP_NAME      - Restart application"
echo "   systemctl status nginx     - Check Nginx status"
echo "   certbot renew --dry-run    - Test SSL renewal"
echo ""
echo "🔧 Configuration files:"
echo "   App: $APP_DIR"
echo "   Nginx: /etc/nginx/sites-available/$DOMAIN"
echo "   Environment: $APP_DIR/.env"
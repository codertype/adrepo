#!/bin/bash

# SSL Certificate Setup Script for amritanshdairy.com
# Run this script on your Hostinger VPS after Nginx is configured

set -e  # Exit on any error

echo "🔐 SSL Certificate Setup for amritanshdairy.com"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run this script as root (use sudo)${NC}"
    exit 1
fi

# Domain configuration
DOMAIN="amritanshdairy.com"
WWW_DOMAIN="www.amritanshdairy.com"
EMAIL="admin@amritanshdairy.com"  # Update this to your actual email

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Domain: $DOMAIN"
echo "   WWW Domain: $WWW_DOMAIN"
echo "   Email: $EMAIL"
echo ""

# Check if Nginx is installed and running
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx is not installed. Installing...${NC}"
    apt update
    apt install -y nginx
fi

if ! systemctl is-active --quiet nginx; then
    echo -e "${YELLOW}⚠️ Nginx is not running. Starting...${NC}"
    systemctl start nginx
    systemctl enable nginx
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${BLUE}📦 Installing Certbot...${NC}"
    apt update
    apt install -y certbot python3-certbot-nginx
fi

# Backup existing Nginx configuration
NGINX_SITE="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$NGINX_SITE" ]; then
    echo -e "${YELLOW}📋 Backing up existing Nginx configuration...${NC}"
    cp "$NGINX_SITE" "$NGINX_SITE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Test Nginx configuration
echo -e "${BLUE}🧪 Testing Nginx configuration...${NC}"
if ! nginx -t; then
    echo -e "${RED}❌ Nginx configuration test failed!${NC}"
    echo "Please check your Nginx configuration and try again."
    exit 1
fi

# Reload Nginx to apply any configuration changes
echo -e "${BLUE}🔄 Reloading Nginx...${NC}"
systemctl reload nginx

# Check if domain is accessible (basic connectivity test)
echo -e "${BLUE}🌐 Checking domain accessibility...${NC}"
if ! curl -s --connect-timeout 10 "http://$DOMAIN/api/health" > /dev/null; then
    echo -e "${YELLOW}⚠️ Warning: Domain may not be properly configured or app not running${NC}"
    echo "   Make sure your DNS points to this server and the app is running on port 3000"
    echo "   Continuing with SSL setup..."
fi

# Obtain SSL certificate
echo -e "${GREEN}🔐 Obtaining SSL certificate from Let's Encrypt...${NC}"
echo "This may take a few moments..."

# Run certbot with nginx plugin
if certbot --nginx \
    -d "$DOMAIN" \
    -d "$WWW_DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --redirect \
    --non-interactive; then
    
    echo -e "${GREEN}✅ SSL certificate installed successfully!${NC}"
    
    # Test SSL configuration
    echo -e "${BLUE}🧪 Testing SSL configuration...${NC}"
    if nginx -t; then
        systemctl reload nginx
        echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
    else
        echo -e "${RED}❌ Nginx configuration error after SSL setup${NC}"
        exit 1
    fi
    
    # Test HTTPS connectivity
    echo -e "${BLUE}🌐 Testing HTTPS connectivity...${NC}"
    if curl -s --connect-timeout 10 "https://$DOMAIN/api/health" > /dev/null; then
        echo -e "${GREEN}✅ HTTPS is working correctly${NC}"
    else
        echo -e "${YELLOW}⚠️ HTTPS test failed - check if your app is running${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 SSL Setup Complete!${NC}"
    echo -e "${GREEN}===================${NC}"
    echo "✅ SSL certificate installed"
    echo "✅ HTTPS redirect configured"
    echo "✅ Security headers enabled"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Test your site: https://$DOMAIN"
    echo "2. Verify SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
    echo "3. Check auto-renewal: certbot renew --dry-run"
    echo ""
    echo -e "${YELLOW}💡 Certificate will auto-renew every 90 days${NC}"
    
else
    echo -e "${RED}❌ SSL certificate installation failed!${NC}"
    echo ""
    echo -e "${YELLOW}Possible solutions:${NC}"
    echo "1. Make sure your domain DNS points to this server"
    echo "2. Check if port 80 and 443 are open in firewall"
    echo "3. Verify your email address is correct"
    echo "4. Make sure the application is running"
    echo ""
    echo -e "${BLUE}Debug information:${NC}"
    echo "Domain: $DOMAIN"
    echo "IP Address: $(curl -s ifconfig.me 2>/dev/null || echo 'Could not detect')"
    echo "Nginx status: $(systemctl is-active nginx)"
    echo ""
    exit 1
fi

# Set up automatic renewal
echo -e "${BLUE}⚙️ Setting up automatic SSL renewal...${NC}"

# Add cron job if it doesn't exist
CRON_JOB="0 12 * * * /usr/bin/certbot renew --quiet --nginx"
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}✅ Automatic renewal cron job added${NC}"
else
    echo -e "${YELLOW}ℹ️ Automatic renewal already configured${NC}"
fi

# Final verification
echo ""
echo -e "${GREEN}🔍 Final Verification${NC}"
echo "=================="

# Test certificate
echo "Certificate info:"
certbot certificates | grep -A 5 "$DOMAIN" || echo "Certificate details not found"

# Test HTTP to HTTPS redirect
echo ""
echo "Testing HTTP to HTTPS redirect..."
HTTP_RESPONSE=$(curl -s -I "http://$DOMAIN" | head -n 1 || echo "Connection failed")
echo "HTTP Response: $HTTP_RESPONSE"

# Test HTTPS
echo ""
echo "Testing HTTPS..."
HTTPS_RESPONSE=$(curl -s -I "https://$DOMAIN" | head -n 1 || echo "Connection failed")
echo "HTTPS Response: $HTTPS_RESPONSE"

echo ""
echo -e "${GREEN}🎊 SSL Setup Complete for $DOMAIN!${NC}"
echo -e "${BLUE}Your site should now be accessible at: https://$DOMAIN${NC}"
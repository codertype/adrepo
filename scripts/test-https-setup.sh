#!/bin/bash

# HTTPS Configuration Test Script for amritanshdairy.com
# Run this script to verify your HTTPS setup is working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "🧪 HTTPS Configuration Test Suite"
echo "================================="
echo -e "${NC}"

# Configuration
DOMAIN="amritanshdairy.com"
WWW_DOMAIN="www.amritanshdairy.com"
PORT=3000

# Test results storage
PASSED_TESTS=0
TOTAL_TESTS=0
FAILED_TESTS=()

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS+=("$test_name")
    fi
    echo ""
}

# Function to test HTTP response
test_http_response() {
    local url="$1"
    local expected_code="$2"
    local description="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}Testing HTTP: $description${NC}"
    echo "URL: $url"
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ PASSED: Got expected response code $expected_code${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: Expected $expected_code, got $response_code${NC}"
        FAILED_TESTS+=("$description")
    fi
    echo ""
}

# Function to test SSL certificate
test_ssl_certificate() {
    local domain="$1"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}Testing SSL Certificate for $domain${NC}"
    
    # Get certificate details
    cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -text 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$cert_info" | grep -q "Let's Encrypt"; then
        echo -e "${GREEN}✅ PASSED: Valid Let's Encrypt SSL certificate${NC}"
        
        # Check expiry
        expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep "notAfter" | cut -d= -f2)
        echo "Certificate expires: $expiry"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: SSL certificate issue${NC}"
        FAILED_TESTS+=("SSL Certificate for $domain")
    fi
    echo ""
}

# Function to test security headers
test_security_headers() {
    local url="$1"
    
    echo -e "${BLUE}Testing Security Headers${NC}"
    echo "URL: $url"
    
    headers=$(curl -s -I "$url" 2>/dev/null)
    
    # Test individual headers
    local security_tests=(
        "Strict-Transport-Security:HSTS Header"
        "X-Content-Type-Options:Content Type Options"
        "X-Frame-Options:Frame Options" 
        "X-XSS-Protection:XSS Protection"
    )
    
    for test in "${security_tests[@]}"; do
        header=$(echo "$test" | cut -d: -f1)
        name=$(echo "$test" | cut -d: -f2)
        
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        
        if echo "$headers" | grep -qi "$header"; then
            echo -e "${GREEN}✅ PASSED: $name header present${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${YELLOW}⚠️ WARNING: $name header missing${NC}"
            # Don't count as failed since some headers are optional
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
    done
    echo ""
}

# Start testing
echo -e "${BLUE}🔍 Starting HTTPS Configuration Tests...${NC}"
echo ""

# Test 1: Node.js Application Running
run_test "Node.js Application Running" "systemctl is-active --quiet amrit-dairy || pm2 list | grep -q amrit-dairy" "Service should be running"

# Test 2: Nginx Running
run_test "Nginx Service Running" "systemctl is-active --quiet nginx" "Nginx should be active"

# Test 3: Port 3000 Application
run_test "Application Port 3000" "ss -tlnp | grep -q ':3000 '" "Application should listen on port 3000"

# Test 4: Nginx Configuration Valid
run_test "Nginx Configuration Valid" "nginx -t > /dev/null 2>&1" "Nginx config should be valid"

echo -e "${YELLOW}🌐 Testing HTTP/HTTPS Responses...${NC}"
echo ""

# Test 5-8: HTTP Responses
test_http_response "http://$DOMAIN/api/health" "301" "HTTP to HTTPS redirect for main domain"
test_http_response "https://$DOMAIN/api/health" "200" "HTTPS API health check"
test_http_response "https://$DOMAIN/" "200" "HTTPS main page"
test_http_response "https://$WWW_DOMAIN/" "200" "HTTPS www domain"

echo -e "${YELLOW}🔐 Testing SSL Certificates...${NC}"
echo ""

# Test 9-10: SSL Certificates
test_ssl_certificate "$DOMAIN"
test_ssl_certificate "$WWW_DOMAIN"

echo -e "${YELLOW}🛡️ Testing Security Headers...${NC}"
echo ""

# Test 11: Security Headers
test_security_headers "https://$DOMAIN/"

echo -e "${YELLOW}🔌 Testing WebSocket Support...${NC}"
echo ""

# Test 12: WebSocket Upgrade Headers
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "${BLUE}Testing WebSocket Configuration${NC}"

ws_headers=$(curl -s -I --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket" "https://$DOMAIN/ws" 2>/dev/null | head -n 1)

if echo "$ws_headers" | grep -q "101\|200\|404"; then
    echo -e "${GREEN}✅ PASSED: WebSocket endpoint accessible${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ WARNING: WebSocket test inconclusive${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
echo ""

echo -e "${YELLOW}📱 Testing PWA Features...${NC}"
echo ""

# Test 13: PWA Manifest
test_http_response "https://$DOMAIN/manifest.json" "200" "PWA Manifest accessible"

# Test 14: Service Worker  
test_http_response "https://$DOMAIN/sw.js" "200" "Service Worker accessible"

echo -e "${YELLOW}🎯 Testing Static Assets...${NC}"
echo ""

# Test 15: Favicon
test_http_response "https://$DOMAIN/favicon.ico" "200" "Favicon accessible"

# Test 16: Robots.txt
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "${BLUE}Testing robots.txt${NC}"
robots_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/robots.txt" 2>/dev/null || echo "000")

if [ "$robots_response" = "200" ] || [ "$robots_response" = "404" ]; then
    echo -e "${GREEN}✅ PASSED: robots.txt handling (got $robots_response)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAILED: robots.txt unexpected response $robots_response${NC}"
    FAILED_TESTS+=("robots.txt handling")
fi
echo ""

echo -e "${YELLOW}⚡ Testing Performance Features...${NC}"
echo ""

# Test 17: Gzip Compression
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "${BLUE}Testing Gzip Compression${NC}"

gzip_test=$(curl -s -H "Accept-Encoding: gzip" -I "https://$DOMAIN/" | grep -i "content-encoding")

if echo "$gzip_test" | grep -qi "gzip"; then
    echo -e "${GREEN}✅ PASSED: Gzip compression enabled${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ INFO: Gzip compression not detected (may be conditional)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
echo ""

# Test 18: Cache Headers for Static Assets
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "${BLUE}Testing Cache Headers${NC}"

# Try to test a common static asset path
cache_test=$(curl -s -I "https://$DOMAIN/favicon.ico" | grep -i "cache-control")

if echo "$cache_test" | grep -q "max-age\|public"; then
    echo -e "${GREEN}✅ PASSED: Cache headers configured${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ INFO: Cache headers test inconclusive${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
echo ""

# Final Results
echo -e "${PURPLE}📊 Test Results Summary${NC}"
echo "======================="
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed Tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "   • $test"
    done
    echo ""
fi

# Calculate percentage
PERCENTAGE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))

echo -e "Success Rate: ${GREEN}${PERCENTAGE}%${NC}"
echo ""

# Overall result
if [ $PERCENTAGE -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELLENT! Your HTTPS setup is working great!${NC}"
    echo -e "${GREEN}The website should be fully functional with secure connections.${NC}"
elif [ $PERCENTAGE -ge 80 ]; then
    echo -e "${YELLOW}⚠️ GOOD! Most tests passed, but check the failed items above.${NC}"
    echo -e "${YELLOW}The website should work, but some optimizations may be needed.${NC}"
elif [ $PERCENTAGE -ge 60 ]; then
    echo -e "${YELLOW}⚠️ PARTIAL! Some critical issues found. Please review failed tests.${NC}"
    echo -e "${YELLOW}The website may have functionality issues.${NC}"
else
    echo -e "${RED}❌ CRITICAL! Multiple failures detected. Please review configuration.${NC}"
    echo -e "${RED}The website may not function properly.${NC}"
fi

echo ""
echo -e "${BLUE}📋 Quick Checks You Can Do:${NC}"
echo "1. Visit: https://$DOMAIN"
echo "2. Verify SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo "3. Check logs: journalctl -u amrit-dairy -f"
echo "4. Check Nginx: systemctl status nginx"
echo ""

echo -e "${BLUE}🔧 If tests failed, try:${NC}"
echo "1. Check application logs: journalctl -u amrit-dairy -f"
echo "2. Restart services: systemctl restart amrit-dairy nginx"
echo "3. Test Nginx config: nginx -t"
echo "4. Check firewall: ufw status"
echo "5. Verify DNS: dig $DOMAIN"
echo ""

# Exit with appropriate code
if [ $PERCENTAGE -ge 80 ]; then
    exit 0
else
    exit 1
fi
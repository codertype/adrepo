#!/bin/bash
echo "=== Testing amritanshdairy.com ==="
echo ""

# Test homepage
echo "1. Testing homepage:"
status=$(curl -s -o /dev/null -w "%{http_code}" https://amritanshdairy.com/)
if [ "$status" = "200" ]; then
    echo "   ✅ Homepage loads (HTTP $status)"
else
    echo "   ❌ Homepage error (HTTP $status)"
fi

# Test main JS file
echo "2. Testing main JS file:"
content=$(curl -s https://amritanshdairy.com/assets/index-DLrtCax_.js | head -c 50)
if [[ "$content" == *"import"* ]] || [[ "$content" == *"function"* ]] || [[ "$content" == *"var"* ]]; then
    echo "   ✅ Main JS file loads correctly"
else
    echo "   ❌ Main JS file error"
fi

# Test landing JS
echo "3. Testing landing JS file:"
content=$(curl -s https://amritanshdairy.com/assets/landing-sO7MY4_R.js | head -c 50)
if [[ "$content" == *"import"* ]] || [[ "$content" == *"function"* ]]; then
    echo "   ✅ Landing JS loads correctly"
else
    echo "   ❌ Landing JS error"
fi

# Test API
echo "4. Testing API endpoints:"
api_status=$(curl -s -o /dev/null -w "%{http_code}" https://amritanshdairy.com/api/products)
if [ "$api_status" = "200" ]; then
    echo "   ✅ API working (HTTP $api_status)"
else
    echo "   ❌ API error (HTTP $api_status)"
fi

# Test service worker
echo "5. Testing service worker:"
sw_content=$(curl -s https://amritanshdairy.com/sw.js | head -c 30)
if [[ "$sw_content" == *"self"* ]] || [[ "$sw_content" == *"Service"* ]] || [[ "$sw_content" == *"cache"* ]]; then
    echo "   ✅ Service worker loads"
else
    echo "   ❌ Service worker error"
fi

# Check for any HTML errors
echo "6. Testing for HTML error responses in JS files:"
test_file=$(curl -s https://amritanshdairy.com/assets/badge-GkTsBtYc.js | head -c 100)
if [[ "$test_file" == *"<!DOCTYPE"* ]] || [[ "$test_file" == *"<html"* ]]; then
    echo "   ❌ JS files returning HTML (error pages)"
else
    echo "   ✅ JS files returning JavaScript content"
fi

echo ""
echo "=== Test Complete ==="

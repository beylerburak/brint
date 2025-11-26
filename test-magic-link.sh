#!/bin/bash

# Magic Link Test Script
# Usage: ./test-magic-link.sh

API_URL="http://localhost:3000"
EMAIL="test-$(date +%s)@example.com"

echo "🧪 Testing Magic Link Flow..."
echo ""

# Step 1: Request magic link
echo "1️⃣ Requesting magic link for: $EMAIL"
RESPONSE=$(curl -s -X POST "$API_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}")

echo "Response: $RESPONSE"
echo ""

# Step 2: Check server logs for the magic link URL
echo "2️⃣ Check your server terminal for the magic link URL"
echo "   It should look like: http://localhost:3000/auth/magic-link/verify?token=..."
echo ""
echo "3️⃣ Copy the token from the URL and test it manually in Swagger or browser"
echo ""

# Alternative: If you want to test programmatically, you'd need to parse the logs
# For now, manual testing is easier

echo "✅ Magic link request completed!"
echo "   Next: Use the token from server logs to verify the magic link"


#!/bin/bash

# Quick endpoint verification script
# Verifies both deposit endpoints are available and correctly configured

echo "🧪 TESTING DUAL-ENDPOINT DEPOSIT SYSTEM"
echo "======================================"

BACKEND_URL="${1:-https://shadowpay-backend-production.up.railway.app}"
LINK_ID="test-link-$(date +%s)"

echo ""
echo "Backend URL: $BACKEND_URL"
echo "Test Link ID: $LINK_ID"
echo ""

# Test 1: Primary endpoint exists
echo "📝 Test 1: Primary endpoint /api/deposit/record"
echo "   Testing endpoint availability..."

curl -s -X POST "$BACKEND_URL/api/deposit/record" \
  -H "Content-Type: application/json" \
  -d '{"linkId":"nonexistent","publicKey":"test","transactionHash":"test"}' \
  -w "\n   Status: %{http_code}\n" | head -1

echo ""

# Test 2: Fallback endpoint exists
echo "📝 Test 2: Fallback endpoint /api/deposit/verify-and-record"
echo "   Testing endpoint availability..."

curl -s -X POST "$BACKEND_URL/api/deposit/verify-and-record" \
  -H "Content-Type: application/json" \
  -d '{"linkId":"nonexistent","transactionHash":"test","publicKey":"test"}' \
  -w "\n   Status: %{http_code}\n" | head -1

echo ""

# Test 3: Both endpoints handle missing linkId
echo "📝 Test 3: Validation (missing linkId)"
echo "   Primary endpoint:"
curl -s -X POST "$BACKEND_URL/api/deposit/record" \
  -H "Content-Type: application/json" \
  -d '{"amount":"0.01"}' 2>&1 | grep -o '"error":"[^"]*"'

echo ""
echo "   Fallback endpoint:"
curl -s -X POST "$BACKEND_URL/api/deposit/verify-and-record" \
  -H "Content-Type: application/json" \
  -d '{"transactionHash":"test"}' 2>&1 | grep -o '"error":"[^"]*"'

echo ""
echo "✅ Endpoint verification complete!"
echo ""
echo "💡 Both endpoints should be available and respond with proper validation errors."
echo "💡 If fallback returns 404, it means production hasn't been redeployed yet."
echo "💡 Frontend will automatically detect and retry with fallback."

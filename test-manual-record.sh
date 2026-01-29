#!/bin/bash

# Test Manual Deposit Recording
# This demonstrates how to use the manual-record endpoint when deposits fail to record automatically

BACKEND="https://shadowpay-backend-production.up.railway.app"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Manual Deposit Recording Test ===${NC}\n"

# Check if we have link ID and tx hash arguments
if [ $# -lt 2 ]; then
  echo -e "${RED}Usage: $0 <linkId> <transactionHash>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 f2da03a1a93a2e572a57b47b6b84fc42 3abcd1234..."
  echo ""
  echo "Steps to get these values:"
  echo "1. LinkId: From the URL when you created the link"
  echo "2. TransactionHash: From Solscan after your deposit"
  echo "   - Go to https://solscan.io/ and search your wallet"
  echo "   - Find the recent Privacy Cash transaction"
  echo "   - Copy the transaction hash"
  exit 1
fi

LINK_ID="$1"
TX_HASH="$2"

echo -e "${YELLOW}Recording deposit manually...${NC}"
echo "Link ID: $LINK_ID"
echo "Tx Hash: ${TX_HASH:0:20}..."
echo ""

# Call the manual-record endpoint
RESPONSE=$(curl -s -X POST "$BACKEND/api/deposit/manual-record" \
  -H "Content-Type: application/json" \
  -d "{
    \"linkId\": \"$LINK_ID\",
    \"transactionHash\": \"$TX_HASH\"
  }")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo -e "${GREEN}✅ Deposit recorded successfully!${NC}"
  echo "You can now claim this link."
else
  echo ""
  echo -e "${RED}❌ Failed to record deposit${NC}"
  echo "Check the response above for details."
fi

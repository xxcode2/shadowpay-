#!/bin/bash

# 🔧 Quick Diagnostic Script for ShadowPay Deposit Issues
# Run this to check your OPERATOR_SECRET_KEY format

echo "🔍 ShadowPay Deposit Diagnostic Check"
echo "════════════════════════════════════════"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if OPERATOR_SECRET_KEY is set
if [ -z "$OPERATOR_SECRET_KEY" ]; then
    echo "⚠️  OPERATOR_SECRET_KEY not set in current shell"
    echo ""
    echo "   This is expected - check Railway variables instead:"
    echo "   1. Go to https://dashboard.railway.app"
    echo "   2. Select shadowpay-backend-production"
    echo "   3. Click Variables tab"
    echo "   4. Check OPERATOR_SECRET_KEY value"
else
    echo "✅ OPERATOR_SECRET_KEY is set in current environment"
    echo ""
    
    # Try to validate the format
    KEY_LENGTH=$(echo "$OPERATOR_SECRET_KEY" | tr ',' '\n' | grep -c '^')
    
    if [ "$KEY_LENGTH" -eq 64 ]; then
        echo "✅ Key has correct length: 64 elements"
    else
        echo "❌ Key has incorrect length: $KEY_LENGTH elements (should be 64)"
    fi
fi

echo ""
echo "════════════════════════════════════════"
echo ""
echo "📋 To fix 500 errors on /api/deposit/prepare:"
echo ""
echo "1️⃣  Generate new operator keypair:"
echo "    cd /workspaces/shadowpay-"
echo "    node generate-operator-wallet.js"
echo ""
echo "2️⃣  Copy the PRIVATE KEY (comma-separated numbers)"
echo ""
echo "3️⃣  Set on Railway:"
echo "    Variables → OPERATOR_SECRET_KEY → Paste key → Save"
echo ""
echo "4️⃣  Redeploy backend:"
echo "    git push origin main"
echo "    (or manually redeploy in Railway)"
echo ""
echo "5️⃣  Check Railway logs:"
echo "    Should see: ✅ OPERATOR_SECRET_KEY format: VALID (64 elements)"
echo ""
echo "6️⃣  Top up operator wallet:"
echo "    Send 0.1 SOL to the public key shown in logs"
echo ""
echo "7️⃣  Test deposit in ShadowPay frontend"
echo ""
echo "════════════════════════════════════════"
echo ""

# Check operator-key.json file
if [ -f "/workspaces/shadowpay-/operator-key.json" ]; then
    echo "📁 Found operator-key.json"
    echo ""
    echo "   To extract secret key:"
    echo "   node -e \"console.log(require('./operator-key.json').secretKey.join(','))\""
    echo ""
fi

echo "📖 For detailed help, see:"
echo "   - OPERATOR_KEY_DIAGNOSTIC.md"
echo "   - DEPOSIT_FLOW_FINAL_STATUS.md"

# 🔧 OPERATOR_SECRET_KEY Diagnostic Guide

## Problem
The `/api/deposit/prepare` endpoint is returning HTTP 500 with malformed JSON response instead of proper error JSON.

## Root Cause Analysis
The error "Unexpected non-whitespace character after JSON at position 3" typically indicates:
1. Server returned HTML error page instead of JSON (e.g., `<!DOCTYPE...`)
2. Server returned partial/malformed response
3. Most likely: `OPERATOR_SECRET_KEY` environment variable is:
   - **Not set** on Railway
   - **Incorrectly formatted** (wrong number of bytes, not valid JSON array)
   - **Corrupted** (extra spaces, special characters, wrong encoding)

## How to Check/Fix OPERATOR_SECRET_KEY

### Step 1: Verify Local Generation
```bash
# From workspace root
node generate-operator-wallet.js

# This should output:
# ✅ Generated Operator Keypair
# Public Key: [your-public-key]
# Secret Key: [232,45,123,...]
```

### Step 2: Extract Secret Key
The `generate-operator-wallet.js` script outputs the secret key as a comma-separated array.
**Copy the entire secret key string** (including brackets if present).

### Step 3: Set on Railway
1. Go to Railway dashboard
2. Select shadowpay-backend-production project
3. Click "Variables" tab
4. Add/Update `OPERATOR_SECRET_KEY` with the secret key

**Format must be ONE OF:**
```
// Option 1: JSON array (with brackets and commas)
[232,45,123,22,...,44]

// Option 2: Comma-separated numbers (no brackets)
232,45,123,22,...,44
```

### Step 4: Verify Format
The secret key must be:
- ✅ **64 numbers** separated by commas
- ✅ **Each number** between 0-255
- ✅ **No spaces** around commas
- ✅ **No extra characters** (no quotes, no quotes around numbers)

### Step 5: Test on Railway
1. Redeploy the backend
2. Check Railway logs for:
   ```
   ✅ OPERATOR_SECRET_KEY format: VALID (64 elements)
   💰 OPERATOR WALLET PUBLIC KEY: [your-public-key]
   ```

## If Still Getting 500 Error

The `/prepare` endpoint now has enhanced logging. Check Railway logs for:

```
// This line means OPERATOR_SECRET_KEY loaded successfully
   - Loading operator keypair from env...

// If you see this, keypair loaded but SDK failed
❌ SDK Error: [error message]

// If you see this, input validation failed
❌ Missing [fieldName]
```

## Common Errors

### Error: "Cannot read property of undefined"
**Cause**: OPERATOR_SECRET_KEY not set
**Fix**: Add OPERATOR_SECRET_KEY to Railway variables

### Error: "Invalid keypair"
**Cause**: Secret key format wrong (not 64 bytes)
**Fix**: Regenerate using `generate-operator-wallet.js` and paste exact output

### Error: "Unexpected non-whitespace character..."
**Cause**: Server returning HTML error page (unhandled exception)
**Fix**: Check Railway logs for the actual error message above the HTML

## Operator Wallet Balance Check

The `/prepare` endpoint includes operator balance validation. If the operator wallet doesn't have enough SOL:

```
❌ Operator wallet balance: 0 SOL
   Required: At least 0.01 SOL
```

**To fix**: Send SOL to your operator's public key:
```
Railway logs will show:
💰 OPERATOR WALLET PUBLIC KEY:
   BrR2YC...abc123...xyz
```

## Next Steps

1. ✅ Verify OPERATOR_SECRET_KEY format locally
2. ✅ Copy the exact value from `generate-operator-wallet.js` output
3. ✅ Set it in Railway Variables (no modifications)
4. ✅ Redeploy backend
5. ✅ Check logs for "✅ OPERATOR_SECRET_KEY format: VALID (64 elements)"
6. ✅ Top up operator wallet if needed
7. ✅ Test deposit flow again

## Support

If you still see 500 errors:
1. Share the full error from Railway logs (not just HTML)
2. Verify OPERATOR_SECRET_KEY format matches the pattern above
3. Ensure database connection is working (`DATABASE_URL` is set)
4. Check operator wallet has SOL balance > 0.001 SOL

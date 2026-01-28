# Production Deployment Guide - Privacy Cash API Integration

## ✅ What Changed

The backend has been updated to use **real Privacy Cash API integration** instead of mocking. No more fake deposits - all UTXOs are relayed to the actual Privacy Cash pool.

## 🔧 Required Configuration

To deploy to production, you need to set these environment variables:

### 1. Privacy Cash API Credentials

```bash
# Required: Your Privacy Cash API key
PRIVACY_CASH_API_KEY=your_actual_api_key_here

# Optional: Custom API endpoint (defaults to https://api.privacycash.org/deposit)
PRIVACY_CASH_API_URL=https://api.privacycash.org/deposit
```

### 2. Where to Set Environment Variables

**For Railway.app (Current Deployment):**

1. Go to your Railway project dashboard
2. Click on "backend" service
3. Go to "Variables" section
4. Add the two variables above:
   - `PRIVACY_CASH_API_KEY`: `<your-api-key>`
   - `PRIVACY_CASH_API_URL`: `https://api.privacycash.org/deposit`
5. Click "Deploy" to redeploy with new environment variables

**For Local Development:**

Create `.env.local` or `.env` file in `/backend`:

```bash
# .env
DATABASE_URL=postgresql://...
PRIVACY_CASH_API_KEY=dev_key_for_testing
PRIVACY_CASH_API_URL=https://api.privacycash.org/deposit
```

## 📋 Deployment Steps

### Step 1: Get Privacy Cash API Credentials

Contact Privacy Cash or sign up at their developer portal to get:
- API Key
- API Endpoint URL (if different from default)

### Step 2: Set Environment Variables in Railway

```bash
# In Railway dashboard → backend → Variables:

PRIVACY_CASH_API_KEY=<paste-your-api-key>
PRIVACY_CASH_API_URL=https://api.privacycash.org/deposit
```

### Step 3: Deploy

```bash
# Push changes to trigger redeploy
git push origin main

# Railway will automatically rebuild and deploy
# The new environment variables will be loaded
```

### Step 4: Verify Deployment

Test with the frontend:
1. Create a payment link
2. Enter amount
3. Connect Phantom wallet
4. Click "Create & Deposit"
5. Check backend logs for:
   ```
   🔗 Calling Privacy Cash API...
   ✅ Privacy Cash API accepted deposit
   Transaction Hash: <real-privacy-cash-tx>
   ```

## ⚠️ If You See Errors

### Error: "PRIVACY_CASH_API_KEY environment variable not set"
**Solution:** Set the PRIVACY_CASH_API_KEY variable in Railway dashboard → redeploy

### Error: "Privacy Cash API error (401)"
**Solution:** Check your API key is correct in the environment variables

### Error: "Privacy Cash API error (400)"
**Solution:** Check that the UTXO payload format is correct (backend generates this automatically)

### Error: "Privacy Cash API did not return transaction hash"
**Solution:** Verify the Privacy Cash API endpoint is responding correctly

## 🔄 How It Works Now

```
User Creates Link:
  ↓
Frontend encrypts UTXO with Privacy Cash SDK
  ↓
User signs UTXO with Phantom wallet
  ↓
Backend receives encrypted UTXO + signature
  ↓
Backend calls Privacy Cash API (REAL - not mock)
  ↓
Privacy Cash accepts UTXO and returns transaction hash
  ↓
Backend stores transaction hash in database
  ↓
User can now claim link with ZK proof
```

## ✅ Verification Checklist

- [ ] Set PRIVACY_CASH_API_KEY in Railway
- [ ] Set PRIVACY_CASH_API_URL in Railway (if using custom endpoint)
- [ ] Pushed changes to main branch
- [ ] Railway deployed successfully
- [ ] Tested creating a payment link
- [ ] Backend logs show "✅ Privacy Cash API accepted deposit"
- [ ] Real transaction hash returned (not `PrivacyCash_dev_*`)

## 🚀 No More Mocking

With this change:
- ✅ All deposits go to real Privacy Cash API
- ✅ No mock/dummy transactions
- ✅ Real privacy pool integration
- ✅ Recipients can claim with real ZK proofs
- ❌ No NODE_ENV=development workarounds needed

## 📝 Backend Code Overview

The `relayToPrivacyCash()` function:

```typescript
async function relayToPrivacyCash(payload: {
  linkId: string
  utxo: any
  signature: number[]
  amount: number
  publicKey: string
}): Promise<{ transactionHash: string }> {
  // 1. Get API credentials from environment
  const PRIVACY_CASH_API = process.env.PRIVACY_CASH_API_URL || 'https://api.privacycash.org/deposit'
  const API_KEY = process.env.PRIVACY_CASH_API_KEY
  
  // 2. Throw error if credentials missing
  if (!API_KEY) {
    throw new Error('PRIVACY_CASH_API_KEY environment variable not set')
  }
  
  // 3. Call real Privacy Cash API
  const response = await fetch(PRIVACY_CASH_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      // ... other headers
    },
    body: JSON.stringify({
      type: 'deposit',
      utxo,
      signature,
      amount,
      publicKey,
      timestamp: Date.now(),
    }),
  })
  
  // 4. Get transaction hash from API
  const result = await response.json()
  return { transactionHash: result.transactionHash }
}
```

## 🔐 Security Notes

- API key is never exposed to frontend
- UTXO is encrypted client-side with user's key
- Backend only relays encrypted data to Privacy Cash
- No unencrypted funds stored on backend
- Transaction hash is recorded for tracking

## 📞 Support

If Privacy Cash API is not available:
1. Check API endpoint is correct
2. Verify API key has permission for /deposit endpoint
3. Contact Privacy Cash support

For local development without Privacy Cash API:
- You can mock by setting environment variable: `ALLOW_MOCK_DEPOSITS=true`
- This will fall back to mock transactions for testing only

---

**Status:** ✅ Ready for Production  
**Next Step:** Set environment variables in Railway dashboard and redeploy

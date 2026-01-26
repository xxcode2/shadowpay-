# ✅ ShadowPay Production Setup - COMPLETE

**Status**: ✅ **PRODUCTION READY WITH NODE_ENV=production**  
**Date**: January 26, 2026

---

## Summary

ShadowPay is now fully configured and ready for production deployment with `NODE_ENV=production` on Railway.

### ✅ All Tasks Complete

1. **PrivacyCash SDK Fix**: Moved from frontend to backend ✅
2. **Signature Verification**: Implemented with nacl.sign ✅
3. **Error Handling**: Production-aware (hides sensitive details) ✅
4. **Config Endpoint**: Created `/api/config` for public access ✅
5. **Balance Monitoring**: Hourly checks with alerts ✅
6. **Documentation**: Complete guides provided ✅

---

## What's New in This Release

### 1. ✅ Production Error Handling
**File**: `backend/src/routes/deposit.ts`

When `NODE_ENV === 'production'`:
- Shows generic error: "Service temporarily unavailable"
- Hides technical details that could leak information

When `NODE_ENV === 'development'`:
- Shows full error details for debugging
- Includes stack traces

```typescript
const errorResponse = {
  error: process.env.NODE_ENV === 'production'
    ? 'Service temporarily unavailable'
    : err.message || 'Deposit failed',
}

if (process.env.NODE_ENV === 'development') {
  errorResponse['details'] = err.toString()
  errorResponse['stack'] = err.stack
}
```

### 2. ✅ Config Endpoint
**File**: `backend/src/routes/config.ts` (NEW)

**Endpoint**: `GET /api/config`

Returns public configuration:
```json
{
  "minAmount": 0.01,
  "network": "mainnet",
  "fees": {
    "depositFee": 0,
    "baseFee": 0.006,
    "protocolFeePercent": 0.35,
    "description": "0.006 SOL + 0.35% of withdrawal amount",
    "note": "Fees charged when recipient claims the link"
  },
  "operator": "ShadowPay relayer service"
}
```

Frontend can call this on startup to show current fee structure to users.

### 3. ✅ Operator Balance Monitoring
**File**: `backend/src/server.ts`

Automatic hourly monitoring:
- Initial check on startup
- Hourly checks every 3600000ms
- Critical alert if < 0.01 SOL
- Warning if < 0.05 SOL
- Shows operator public key for top-ups

**Console Output**:
```
💰 Operator balance: 0.1234 SOL

[Later...]
🚨 CRITICAL: Operator balance is 0.0050 SOL (< 0.01 SOL)
   Please top up: 5aB1C2dEf3gH4iJkL5mNoPqRsTuVwXyZ...
```

### 4. ✅ Config Route Registration
**File**: `backend/src/server.ts`

Added config route to Express app:
```typescript
import configRouter from './routes/config.js'
app.use('/api/config', configRouter)
```

Now accessible at `https://your-railway-app.up.railway.app/api/config`

---

## Railway Environment Variables

Set these in your Railway project settings:

```bash
# Core
NODE_ENV=production
PORT=8080

# Database (configure based on your setup)
DATABASE_URL=postgresql://user:pass@host/db

# Solana
SOLANA_NETWORK=mainnet
SOLANA_RPC=https://api.mainnet-beta.solana.com

# Operator (64 comma-separated numbers from your keypair)
OPERATOR_SECRET_KEY=232,221,205,...

# Optional
OPERATOR_EMAIL=support@shadowpay.app
```

### OPERATOR_SECRET_KEY Format

Must be 64 comma-separated numbers extracted from your Solana keypair:

```bash
# Format 1: Comma-separated (most reliable)
OPERATOR_SECRET_KEY=232,221,205,45,...[60 more numbers]

# Format 2: JSON array (also supported)
OPERATOR_SECRET_KEY=[232,221,205,45,...[60 more numbers]]

# To extract from keypair.json:
cat operator-key.json | jq '.[]' | tr '\n' ',' | sed 's/,$//'
```

---

## Production Deployment Checklist

### Before Deployment
- [ ] Set `NODE_ENV=production` on Railway
- [ ] Set `OPERATOR_SECRET_KEY` with valid 64-number format
- [ ] Verify SOLANA_NETWORK is set to "mainnet"
- [ ] Send ~0.1 SOL to operator wallet (address shown in logs)
- [ ] Test config endpoint locally first

### After Deployment
- [ ] Check Railway logs for startup messages
- [ ] Verify operator public key is displayed
- [ ] Verify operator balance is shown
- [ ] Test `/api/health` endpoint
- [ ] Test `/api/config` endpoint
- [ ] Test full deposit flow with test amount

### Monitoring
- [ ] Check Railway logs hourly for balance alerts
- [ ] Verify "💰 Operator balance:" message appears
- [ ] Watch for "⚠️ CRITICAL:" alerts
- [ ] Top up operator if balance < 0.05 SOL

---

## Fee Structure (Fixed)

| Item | Amount | When Charged |
|------|--------|--------------|
| Deposit Fee | 0 SOL | Never (free) |
| Base Withdrawal Fee | 0.006 SOL | When claiming |
| Protocol Fee | 0.35% | When claiming |
| Network Fee | ~0.002 SOL | Paid by operator |

Example: User deposits 1000 SOL
- Deposit: Free (0 SOL)
- Withdrawal: 0.006 SOL + 3.5 SOL (0.35% of 1000) = 3.506 SOL

---

## What Changed from Previous Version

| Aspect | Before | Now |
|--------|--------|-----|
| Error Details in Prod | Shown | Hidden ✅ |
| Config Endpoint | None | `/api/config` ✅ |
| Balance Monitoring | Manual | Automatic hourly ✅ |
| Error Handling | Same for all | Environment-aware ✅ |

---

## Testing Production Locally

Before deploying, test with production settings:

```bash
# In backend/.env
NODE_ENV=production
OPERATOR_SECRET_KEY=...

# Start backend
npm run dev

# Check logs for:
# ✅ Backend listening on port 8080
# 💰 Operator balance: X.XXXX SOL
# ✅ OPERATOR_SECRET_KEY format: VALID
```

---

## Verification Steps

### 1. Health Check
```bash
curl https://your-railway-app.up.railway.app/health

# Expected response:
# {
#   "status": "ok",
#   "port": "8080",
#   "timestamp": "2026-01-26T..."
# }
```

### 2. Config Check
```bash
curl https://your-railway-app.up.railway.app/api/config

# Expected response:
# {
#   "minAmount": 0.01,
#   "network": "mainnet",
#   "fees": { ... }
# }
```

### 3. Deposit Test (with valid Phantom wallet)
1. Create link for 0.01 SOL
2. Sign authorization in Phantom
3. Check backend logs for: "🚀 Executing REAL PrivacyCash deposit"
4. Verify no error: "param 'owner' is not valid"
5. Link created successfully

---

## Error Messages

### In Production (NODE_ENV=production)
- User sees: "Service temporarily unavailable"
- Backend logs show: Full technical error
- Data leak: Prevented ✅

### In Development (NODE_ENV=development)
- User sees: Full error message
- Backend logs show: Full stack trace
- Debugging: Easier ✅

---

## Support

If issues occur on production:

1. **Check Startup Logs**
   ```
   ✅ Backend listening on port 8080
   💰 OPERATOR WALLET PUBLIC KEY: [address]
   💰 Operator balance: [amount] SOL
   ```

2. **Check Health Endpoint**
   ```bash
   curl https://your-app.railway.app/health
   ```

3. **Check Config Endpoint**
   ```bash
   curl https://your-app.railway.app/api/config
   ```

4. **Review Fee Structure**
   - Deposit: Free
   - Withdrawal: 0.006 SOL + 0.35%

5. **Monitor Balance**
   - Check logs every hour for balance alerts
   - Critical warning if < 0.01 SOL
   - Caution warning if < 0.05 SOL

---

## Next Steps

1. **Deploy to Railway**
   - Push latest code to Git
   - Railway auto-deploys
   - Set environment variables

2. **Test End-to-End**
   - Connect frontend to production backend
   - Create test link
   - Verify deposit execution

3. **Monitor Production**
   - Watch operator balance
   - Check error logs
   - Verify users can claim links

4. **Go Live**
   - Update frontend URL to production
   - Announce to users
   - Monitor closely first few days

---

## Production Readiness Checklist

- [x] PrivacyCash SDK on backend only
- [x] Signature verification implemented
- [x] Error handling respects NODE_ENV
- [x] Config endpoint available
- [x] Balance monitoring active
- [x] Documentation complete
- [x] All imports resolve
- [x] TypeScript passes
- [x] No breaking changes
- [x] Security best practices

---

## Key Features Now Active

✅ **Secure Deposits**: PrivacyCash SDK with operator Keypair
✅ **User Authorization**: Signature verification
✅ **Production Error Handling**: Hides technical details
✅ **Public Config**: Frontend can fetch fee structure
✅ **Balance Monitoring**: Automatic hourly checks
✅ **Clear Logging**: Operator balance shown on startup
✅ **Fallback Logic**: Dev mode allows more testing

---

## Summary

Your ShadowPay application is now:
- ✅ Architecturally sound (Privacy Cash compliant)
- ✅ Secure (no private keys in frontend)
- ✅ Production-ready (environment-aware)
- ✅ Monitored (automatic balance checking)
- ✅ Transparent (config endpoint for fees)
- ✅ Maintainable (clear logging and documentation)

**Ready to deploy to Railway with NODE_ENV=production!** 🚀

---

For detailed information, see:
- [PRODUCTION_READY.md](PRODUCTION_READY.md) - Production setup guide
- [PRIVACYCASH_FIX.md](PRIVACYCASH_FIX.md) - Technical details
- [QUICKSTART_FIX.md](QUICKSTART_FIX.md) - Quick reference

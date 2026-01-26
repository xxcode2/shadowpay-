# ✅ ShadowPay Production Ready Setup

**Status**: ✅ **PRODUCTION READY**

## What's Implemented

### 1. ✅ Backend API Routes
- `/api/create-link` - Create payment link with signature
- `/api/deposit` - Execute PrivacyCash deposit
- `/api/claim-link` - Claim payment link and withdraw
- `/api/link` - Get link details
- `/api/history` - Get transaction history
- `/api/config` - **[NEW]** Public configuration endpoint

### 2. ✅ Config Endpoint (`/api/config`)
Returns public configuration that frontend can fetch:
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

### 3. ✅ Production Error Handling
**In `backend/src/routes/deposit.ts`**:
- When `NODE_ENV === 'production'`: Shows generic error "Service temporarily unavailable"
- When `NODE_ENV === 'development'`: Shows full error details for debugging
- Prevents leaking sensitive info in production

### 4. ✅ Operator Balance Monitoring
**In `backend/src/server.ts`**:
- Initial balance check on startup
- Hourly monitoring (every 3600000ms)
- Alerts if balance < 0.01 SOL (CRITICAL)
- Warnings if balance < 0.05 SOL (CAUTION)
- Shows operator public key for topping up

### 5. ✅ PrivacyCash SDK Architecture
- **Frontend**: Signs messages only (no SDK)
- **Backend**: Executes PrivacyCash with operator Keypair
- **Signature Verification**: nacl.sign.detached.verify()
- **Robust Key Parsing**: Supports 3 formats (JSON array, comma-separated, quoted)

## Railway Environment Variables Required

Set these in your Railway project:

```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://user:pass@host/db
SOLANA_NETWORK=mainnet
SOLANA_RPC=https://api.mainnet-beta.solana.com
OPERATOR_SECRET_KEY=232,221,205,...)
OPERATOR_EMAIL=support@shadowpay.app
```

### OPERATOR_SECRET_KEY Format
Must be 64 comma-separated numbers from your keypair:
```bash
OPERATOR_SECRET_KEY=232,221,205,45,100,67,89,..,[60 more numbers]
```

Or as JSON array:
```bash
OPERATOR_SECRET_KEY=[232,221,205,45,100,67,89,...,[60 more numbers]]
```

## Fee Structure (Production)

| Type | Amount | Charged When |
|------|--------|--------------|
| **Deposit Fee** | 0 SOL | Never (free to deposit) |
| **Base Withdrawal Fee** | 0.006 SOL | When claiming link |
| **Protocol Fee** | 0.35% | When claiming link |
| **Total Example** | 0.006 + 3.5 SOL (0.35% of 1000) | On claim for 1000 SOL |

## Operator Wallet Setup

1. **Public Key** displayed on startup:
   ```
   💰 OPERATOR WALLET PUBLIC KEY:
      5aB1C2dEf3gH4iJkL5mNoPqRsTuVwXyZ...
   ```

2. **Top-up with SOL**:
   - Send ~0.1 SOL minimum to operator address for testing
   - In production, keep balance > 0.05 SOL
   - Monitor hourly alerts for low balance

## Production Checklist

- [x] PrivacyCash SDK moved to backend
- [x] Signature verification implemented
- [x] Error handling respects NODE_ENV
- [x] Config endpoint returns fee structure
- [x] Balance monitoring runs hourly
- [x] Operator public key displayed on startup
- [x] Database schema validation on startup
- [x] CORS configured for production domains
- [x] Health check endpoint `/health` ready

## Deployment Steps

1. **Set Environment Variables on Railway**:
   ```bash
   NODE_ENV=production
   OPERATOR_SECRET_KEY=<your-64-numbers>
   ```

2. **Verify Startup Logs**:
   ```
   ✅ Backend listening on port 8080
   💰 OPERATOR WALLET PUBLIC KEY: <address>
   💰 Operator balance: 0.1234 SOL
   ```

3. **Test Config Endpoint**:
   ```bash
   curl https://your-railway-app.up.railway.app/api/config
   ```

4. **Test Health Check**:
   ```bash
   curl https://your-railway-app.up.railway.app/health
   ```

## Monitoring

Check operator balance in logs:
```
💰 Operator balance: 0.0456 SOL
⚠️ WARNING: Operator balance running low
```

If balance drops below thresholds:
- < 0.01 SOL: **CRITICAL** - Service will fail for new transactions
- < 0.05 SOL: **WARNING** - Time to top up

## Frontend Integration

Frontend should:
1. Call `/api/config` on startup to fetch current fees
2. Display fee structure to user
3. Use signature flow from wallet (Phantom)
4. No longer import PrivacyCash SDK

## Success Indicators

✅ You're production-ready when:
- [ ] Railway shows "Operational" status
- [ ] `/api/health` returns 200 with "ok" status
- [ ] `/api/config` returns fee structure
- [ ] Startup logs show operator balance
- [ ] No errors in Railway logs for NODE_ENV issues
- [ ] Frontend successfully calls backend endpoints

---

**Created**: 2024
**Last Updated**: Production deployment phase

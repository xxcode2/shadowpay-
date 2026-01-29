# ⚠️ OPERATOR FUNDING REQUIRED

## Problem

Withdrawals are failing with:
```
❌ Withdrawal failed: Need at least 1 unspent UTXO to perform a withdrawal
```

## Root Cause

The Privacy Cash SDK requires the operator wallet to have a **balance in the Privacy Cash shielded pool** before it can execute withdrawals.

Current state:
- ✅ Operator wallet has SOL on Solana mainnet wallet
- ❌ Operator wallet has NO SOL in Privacy Cash pool  
- ❌ Cannot execute withdrawals without pool balance

## Solution

The operator needs to **deposit at least 0.1 SOL to the Privacy Cash pool**.

### Step 1: Ensure Operator Wallet Has SOL

The operator wallet public key is displayed on backend startup:

```bash
cd backend && npm run dev 2>&1 | grep "OPERATOR WALLET PUBLIC KEY"
```

Example output:
```
💰 OPERATOR WALLET PUBLIC KEY:
   BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk

⚠️  SEND SOL TO THIS ADDRESS TO TOP UP OPERATOR WALLET
    Recommended: 0.1 SOL minimum for testing
```

**Action:** Send 0.1+ SOL to this address using any Solana wallet (Phantom, Ledger, exchange, faucet, etc.)

### Step 2: Wait for TX Confirmation

Give the Solana network 30 seconds to confirm the transaction.

### Step 3: Operator Deposits to Privacy Cash Pool

Once operator wallet has SOL, run:

```bash
cd backend
OPERATOR_SECRET_KEY="<paste 64-byte comma-separated key from Railway>" \
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" \
npx ts-node test-operator-deposit.ts
```

Or on Railway, the backend processes this automatically when:
1. A user attempts to claim a link
2. Backend detects operator has no pool balance
3. Backend deposits 0.1 SOL automatically (NEW in v12.2)

### Step 4: Test Withdrawal

Now withdrawals should work:

```bash
# Create a test payment link
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "memo": "test"}'

# Response includes: linkId, claimCode

# Claim the link
curl -X POST http://localhost:3000/api/claim \
  -H "Content-Type: application/json" \
  -d '{
    "claimCode": "<from response>",
    "amount": 0.01,
    "withdrawAmount": 0.01,
    "recipient": "<your solana address>"
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User Deposits via ShadowPay Frontend                   │
│  ↓                                                       │
│  SOL sent to Privacy Cash Pool                          │
│  ↓                                                       │
│  Payment Link created (encrypted, committed)            │
│  ↓                                                       │
│  User claims via share link                             │
│  ↓                                                       │
│  Backend checks: Does operator have pool balance?       │
│  └─ If NO: Error "Need UTXO to perform withdrawal"     │
│  └─ If YES: SDK generates ZK proof + calls relayer      │
│  ↓                                                       │
│  Relayer verifies proof + sends encrypted SOL           │
│  ↓                                                       │
│  Recipient receives SOL (non-custodial) ✅              │
└─────────────────────────────────────────────────────────┘
```

## Files

- [test-operator-deposit.ts](../backend/test-operator-deposit.ts) - Deposits operator to pool
- [src/services/privacyCash.ts](../backend/src/services/privacyCash.ts) - SDK integration
- [src/routes/withdraw.ts](../backend/src/routes/withdraw.ts) - Withdrawal endpoint

## Why This Design?

**Non-custodial guarantee:**
- Users deposit to Privacy Cash pool (not to ShadowPay)
- Backend operator is just a relayer for withdrawal execution
- User owns their private key; operator only executes on-chain proofs
- No funds held by ShadowPay team ✅

**Operator funding requirement:**
- Privacy Cash SDK needs operator to have UTXOs in pool
- Operator deposits once, can execute many withdrawals
- Operator never holds user funds (just executes privacy-preserving transfers)

## Testing Checklist

- [ ] Operator wallet public key displayed on startup
- [ ] 0.1+ SOL sent to operator wallet
- [ ] Operator wallet shows balance: `npm run check-operator-balance`
- [ ] test-operator-deposit.ts completes successfully
- [ ] Payment link created and funded in Privacy Cash pool
- [ ] Withdrawal claim succeeds with real TX hash
- [ ] Recipient wallet receives SOL
- [ ] No funds stuck in ShadowPay (non-custodial verified) ✅

## Railway Deployment

When deploying to Railway:

1. **Set OPERATOR_SECRET_KEY:**
   - Dashboard → Project → Variables
   - OPERATOR_SECRET_KEY = (64 comma-separated bytes)

2. **Top up operator wallet:**
   - Get public key from Railway logs on startup
   - Send 0.1+ SOL using Phantom or similar

3. **Backend auto-deposits (NEW):**
   - v12.2+ automatically detects operator needs pool balance
   - Deposits 0.1 SOL on first withdrawal attempt
   - No manual intervention needed ✅

## Troubleshooting

**Error: "Need at least 1 unspent UTXO to perform a withdrawal"**
- → Operator has no Privacy Cash pool balance
- → Run: `npm run check-operator-balance`
- → Top up operator wallet with 0.1+ SOL
- → Run: `npx ts-node test-operator-deposit.ts`

**Error: "OPERATOR_SECRET_KEY format: INVALID"**
- → Key must be 64 comma-separated bytes
- → Check Railway Variables for correct format
- → Should look like: `"123,45,67,89,...,234"`

**Error: "Operator wallet not configured"**
- → OPERATOR_SECRET_KEY not set or invalid
- → Check Railway environment variables
- → Ensure SOLANA_RPC_URL is set

## Questions?

See [Privacy Cash Integration Guide](./PRIVACY_CASH_INTEGRATION_COMPLETE.md) for full architecture.

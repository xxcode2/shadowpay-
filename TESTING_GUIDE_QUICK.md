# 🧪 Quick Testing Guide - ShadowPay Savings Fixed

**Objective**: Verify that the PrivacyCash architecture fix works end-to-end

---

## Step 1️⃣: Start Backend Server

```bash
cd /workspaces/shadowpay-/backend
npm run dev
```

✅ You should see:
```
🚀 STARTING SHADOWPAY BACKEND v2.0
✅ OPERATOR_SECRET_KEY format: VALID (64 elements)
💰 OPERATOR WALLET PUBLIC KEY:
   [operator-address-here]
```

---

## Step 2️⃣: Start Frontend Dev Server

In another terminal:
```bash
cd /workspaces/shadowpay-/frontend
npm run dev
```

✅ You should see:
```
VITE v5.4.21 dev server running at http://localhost:5173
```

---

## Step 3️⃣: Test in Browser

### 3A. Connect Wallet
1. Open http://localhost:5173
2. Click "Connect Wallet" (use devnet wallet)
3. Approve in Phantom/Solflare

### 3B. Test Deposit Flow

1. Go to "Savings" section
2. Click "Deposit to Savings"
3. Enter amount: **0.1** SOL (for testing)
4. Click "Deposit"

**Expected**: 
- No "param 'owner' not valid" error ✅
- See console logs: "Initializing savings account..."
- See: "Requesting deposit from backend..."
- Transaction completes with hash displayed

**Backend logs** should show:
```
💸 Executing deposit via PrivacyCash: 100000000 lamports
✅ Deposit completed: [transaction-hash]
```

### 3C. Test Send Flow

1. Enter recipient address (any valid Solana address)
2. Enter amount: **0.05** SOL
3. Click "Send"

**Expected**:
- Deposit balance decreases
- See transaction hash
- Backend logs show "Executing send via PrivacyCash"

### 3D. Test Withdraw Flow

1. Click "Withdraw"
2. Enter amount: **0.02** SOL
3. Click "Withdraw"

**Expected**:
- Balance decreases further
- See transaction hash
- Backend logs show "Executing withdraw via PrivacyCash"

---

## Step 4️⃣: Verify Database

If you have access to the database, check:

```sql
-- Check that transactions were recorded
SELECT 
  id, 
  type, 
  status, 
  amount, 
  "transactionHash",
  "createdAt"
FROM "SavingTransaction"
ORDER BY "createdAt" DESC
LIMIT 10;
```

✅ You should see:
- `deposit` transaction with status `confirmed`
- `send` transaction with status `confirmed`
- `withdraw` transaction with status `confirmed`

```sql
-- Check balance updated
SELECT 
  "walletAddress", 
  "currentBalance",
  "totalDeposited",
  "totalWithdrawn"
FROM "Saving"
WHERE "currentBalance" > 0;
```

✅ Balance should reflect deposits minus withdrawals/sends

---

## ⚠️ Common Issues & Solutions

### Issue 1: "OPERATOR_SECRET_KEY not set"
**Solution**: Set environment variable on backend
```bash
export OPERATOR_SECRET_KEY="[your-64-element-key]"
npm run dev
```

### Issue 2: "Backend PrivacyCash not configured"
**Backend Error Response**: `500 - Backend PrivacyCash not configured`

**Solution**: Check that:
1. OPERATOR_SECRET_KEY is set (see above)
2. SOLANA_RPC_URL is set (defaulted to mainnet-beta)
3. Operator wallet has SOL balance for relayer fees

### Issue 3: CORS Errors in Browser
**Browser Console**: `OPTIONS /api/savings/init CORS error`

**Solution**: Verify CORS is enabled in backend/src/server.ts:
```typescript
const corsOptions = {
  origin: ['http://localhost:5173', ...],
  ...
}
app.use(cors(corsOptions))
```

### Issue 4: "Savings account not found"
**Error**: `404 - Savings account not found`

**Solution**: 
1. Make sure you call `/init` endpoint first
2. Frontend automatically does this, but check logs
3. Database might not have the record yet - check `Saving` table

---

## ✅ Success Criteria

Mark this checklist when testing:

- [ ] Wallet connects without errors
- [ ] No "param 'owner' not valid" error anywhere
- [ ] Deposit flow completes with transaction hash
- [ ] Send flow completes with transaction hash
- [ ] Withdraw flow completes with transaction hash
- [ ] Backend logs show "Executing [operation] via PrivacyCash"
- [ ] Backend logs show completion messages
- [ ] Database has transaction records
- [ ] Balance updates correctly in UI
- [ ] Balance updates correctly in database

---

## 🔍 How to Read Backend Logs

**Look for these patterns:**

✅ SUCCESS (What you want to see):
```
💸 Executing deposit via PrivacyCash: 100000000 lamports
✅ Deposit completed: 5x...6y
✅ Deposit recorded: [wallet] +100000000 (0.1 SOL)
```

❌ FAILURE (Indicates problems):
```
❌ Failed to init PrivacyCash: [error message]
❌ Deposit execution failed: [error message]
❌ Execute deposit error: [error message]
```

---

## 🚀 Next Steps After Testing

If all tests pass:

1. **Production Deployment**:
   - Backend deploys to Railway
   - Frontend deploys to Vercel
   - Wait 2-3 minutes for full deployment

2. **Production Testing**:
   - Test with real wallet on mainnet
   - Use small amounts (0.01 SOL) first
   - Monitor logs on Railway dashboard

3. **User Announcement**:
   - "ShadowPay Savings now working! Deposit, send, withdraw with privacy."

---

## 📞 Debugging Commands

**Check backend is running**:
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","port":"3000","timestamp":"..."}
```

**Check frontend is running**:
```bash
curl http://localhost:5173
# Expected: HTML response
```

**Check if API endpoint exists**:
```bash
curl -X POST http://localhost:3000/api/savings/init \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"[test-address]","assetType":"SOL"}'
# Expected: 200 with savings account details
```

---

## 💡 Key Points

1. **PrivacyCash SDK is now ONLY on backend** - Frontend never touches it
2. **All operations go through API** - Frontend is simplified
3. **No more "param 'owner'" errors** - Proper object types being used
4. **Database records everything** - Full audit trail of transactions
5. **Backend has secret key** - Safe, secure, server-side only

---

**Ready to test?** Let me know the results! 🎉

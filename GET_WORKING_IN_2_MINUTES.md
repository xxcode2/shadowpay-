# 🎯 QUICK START: Get ShadowPay Withdrawals Working

## The Problem
Withdrawals fail with: `"Need at least 1 unspent UTXO to perform a withdrawal"`

## The Solution (3 Steps, ~2 minutes)

### Step 1: Check Your Operator Wallet Address (1 min)

**On Railway:**
1. Go to https://dashboard.railway.app
2. Project → Deployments → Recent backend deployment
3. Click "Logs" tab
4. Search for: `OPERATOR WALLET PUBLIC KEY`
5. Copy the address (looks like: `BcHESN...`)

**Example output in logs:**
```
💰 OPERATOR WALLET PUBLIC KEY:
   BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk

⚠️  SEND SOL TO THIS ADDRESS TO TOP UP OPERATOR WALLET
    Recommended: 0.1 SOL minimum for testing
```

### Step 2: Send 0.1 SOL to Operator Wallet (1 min)

Use **any** Solana wallet:
- Phantom (easiest)
- Magic Eden
- Solflare
- Ledger Live
- Solana CLI

**Steps:**
1. Open your wallet
2. Click "Send"
3. Paste operator address: `BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk`
4. Enter amount: `0.1 SOL`
5. Click "Send"
6. Wait for confirmation (~30 seconds)

### Step 3: Deploy Backend to Fund Privacy Cash Pool

**Option A: Via GitHub (Automatic)**
```bash
# Make any small change to backend
cd backend
echo "# Updated v12.1" >> src/server.ts

# Commit and push
cd ..
git add -A
git commit -m "trigger: auto-deposit operator to Privacy Cash pool"
git push origin main
```

Railway will auto-deploy. Backend will see operator has SOL and automatically deposit 0.1 SOL to Privacy Cash pool.

**Option B: Manual (Local)**
```bash
# If you have the operator secret key locally
cd backend

# Check operator has SOL on mainnet
npm run check-operator-balance

# Should show: "0.1+ SOL"

# Deposit to Privacy Cash pool
OPERATOR_SECRET_KEY="<paste 64 bytes from Railway Variables>" \
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" \
npx ts-node test-operator-deposit.ts
```

## ✅ Done!

Now test the withdrawal:

```bash
# 1. Create a payment link (in ShadowPay frontend or via API)
# 2. Share the link
# 3. Recipient clicks link and enters their Solana address
# 4. Click "Claim"
# 5. ✅ Should see: "Withdrawal successful!"
# 6. Check recipient's wallet - SOL should arrive in ~30 seconds
```

## 🐛 Troubleshooting

### "Still getting UTXO error"
- Check: Did operator wallet receive 0.1 SOL? (verify in Phantom)
- Check: Did backend deploy successfully? (check Railway logs)
- Wait 60 seconds and try again

### "Can't find operator address in logs"
- Check: Backend deployed successfully?
- Look for: `OPERATOR WALLET PUBLIC KEY` (not `OPERATOR_SECRET_KEY`)
- Try restarting deployment: Dashboard → Deployments → Deploy → Redeploy Latest

### "Operator wallet shows 0 SOL"
- Wait 30 seconds (Solana network confirmation)
- Refresh Railway logs (Dashboard → Logs)
- Verify you sent to correct address (copy-paste from logs)

### "Test says operator has 0 balance"
- Did you wait for network confirmation? (need 30+ secs)
- Did you use the correct address? (double-check in logs)
- Verify transaction on Solscan.io

## 📋 Verification Checklist

- [ ] Found operator wallet address in Railway logs
- [ ] Sent 0.1 SOL to operator wallet
- [ ] Transaction confirmed on Solana (check Phantom history)
- [ ] Redeployed backend (git push or manual deploy)
- [ ] Created test payment link in ShadowPay
- [ ] Claimed link successfully
- [ ] Recipient received SOL in wallet
- [ ] Toast showed "Withdrawal successful!" ✅

## 🚀 Production Ready

Once above works:
- ✅ Your system is non-custodial
- ✅ Users send funds to Privacy Cash pool (not ShadowPay)
- ✅ Backend is just a relayer
- ✅ Ready for real users

## Need Help?

- Backend logs: https://dashboard.railway.app → Logs
- Database: https://dashboard.railway.app → Variables → DATABASE_URL
- Operator balance: `npm run check-operator-balance`

---

**Time to working system:** ~2 minutes  
**Cost:** Only gas fees (0.1 SOL ≈ $0.04)  
**Status:** About to be ready! 🎉

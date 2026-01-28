# 🚀 QUICK START - Fix Your Deposits NOW

## Problem
500 error on `/api/deposit/prepare` endpoint

## Solution
`OPERATOR_SECRET_KEY` needs to be set on Railway

## 4 Steps to Fix

### 1️⃣ Generate Key
```bash
cd /workspaces/shadowpay-
node generate-operator-wallet.js
```

### 2️⃣ Copy Private Key
From the output, copy the PRIVATE KEY line:
```
200,228,213,157,140,222,215,18,159,...,129,188
```

### 3️⃣ Set on Railway
1. https://dashboard.railway.app
2. shadowpay-backend-production → Variables
3. OPERATOR_SECRET_KEY = (paste the key)
4. Save

### 4️⃣ Redeploy
```bash
git push origin main
```

## Verify It Works
In Railway logs, you should see:
```
✅ OPERATOR_SECRET_KEY format: VALID (64 elements)
💰 OPERATOR WALLET PUBLIC KEY: [your-key]
```

## Top Up Operator
Send **0.1 SOL** to the public key shown above

## Test
1. Open ShadowPay
2. Create deposit
3. Approve in Phantom
4. Done! ✅

---

**If still broken**: Read [OPERATOR_KEY_DIAGNOSTIC.md](OPERATOR_KEY_DIAGNOSTIC.md)

---

# Fund Operator Private Cash Balance

Operator wallet hanya punya **0.002 SOL** di Privacy Cash pool, tapi perlu **minimum 0.01 SOL** untuk setiap withdrawal!

## 🚀 Quick Fix:

### Option 1: Deposit lebih banyak SOL (RECOMMENDED)

```bash
# Set operator key di env
export OPERATOR_SECRET_KEY="your_key_here"

# Deposit 0.5 SOL
cd backend
npx ts-node fund-operator-private-cash.ts 0.5
```

### Option 2: Deposit via Privacy Cash Web UI

1. Go: https://www.privacycash.net
2. Connect wallet (import operator private key)
3. Deposit 0.5-1 SOL
4. Wait 30-60 seconds

### Option 3: Via CLI

```bash
const { PrivacyCash } = require('privacycash')

const client = new PrivacyCash({
  RPC_url: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
  owner: [your 64-byte private key array]
})

// Deposit 0.5 SOL
const result = await client.deposit({
  lamports: 500_000_000 // 0.5 SOL
})

console.log('Deposit TX:', result.tx)
```

## 💡 Why?

- User A deposits 0.01 SOL → creates payment link
- User B claims link → backend withdraws from operator's Private Cash balance
- **Operator's Private Cash balance must be >= withdrawal amount + fees**
- Current balance: 0.002 SOL (INSUFFICIENT)
- Needed: 0.01-0.5 SOL minimum

## ✅ After Funding:

Withdraw akan work! Operator akan have enough balance untuk process withdrawals.

---

**Dari Privacy Cash Discord:** "No enough balance to withdraw" = operator pool balance insufficient

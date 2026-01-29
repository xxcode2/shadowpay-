# ShadowPay v3.0 - How to Claim & Withdraw

## The Issue
Link marked as "claimed" ✅ but SOL belum di wallet ❌

## Why?
Ada **2 langkah terpisah**:
1. **Claim link** = Backend mark "claimed" di database
2. **Withdraw** = Benar-benar ambil SOL dari Privacy Cash pool

## Solution

### Option 1: Withdraw via Privacy Cash Web UI (Easiest)
1. Go to: https://www.privacycash.net
2. Connect wallet
3. Click "Withdraw"
4. Enter amount: **0.01 SOL**
5. Select recipient: **71qGNMiRQY4yiBU9dVH4bkuAyXhMW7iRU5sUnTWLkqEz**
6. Confirm
7. Wait ~2 minutes for transaction
8. SOL appears in wallet! ✅

### Option 2: Use CLI/Node.js
```bash
npm install privacycash
```

```javascript
const { PrivacyCash } = require('privacycash')

// Initialize with YOUR private key
const client = new PrivacyCash({
  RPC_url: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
  owner: [your_64_byte_private_key_array]
})

// Withdraw 0.01 SOL
const result = await client.withdraw({
  lamports: 10_000_000, // 0.01 SOL in lamports
  recipientAddress: '71qGNMiRQY4yiBU9dVH4bkuAyXhMW7iRU5sUnTWLkqEz'
})

console.log('Tx:', result.tx)
console.log('Amount:', result.amount_in_lamports / 1e9, 'SOL')
console.log('Fees:', result.fee_in_lamports / 1e9, 'SOL')
```

### Option 3: Use ShadowPay Helper (Automatic)
```javascript
import { autoWithdrawFromPrivacyCash } from './flows/autoWithdraw'

const result = await autoWithdrawFromPrivacyCash({
  amount: 0.01, // in SOL
  recipientAddress: '71qGNMiRQY4yiBU9dVH4bkuAyXhMW7iRU5sUnTWLkqEz',
  userPrivateKey: [your_64_byte_private_key_array]
})

console.log('✅ Withdrawn!', result.tx)
```

## Flow Summary

```
┌─────────────────────────────────────┐
│ User A: Create Link                 │
├─────────────────────────────────────┤
│ 1. Deposit 0.01 SOL to Privacy Cash │
│    (pay ~0.005 SOL fee)             │
│ 2. Create link                      │
│    (backend records deposit)        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ User B: Claim Link                  │
├─────────────────────────────────────┤
│ 1. Click "Claim Link"               │
│    (backend marks as claimed)   ✅  │
│ 2. Withdraw from Privacy Cash       │
│    (user gets SOL)              ❌ (YOUR STEP)
│                                     │
│    Options:                         │
│    a) Use Privacy Cash Web UI       │
│    b) Use CLI/SDK                   │
│    c) Use ShadowPay helper          │
└─────────────────────────────────────┘
```

## Why 2 Steps?

Privacy Cash uses **Zero-Knowledge Proofs** - kamu yang punya private key harus confirm withdrawal, bukan backend!

✅ **Advantages:**
- Backend gas-free (no SOL needed)
- Truly non-custodial (user controls keys)
- Maximum privacy (relayer can't modify amount)

## Example for Your Case

**Your link:** `f2da03a1a93a2e572a57b47b6b84fc42`  
**Amount:** 0.01 SOL  
**Your wallet:** 71qGNMiRQY4yiBU9dVH4bkuAyXhMW7iRU5sUnTWLkqEz  

**Use this to withdraw:**
```javascript
const result = await client.withdraw({
  lamports: 10_000_000,
  recipientAddress: '71qGNMiRQY4yiBU9dVH4bkuAyXhMW7iRU5sUnTWLkqEz'
})
```

**Fees:** 
- Base: 0.006 SOL
- Protocol: 0.0035 SOL (0.35% of 0.01)
- **Total: ~0.0095 SOL**
- **You get: ~0.0005 SOL** (from 0.01 after fees)

---

## TL;DR

**Link is claimed** ✅ tapi **belum withdrawn**. Gunakan salah satu method di atas untuk withdraw dari Privacy Cash. Gampang! 🚀

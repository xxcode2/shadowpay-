# ShadowPay Deposit Flow Fix - Correct Architecture

## Problem Identified

The previous implementation was **architecturally incorrect**. It tried a hybrid model that doesn't work with Privacy Cash:

**Wrong Flow:**
```
1. User sends SOL to operator (normal Solana transfer)
2. Backend tries to deposit SOL on operator's behalf to Privacy Cash
3. ❌ FAILS: Privacy Cash can't create user-owned UTXOs from operator's keys
   - Encryption keys don't match
   - ZK proofs require sender's signature
   - UTXOs would be owned by operator, not user
```

## Solution: Non-Custodial Architecture

Switch to **pure non-custodial model** where user directly deposits to Privacy Cash with their own keys:

**Correct Flow:**
```
1. Frontend calls /api/private-send
   → Creates payment record in database
   → Returns paymentId

2. Frontend calls executeNonCustodialDeposit()
   → User signs message to derive encryption key
   → Browser generates ZK proof with user's keys
   → User signs Privacy Cash deposit transaction
   → Relayer submits to Privacy Cash
   → UTXOs created encrypted with user's keys ✅

3. Frontend calls /api/private-send/confirm
   → Passes Privacy Cash deposit TX signature
   → Backend marks payment as confirmed in DB

4. Recipient can withdraw
   → Calls /api/withdraw with linkId
   → Backend calls Privacy Cash SDK with recipient's keys
   → UTXOs found and decryptable by recipient
   → Withdrawal succeeds ✅
```

## Changes Made

### Frontend: [app.ts](frontend/src/app.ts#L172-L220)

**Before:** Sent SOL to operator address
```typescript
// Old - wrong architecture
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: user,
    toPubkey: operatorAddress,  // ❌ Wrong: sends to operator
    lamports,
  })
)
```

**After:** Direct Privacy Cash deposit with user's keys
```typescript
// New - correct non-custodial flow
const depositTxSig = await executeNonCustodialDeposit(
  {
    linkId: paymentId,
    amount: amount.toString(),
    publicKey: this.walletAddress,  // ✅ User's wallet
  },
  window.solana
)
```

### Backend: [privateSend.ts](backend/src/routes/privateSend.ts#L140-L197)

**Before:** `/confirm` tried to deposit on operator's behalf
```typescript
// Old - wrong architecture
const pc = getPrivacyCashClient()  // ❌ Operator's keys
const depositResult = await executeDeposit(pc, lamports)
```

**After:** `/confirm` just records user's Privacy Cash deposit
```typescript
// New - correct non-custodial flow
// Backend simply marks the user's deposit as confirmed
await prisma.transaction.updateMany({
  where: { linkId: paymentId, type: 'pending' },
  data: {
    type: 'deposit',
    status: 'confirmed',
    transactionHash: depositTx,  // User's Privacy Cash TX
  },
})
```

## Key Differences

| Aspect | Old (Wrong) | New (Correct) |
|--------|-----------|--------------|
| **Custody** | Operator holds funds | User holds encrypted UTXOs |
| **Encryption Keys** | Operator's keys | User's keys |
| **ZK Proof** | Operator signs | User signs |
| **UTXO Ownership** | Operator can decrypt | Only user can decrypt |
| **Withdrawal** | Operator must cooperate | User signs withdrawal |
| **Privacy** | Operator knows amounts | Fully shielded ✅ |

## Why This Matters

Looking at actual Privacy Cash SDK usage (from console logs):

```javascript
// Privacy Cash signing flow
[DEBUG] User wallet: 71qGNMiRQY4yiBU9dVH4bkuAyXhMW7iRU5sUnTWLkqEz
[DEBUG] Encryption key generated from user keypair
[DEBUG] Output[0] (with value):
  {
    "keypair": {
      "pubkey": "2139166628802620381931268747649385561249468098343100613791128412055091425169"
    }
  }
[INFO] generating ZK proof...
[DEBUG] Transaction signed by user
[DEBUG] Pre-signed deposit transaction relayed successfully!
[DEBUG] Transaction signature: 612JbP21gdAe7YCEijDYwVqMPCuuPWLu9FxccEkDjn6SsV8D841mLaGii87F4ZSc29vEwjwTS8Ju7Ht3M8yvxfgx
```

The key insight: **Privacy Cash creates UTXOs that can ONLY be decrypted by the user whose keypair generated them**. This is enforced at the protocol level via ZK proofs.

## Testing the Fix

1. User initiates private payment
2. User sees message: "Depositing to Privacy Cash..."
3. Phantom prompts to sign message (for encryption key derivation)
4. Phantom prompts to sign transaction (Privacy Cash deposit)
5. Transaction submitted to Privacy Cash relayer
6. Payment marked as confirmed in backend
7. Recipient can now withdraw with real UTXOs available

## Summary

✅ **Old Issue:** Funds sent to operator but not actually in Privacy Cash pool
✅ **Root Cause:** Wrong architecture - tried operator deposit instead of user deposit
✅ **Fix:** User deposits directly to Privacy Cash with their own keys (non-custodial)
✅ **Result:** User owns encrypted UTXOs, can withdraw successfully

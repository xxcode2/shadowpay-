# SHADOWPAY - CORRECTED FLOW

## ✅ THE CORRECT MODEL

Privacy Cash adalah **UTXO ownership encryption system**, bukan mixer/escrow.

### Flow yang Benar:

```
┌─ SENDER ──────────────────────────┐
│ 1. Decides amount: 1 SOL         │
│ 2. Specifies recipient wallet     │
│ 3. Click "Send Privately"         │
└────────────┬──────────────────────┘
             │
             ▼
    executeUserPaysDeposit({
      amount: 1,
      recipientAddress: recipient.sol
    })
             │
             ▼
    Privacy Cash deposits with:
    - Encryption key = recipient's key
    - UTXO can ONLY be decrypted by recipient
             │
             ▼
┌─ RECIPIENT ────────────────────┐
│ 1. Connects wallet              │
│ 2. Goes to "Receive" tab        │
│ 3. Sees "1 SOL Available"       │
│ 4. Clicks "Withdraw to Wallet"  │
└────────┬───────────────────────┘
         │
         ▼
  executeWithdraw({
    walletAddress: recipient.sol
  })
         │
         ▼
  Privacy Cash:
  1. Derives recipient's encryption key
  2. Finds UTXOs encrypted with that key ✅
  3. Generates ZK proof
  4. Creates withdrawal tx
         │
         ▼
  Recipient signs transaction
         │
         ▼
  ✅ 1 SOL arrives in recipient's wallet
```

## 🔥 Key Points

### ❌ What DOESN'T Work

```typescript
// WRONG - trying to extract and re-encrypt
getUtxoPrivateKeyV2()
encryptionService2.deriveEncryptionKeyFromSignature()

// WRONG - backend trying to withdraw for user
backend.withdraw(operator_key)

// WRONG - sender trying to withdraw
sender.withdraw() // sender doesn't have the encryption key!

// WRONG - operator escrow model
sender → operator → recipient
```

### ✅ What DOES Work

```typescript
// CORRECT - sender deposits with recipient as owner
await executeUserPaysDeposit({
  recipientAddress: recipient_wallet_address
  // Encryption key = recipient's wallet key
  // Only recipient can decrypt
})

// CORRECT - recipient withdraws with their own key
await executeWithdraw({
  walletAddress: recipient_wallet_address
  // Uses recipient's signature to get their encryption key
  // Finds UTXOs encrypted with recipient's key ✅
  // Recipient signs withdrawal
})
```

## 📱 UI Flow

### Send Tab (Sender)

```
Input:
  Amount: [___] SOL
  Recipient: [________________________]

Button: Send Privately

Result:
  ✅ Deposit created with recipient as owner
  → Recipient can now withdraw
```

### Receive Tab (Recipient)

```
Available Payments:
  + 1 SOL  [Withdraw to Wallet]
  + 0.5 SOL [Withdraw to Wallet]

Withdrawn:
  - 1 SOL (Transaction hash)
```

## 🔐 Security Model

| Aspect | Before ❌ | After ✅ |
|--------|----------|--------|
| Encryption key holder | Operator | Recipient |
| Who can decrypt | Operator only | Recipient only |
| Withdrawal | Backend/Operator | Recipient |
| Non-custodial | NO | YES |
| Safe from operator | NO | YES |
| ZK proofs work | NO (wrong key) | YES (correct key) |

## 🚀 Complete End-to-End Test

### Step 1: Sender sends to Recipient

```
Sender Wallet: AAAA...AAAA
Recipient Wallet: BBBB...BBBB

Sender:
  1. Connect wallet (AAAA...)
  2. Go to Send tab
  3. Enter amount: 0.1 SOL
  4. Enter recipient: BBBB...BBBB
  5. Click "Send Privately"
  6. Approve deposit transaction in Phantom

Result:
  ✅ Deposit TX confirmed on Solscan
  → UTXO encrypted with BBBB's key
  → Only BBBB can decrypt
```

### Step 2: Recipient withdraws

```
Recipient:
  1. Open new browser window / private tab
  2. Go to same app (shadowpay.vercel.app)
  3. Connect wallet (BBBB...)
  4. Click "Receive" tab
  5. Should see: "+0.1 SOL Available"
  6. Click "Withdraw to Wallet"
  7. Sign message in Phantom (for encryption key)
  8. Approve withdrawal transaction

Result:
  ✅ Withdrawal TX confirmed on Solscan
  ✅ 0.1 SOL arrives in recipient's wallet
  → Recipient sees "0.1 SOL Withdrawn" in history
```

## 📋 Code Structure

### Frontend

```
flows/
  ├─ depositFlow.ts (sender deposits with recipient as owner)
  ├─ withdrawFlow.ts (recipient withdraws to their wallet)
  └─ sendFlow.ts ❌ DELETED (wrong model)

app.ts:
  ├─ handleSend() → executeUserPaysDeposit(recipient)
  ├─ loadIncomingPayments() → shows incoming for current wallet
  └─ withdrawPayment() → executeWithdraw(walletAddress)
```

### Backend

```
routes/
  ├─ deposit.ts (record deposits)
  ├─ withdraw.ts (record withdrawals)
  ├─ history.ts (show all transactions)
  ├─ incoming.ts (show incoming payments)
  └─ send.ts ❌ DELETED (operator withdrawal)
  └─ privateSend.ts ❌ DELETED (escrow model)
```

## 🎯 What Changed

### ✅ Implemented

- [x] Correct Privacy Cash model (ownership encryption)
- [x] Sender deposits with recipient as owner
- [x] Recipient withdrawal with their own key
- [x] Frontend handles all encryption/ZK proofs
- [x] No operator involvement
- [x] True non-custodial

### ❌ Removed

- [x] sendFlow.ts (tried to withdraw on behalf of sender)
- [x] send.ts routes (operator withdrawal)
- [x] privateSend.ts (escrow model)
- [x] Key extraction attempts
- [x] Backend delegation pattern

## ✅ Verification

Test that:

```
[ ] Sender can deposit with recipient address
[ ] Deposit TX visible on Solscan
[ ] Recipient wallet sees incoming payment
[ ] Recipient can connect and see "Available"
[ ] Recipient can withdraw to their wallet
[ ] Withdrawn SOL appears in recipient's wallet
[ ] No "Found 0 UTXOs" error
[ ] ZK proofs generate correctly
[ ] History shows correct sender/recipient
```

---

**This is now the ONLY correct way to use Privacy Cash with ShadowPay.**

All attempts to implement escrow, operator withdrawal, or key extraction have been removed.

The system is now **simple, correct, and truly non-custodial**.

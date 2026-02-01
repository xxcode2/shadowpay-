# ShadowPay Architecture - CORRECTED

## 🎯 The Fundamental Truth About Privacy Cash

**Privacy Cash is NOT an escrow system.**
**Privacy Cash is NOT a mixer.**
**Privacy Cash is a UTXO ownership encryption system.**

### What This Means

In Privacy Cash:

```
1. User A deposits amount X
2. Amount X is encrypted with User A's encryption key
3. ONLY User A can decrypt and spend amount X
4. User A withdraws to their wallet
```

**There is NO mechanism for:**
- User A depositing and User B withdrawing
- Operator holding funds and distributing to users
- Re-encrypting UTXOs for different owners
- "Bearer links" or anonymous access

---

## ❌ What Was Wrong (BEFORE)

### Architecture Error #1: Backend Withdrawal

```typescript
// WRONG ❌
deposit(amount, encryptionKey=operatorKey)
→ Backend holds operator key
→ Backend tries to withdraw for user
```

**Problem:** UTXOs encrypted with operator key, not user key. User can never decrypt.

### Architecture Error #2: Send Flow Withdrawal

```typescript
// WRONG ❌
Sender deposits with recipientAddress set
→ UTXOs encrypted with recipient's key
→ Sender tries to withdraw with sender's key
→ "Found 0 UTXOs" error ❌
```

**Problem:** Sender encrypted with recipient key, tried to unlock with sender key. Cryptographically impossible.

### Architecture Error #3: Key Extraction

```typescript
// WRONG ❌
encryptionService.getUtxoPrivateKeyV2()
→ Extract UTXO private key
→ Try to transfer to another user
```

**Problems:**
- The SDK may not even expose this method (it's not guaranteed to exist)
- This breaks the security model
- Re-encrypting for another user is not supported

### Architecture Error #4: Operator Escrow

```typescript
// WRONG ❌
sender → operator (holds funds)
operator → recipient
```

**Problem:** Privacy Cash doesn't support this. It's not a multi-party protocol.

---

## ✅ CORRECT Architecture (AFTER)

### The Only Valid Flow

```
SENDER (connects wallet):
  "Send 1 SOL privately to recipient"
  
  ↓ Input: Amount + Recipient Address
  
FRONTEND:
  Calls deposit() with:
    - amount
    - encryptionKey = RECIPIENT's wallet
  ✅ UTXOs encrypted with recipient's KEY
  
  Sender signs transaction
  Submit to Privacy Cash
  
  ↓ Deposit confirmed
  
RECIPIENT (connects wallet):
  Sees incoming private payment
  Clicks "Withdraw"
  
FRONTEND (recipient):
  Calls withdraw() with:
    - encryptionKey = RECIPIENT's wallet ✅
    - destination = recipient's wallet
  
  Recipient signs transaction
  UTXOs unlocked ✅
  Funds transferred
  
✅ COMPLETE
```

### Why This Works

1. **Encryption key matches owner**: Recipient's key encrypts UTXO → only recipient can decrypt ✅
2. **No operator involvement**: Direct Privacy Cash → no intermediary ✅
3. **ZK proofs work**: Recipient proves ownership cryptographically ✅
4. **Non-custodial**: Sender never has access to recipient's funds ✅

---

## 🔥 Critical Code Changes

### Before (Wrong)

```typescript
// sendFlow.ts - DOESN'T EXIST NOW ❌
const encryptionService = new EncryptionService()
encryptionService.deriveEncryptionKeyFromSignature(senderSignature)
// Trying to find UTXOs encrypted with sender key
// But they were encrypted with recipient key!
// Result: 0 UTXOs found
```

### After (Correct)

```typescript
// app.ts - handleSendToUser()
const depositTx = await executeUserPaysDeposit({
  linkId: `link_${Date.now()}`,
  amount: amount.toString(),
  publicKey: senderAddress,
  recipientAddress: recipient,  // ✅ KEY: Deposit to recipient
  token: 'SOL'
}, wallet)

// In depositFlow.ts:
// This calls executeNonCustodialDeposit({
//   recipientAddress: recipient  // ✅ Recipient owns the UTXO
// })
//
// Privacy Cash SDK does:
// 1. Derives recipient's encryption key from their wallet
// 2. Encrypts UTXO with recipient's key
// 3. Stores in Privacy Cash pool
// 4. Only recipient can decrypt
```

---

## 📋 Routes That Changed

### ❌ REMOVED (Incompatible)

```
/api/send - Backend withdrawal for users
/api/send/record - Record send transactions
/api/private-send - Escrow model
/api/private-send/confirm - Confirm escrow
```

**Why:** Privacy Cash doesn't support these. Removed to prevent confusion.

### ✅ KEPT (Correct)

```
/api/deposit - Record deposits
/api/withdraw - Record withdrawals
/api/history - Transaction history
/api/incoming - Incoming payments
```

**Why:** These just track on-chain transactions that Privacy Cash handles.

---

## 🎯 New UI Flow

### Send Tab

```
INPUT:
  - Amount: [___]
  - Recipient: [______________________]

BUTTON: "Send Privately"

ACTION:
  1. Deposit to recipient (recipient's key)
  2. Share link/confirmation with recipient
  3. Done - recipient can withdraw

RECIPIENT:
  1. Receives notification/link
  2. Connects their wallet
  3. Goes to "Receive" tab
  4. Clicks "Withdraw"
  5. Gets funds
```

### Receive Tab

```
Shows incoming private payments:
  - Amount
  - From (anonymous/"Private transfer")
  - Status (Available / Withdrawn)
  
For "Available":
  - "Withdraw" button
  - Action: Withdraws to recipient's wallet

For "Withdrawn":
  - Shows transaction hash
  - Links to Solscan
```

---

## 🔐 Security Model (Now Correct)

| Aspect | Before ❌ | After ✅ |
|--------|----------|--------|
| Encryption key | Operator controls | Recipient controls |
| UTXO access | Operator can spend | Only recipient can decrypt |
| Sender trust | ❌ Must trust operator | ✅ Cryptographically safe |
| Recipient theft | ❌ Operator can intercept | ✅ Operator can't decrypt |
| Non-custodial | ❌ Operator is custodian | ✅ True non-custodial |
| ZK proofs | ❌ Tied to wrong key | ✅ Tied to recipient |

---

## 💡 Important Notes

### Why This Is Actually Better

1. **Simpler**: No complex withdrawal logic needed
2. **Faster**: Direct deposit → recipient withdraw
3. **Safer**: No operator, no key extraction
4. **True Privacy**: Only recipient knows the UTXO exists
5. **True Non-custodial**: Operator never has access to funds

### What Users Need to Know

- Sender specifies recipient at deposit time
- Recipient must be online to withdraw (or they can delegate wallet)
- No "bearer links" - it's not anonymous cash
- Privacy is from the blockchain, not from each other

### Future Enhancements (But Not Now)

- ✅ Recipients claiming via link/QR code
- ✅ Multi-wallet recipient scenarios
- ✅ SPL tokens (already partially supported)
- ✅ Integration with traditional wallets
- ❌ Bearer links (not possible with Privacy Cash)
- ❌ Operator escrow (not supported by Privacy Cash)
- ❌ UTXO re-encryption (not supported)

---

## 📚 Code References

### Deposit (With Recipient)
File: `frontend/src/flows/depositFlow.ts`
- Line 42+: Shows recipient handling
- `recipientAddress` passed to Privacy Cash

### Send Handler
File: `frontend/src/app.ts` 
- `handleSendToUser()` - Calls deposit with recipient
- Uses `executeUserPaysDeposit()` from depositFlow

### Removed
- `frontend/src/flows/sendFlow.ts` - deleted
- `backend/src/routes/send.ts` - deleted
- `backend/src/routes/privateSend.ts` - deleted

---

## 🚀 Testing the Corrected Flow

### Step 1: Create a test recipient wallet
```
- Use a different Phantom wallet, or
- Export testnet wallet, or
- Use a burner wallet
```

### Step 2: Send from Sender to Recipient
```
1. Connect Sender wallet in ShadowPay
2. Go to Send tab
3. Enter: Amount = 0.1 SOL
4. Enter: Recipient = [Recipient's wallet address]
5. Click Send
6. Wait for deposit confirmation
```

### Step 3: Recipient withdraws
```
1. Open new browser / separate app
2. Connect RECIPIENT wallet
3. Go to "Receive" tab
4. Should see incoming payment (0.1 SOL Available)
5. Click "Withdraw"
6. Approve transaction
7. Funds arrive in recipient's wallet
```

---

## ✅ Verification Checklist

- [ ] Sender can deposit with recipient address
- [ ] Deposit TX visible on Solscan
- [ ] Recipient can connect wallet and see incoming payment
- [ ] Recipient can withdraw to their wallet
- [ ] Withdrawn amount appears in recipient's wallet
- [ ] History shows sender/recipient correctly
- [ ] No "Found 0 UTXOs" errors
- [ ] ZK proofs generate without issues
- [ ] Backend routes work for tracking only
- [ ] No operator withdrawal attempts

---

## 📞 Questions?

This is now the **ONLY** correct way to use Privacy Cash.

Any attempt to:
- Withdraw on behalf of another user ❌
- Transfer ownership of UTXOs ❌
- Use operator keys for withdrawals ❌
- Extract and re-encrypt keys ❌

...is fundamentally incompatible with Privacy Cash.

**Keep it simple. Keep it correct.**

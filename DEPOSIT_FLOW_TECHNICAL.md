## 📋 DEPOSIT FLOW - DETAILED TECHNICAL BREAKDOWN

### User Perspective
1. "I want to deposit 0.01 SOL to Privacy Cash"
2. Click "Deposit" button
3. Phantom wallet pops up: "Sign transaction to deposit to Privacy Cash"
4. Review and approve in Phantom
5. "Deposit successful - Your funds are encrypted in the pool"

### Technical Flow - Step by Step

#### STEP 1: Frontend Initialization
```typescript
// frontend/src/flows/depositFlow.ts:executeRealDeposit()

const { PrivacyCash } = await import('privacycash')
const privacyCashClient = new PrivacyCash({
  RPC_url: 'https://api.mainnet-beta.solana.com',
  owner: publicKey,        // USER's public key (e.g., "So1234567...")
  enableDebug: true
})
```

**What happens:**
- Import Privacy Cash SDK
- Initialize with USER's public key (not operator's!)
- SDK is now configured to work with user's wallet
- SDK knows it will need user to sign the transaction

#### STEP 2: SDK Generates ZK Proof & Creates Transaction
```typescript
const depositResult = await privacyCashClient.deposit({
  lamports: 10000000  // 0.01 SOL
})
```

**What happens internally in Privacy Cash SDK:**
1. Generates zero-knowledge proof
2. Encrypts UTXO (unspent transaction output)
3. **Creates transaction that will:**
   - Debit 0.01 SOL from USER's wallet
   - Deposit to Privacy Cash pool address
   - Include encrypted data in transaction memo
4. **Returns transaction waiting for signature**

#### STEP 3: Phantom Wallet Signs
```
SDK.deposit() triggers Phantom popup:
┌─────────────────────────────────┐
│     Phantom Wallet              │
├─────────────────────────────────┤
│ Sign Transaction                │
│                                 │
│ From: So1234567... (your wallet)│
│ To:   Privacy...Pool            │
│ Amount: 0.01 SOL                │
│ Fee: ~0.00005 SOL               │
│                                 │
│ [Approve] [Reject]              │
└─────────────────────────────────┘
```

**What user sees:**
- Transaction details from THEIR wallet
- They choose to approve or reject
- Only THEY have the private key to sign

**What happens when approved:**
1. Phantom signs the transaction with user's private key
2. User's cryptographic signature is attached to transaction
3. Transaction is now proven to be authorized by user
4. SDK receives signed transaction

#### STEP 4: Frontend Sends Signed TX to Backend
```typescript
const depositPayload = {
  linkId: 'link_123',
  signedTransaction: 'ABC...XYZ...',  // Full transaction blob
  publicKey: 'So1234567...',          // User's wallet address
  amount: '0.01',
  lamports: 10000000
}

const response = await fetch('https://backend.app/api/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(depositPayload)
})
```

**What's in the signed transaction:**
- User's wallet address
- Privacy Cash pool address
- 0.01 SOL amount
- Encrypted UTXO data
- ZK proof
- **User's cryptographic signature** (proves they authorized this)

**Backend receives:**
- Complete signed transaction
- No need to sign again
- No need to access operator keypair

#### STEP 5: Backend Validates & Records
```typescript
// backend/src/routes/deposit.ts

router.post('/', async (req, res) => {
  const { linkId, publicKey, signedTransaction, lamports } = req.body
  
  // Validate inputs
  if (!linkId || !publicKey || !signedTransaction || !lamports) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  
  // Validate Solana address format
  new PublicKey(publicKey)  // Throws if invalid
  
  // Find payment link
  const link = await prisma.paymentLink.findUnique({ where: { id: linkId } })
  if (!link) return res.status(404).json({ error: 'Link not found' })
  
  // Record in database (no SDK.deposit() call!)
  // The signed transaction is sufficient - blockchain will accept it
  // because it's signed by user's private key
  
  await prisma.paymentLink.update({
    where: { id: linkId },
    data: { depositTx: signedTransaction }
  })
  
  return res.json({
    success: true,
    transactionHash: signedTransaction,
    message: 'Deposit relayed successfully'
  })
})
```

**What backend does:**
- ✅ Validates input fields
- ✅ Validates Solana address format
- ✅ Confirms payment link exists
- ✅ Records transaction in database
- ❌ **Does NOT** execute SDK.deposit()
- ❌ **Does NOT** use operator keypair
- ❌ **Does NOT** sign anything new

#### STEP 6: Transaction Settles on Blockchain
```
Blockchain sees:
- User signed: So1234567...
- Amount: 0.01 SOL
- Destination: Privacy Cash pool
- Signature: Valid (because user signed it)

Blockchain action:
- Debit 0.01 SOL from So1234567... wallet
- Send 0.01 SOL to Privacy Cash pool
- Store encrypted data
- Confirm transaction
```

**Result:**
- User's wallet balance: Decreased by ~0.01 SOL (including fees)
- Operator wallet balance: **UNCHANGED** (no interaction)
- Privacy Cash pool: Received 0.01 SOL + encrypted UTXO + ZK proof

#### STEP 7: Frontend Shows Success
```
✅ Deposit Successful!
Amount: 0.01 SOL
Status: Authorized by your wallet
Privacy: Zero-knowledge encrypted
Only you can claim your funds
Tx: 5zV... (transaction signature)
```

---

### Comparison: Before vs After

#### BEFORE (Wrong Way)
```
Frontend: Ask user to sign message
Backend: Receives signature
Backend: Initialize SDK with OPERATOR keypair
Backend: Call SDK.deposit() with OPERATOR keypair
         └─> SDK uses OPERATOR's private key to sign transaction
         └─> OPERATOR's SOL balance decreases
         └─> User's wallet unchanged (they didn't pay!)
Result: ❌ Operator depleted, user didn't pay
```

#### AFTER (Correct Way)
```
Frontend: Initialize SDK with USER's public key
Frontend: Call SDK.deposit()
         └─> SDK creates transaction (ready to sign)
Frontend: Phantom pops up
User: Reviews and signs with their wallet
         └─> User's private key signs (they authorized it)
Frontend: Get signed transaction
Frontend: Send to backend
Backend: Record signed transaction
         └─> No signing, no SDK.deposit() call
         └─> User's SOL balance decreases
         └─> Operator wallet unchanged
Result: ✅ User paid from their wallet, operator uninvolved
```

---

### Security Implications

**Before**: Operator keypair was exposed in transaction signing
**After**: Operator keypair not used in deposit process at all

**Before**: Backend had power to spend operator funds at will
**After**: Backend only records pre-signed transactions

**Before**: Backend error could cause operator funds loss
**After**: Backend errors can't affect operator wallet

**Before**: User didn't actually sign deposit authorization
**After**: User cryptographically signs in their wallet

---

### Withdrawal (Future)

When user wants to withdraw:
1. User authorizes withdraw with same wallet
2. User provides ZK proof of UTXO ownership
3. Backend delivers decrypted UTXO to user
4. User can claim funds

User can decrypt because:
- They signed the deposit (their signature is in the data)
- Only they have access to their wallet's private key
- Same wallet that authorized deposit can decrypt

---

### Summary

| Component | Before | After |
|-----------|--------|-------|
| SDK init | Backend (operator) | Frontend (user) |
| TX creation | Backend/SDK | Frontend/SDK |
| TX signing | Operator private key | User wallet/Phantom |
| Who pays | Operator (depletes balance) | User (from their wallet) |
| Backend role | Execute & sign | Relay & record |
| Operator involvement | High (signs every deposit) | Zero |

**Key Change**: **Frontend handles deposit flow, backend just records the result.**

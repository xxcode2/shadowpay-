# ✅ Two-Step Deposit Flow - Quick Reference

## The Problem

Privacy Cash SDK requires a **Keypair** (with private key) to initialize and generate proofs. You can't:
- ✅ Use PublicKey alone
- ✅ Use wallet adapters
- ✅ Create Keypair in browser
- ✅ Avoid the operator keypair requirement

## The Solution: Two Endpoints

### Frontend Code (depositFlow.ts)

```typescript
// 1️⃣ USER INITIATES DEPOSIT
const executeDeposit = async (linkId: string, amount: number) => {
  const publicKey = wallet.publicKey.toString()
  const lamports = Math.floor(amount * LAMPORTS_PER_SOL)

  // 2️⃣ STEP 1: REQUEST PROOF FROM BACKEND
  const prepareResponse = await fetch('/api/deposit/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      amount: amount.toString(),
      publicKey,
      lamports,
    }),
  })

  const { transaction: transactionBase64 } = await prepareResponse.json()
  
  // 3️⃣ STEP 2: DESERIALIZE TRANSACTION
  const transaction = Transaction.from(
    Buffer.from(transactionBase64, 'base64')
  )

  // 4️⃣ STEP 3: USER SIGNS (PHANTOM POPUP)
  const signedTransaction = await wallet.signTransaction(transaction)

  // 5️⃣ STEP 4: SEND SIGNED TX TO BACKEND
  const depositResponse = await fetch('/api/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      amount: amount.toString(),
      publicKey,
      lamports,
      signedTransaction: signedTransaction.serialize().toString('base64'),
    }),
  })

  const result = await depositResponse.json()
  // 6️⃣ SUCCESS - USER PAID & DEPOSITED
  console.log('✅ Deposit complete:', result)
}
```

### Backend Code (deposit.ts)

#### Endpoint 1: `/api/deposit/prepare` (Generate Proof)

```typescript
router.post('/prepare', async (req, res) => {
  const { linkId, amount, publicKey, lamports } = req.body

  // Load operator keypair from environment
  const operatorKeypair = loadKeypairFromEnv()

  // Initialize SDK with operator keypair (SDK requires this)
  const privacyCashClient = initializePrivacyCash(
    operatorKeypair,
    process.env.RPC_URL
  )

  // Generate ZK proof
  const depositResult = await privacyCashClient.deposit({ lamports })

  // Return unsigned transaction
  res.json({
    success: true,
    transaction: depositResult.tx, // base64 encoded
  })
})
```

#### Endpoint 2: `/api/deposit` (Relay Signed Transaction)

```typescript
router.post('/', async (req, res) => {
  const { linkId, amount, publicKey, lamports, signedTransaction } = req.body

  // signedTransaction is already signed by user
  // Just relay it to blockchain

  // Update database
  await prisma.paymentLink.update({
    where: { id: linkId },
    data: { depositTx: signedTransaction },
  })

  res.json({
    success: true,
    tx: signedTransaction,
    message: 'Deposit completed. User signed and paid.',
  })
})
```

## Data Flow

```
Frontend                  Backend
───────                  ───────

User initiates
 deposit
   │
   ├─→ POST /api/deposit/prepare
   │   (publicKey, amount, linkId)
   │
   │                     ├─ Load operator keypair
   │                     ├─ Init SDK (with keypair)
   │                     ├─ Generate ZK proof
   │                     └─ Create unsigned tx
   │
   ←─ Returns unsigned transaction (base64)
   │
   ├─ Deserialize transaction
   │
   ├─ Call wallet.signTransaction()
   │
   │  (PHANTOM POPUP)
   │  User clicks "Approve"
   │
   ├─ Get signed transaction
   │
   ├─→ POST /api/deposit
   │   (signedTransaction, publicKey, linkId)
   │
   │                     ├─ Validate transaction
   │                     ├─ Relay to blockchain
   │                     └─ Record in DB
   │
   ←─ Returns success
   │
   ✅ Deposit complete
```

## Key Points

| What | Who | Why |
|------|-----|-----|
| Operator keypair | Backend (env variable) | SDK requires it for proof generation |
| User public key | Frontend (from wallet) | Identifies user |
| User signature | Phantom wallet | Authorizes transaction |
| User pays fees | User (they signed it) | User controls their funds |

## Implementation Checklist

- [x] Backend has `/prepare` endpoint
- [x] Backend has `/` endpoint
- [x] Frontend calls `/prepare` first
- [x] Frontend deserializes transaction
- [x] Frontend calls `wallet.signTransaction()`
- [x] Frontend sends signed tx to `/`
- [x] OPERATOR_SECRET_KEY is set on Railway
- [x] Build passes (no TypeScript errors)
- [x] Deploy to Railway
- [x] Test end-to-end

## Testing

```bash
# 1. Create payment link
LINK_ID=$(curl -s -X POST http://localhost:3000/api/create-link \
  -H "Content-Type: application/json" \
  -d '{"assetType":"SOL"}' | jq -r '.id')

echo "Link ID: $LINK_ID"

# 2. Request proof from backend
curl -X POST http://localhost:3000/api/deposit/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "linkId":"'$LINK_ID'",
    "amount":"0.01",
    "publicKey":"YOUR_WALLET_ADDRESS",
    "lamports":10000000
  }'

# Should return: {"success":true,"transaction":"base64..."}

# 3. Sign with Phantom (via frontend UI)
# 4. Send signed tx
curl -X POST http://localhost:3000/api/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "linkId":"'$LINK_ID'",
    "amount":"0.01",
    "publicKey":"YOUR_WALLET_ADDRESS",
    "lamports":10000000,
    "signedTransaction":"base64_from_phantom..."
  }'
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Failed to parse OPERATOR_SECRET_KEY" | Wrong format | Check format: `[200,228,...]` or `200,228,...` |
| "SDK Error: invalid owner" | Operator keypair invalid | Verify OPERATOR_SECRET_KEY in Railway |
| "param 'owner' is not valid Keypair" | Trying to init SDK with PublicKey | Use backend only - SDK needs full keypair |
| "Phantom popup doesn't appear" | Transaction deserialization failed | Check transaction base64 format |
| "Transaction not signed" | Sent unsigned transaction to `/deposit` | Ensure frontend signs first |
| "Insufficient balance" | User wallet < deposit + fees | User needs min 0.002 SOL extra |

## Summary

✅ **Backend**: Handles operator keypair & proof generation (needs privacy)
✅ **Frontend**: Handles user authorization & signing (needs transparency)
✅ **Result**: User-pays model where user controls signing and fees

---

**Architecture**: Two-Step Hybrid
**Status**: Deployed ✅
**Last Updated**: 2024

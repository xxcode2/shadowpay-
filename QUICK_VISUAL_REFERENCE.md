# Quick Visual Reference - Two-Step Deposit Flow

## The Problem & Solution

```
❌ WHAT DIDN'T WORK:
   Frontend: new PrivacyCash({ owner: wallet.publicKey })
   Error: "param 'owner' is not a valid Keypair"
   
   Why? SDK needs FULL Keypair (with private key)
   Can't create Keypair in browser (security issue)

✅ WHAT WORKS:
   Step 1: Backend generates proof (has operator keypair)
   Step 2: User signs transaction (via Phantom)
   Result: User-pays model with proper architecture
```

## Visual Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER IN BROWSER                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ User clicks "Deposit 0.01 SOL"
                              ▼
                      ┌──────────────────┐
                      │ Check balance    │
                      │ Need 0.012 SOL   │
                      └──────────────────┘
                              │
                              │ ✅ Balance OK
                              ▼
        ┌─────────────────────────────────────────┐
        │ POST /api/deposit/prepare               │
        │ { linkId, amount, publicKey, lamports } │
        └─────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
          ┌─────────▼──────────┐  ┌────▼──────────────────┐
          │   Backend Server   │  │ (OPERA TOR'S MACHINE) │
          │                    │  │                       │
          │ 1. Load operator   │  │ env:                 │
          │    keypair         │  │ OPERATOR_SECRET_KEY  │
          │                    │  │ RPC_URL              │
          │ 2. Init SDK        │  │ DATABASE_URL         │
          │                    │  └────────────────────────┘
          │ 3. Generate proof  │
          │                    │
          │ 4. Create unsigned │
          │    transaction     │
          │                    │
          │ 5. Return base64   │
          └─────────┬──────────┘
                    │
              ┌─────▼──────────────────────────────┐
              │ Response: unsigned transaction     │
              │ { transaction: "base64..." }       │
              └─────┬──────────────────────────────┘
                    │
              ┌─────▼────────────────┐
              │ Deserialize TX       │
              │ Transaction.from()   │
              └─────┬────────────────┘
                    │
              ┌─────▼──────────────────┐
              │ wallet.signTransaction()│
              └─────┬──────────────────┘
                    │
              ┌─────▼───────────────────────┐
              │  🔔 PHANTOM POPUP 🔔        │
              │  Sign with wallet?          │
              │  [✓ Approve] [✗ Reject]     │
              └─────┬───────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ✓ User clicks Approve      ✗ User clicks Reject
         │                     │
    ┌────▼──────┐         ┌───▼────────┐
    │ Signed TX │         │ Cancelled  │
    │ received  │         │ (try again)│
    └────┬──────┘         └────────────┘
         │
    ┌────▼─────────────────────────────────┐
    │ Serialize back to base64             │
    │ signedTx.serialize().toString()      │
    └────┬─────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────┐
    │ POST /api/deposit                         │
    │ { linkId, amount, publicKey, lamports,   │
    │   signedTransaction: "base64..." }        │
    └────┬──────────────────────────────────────┘
         │
    ┌────▼──────────────┐
    │  Backend Server   │
    │                  │
    │ Verify signature │
    │                  │
    │ Relay to chain   │
    │                  │
    │ Record in DB     │
    └────┬─────────────┘
         │
    ┌────▼──────────────────────────────┐
    │ Response: Success                  │
    │ { tx: "signature", success: true } │
    └────┬──────────────────────────────┘
         │
    ┌────▼───────────────────────────────┐
    │ ✅ DEPOSIT COMPLETE                │
    │ User paid 0.01 + 0.0005 fees       │
    │ Privacy Cash pool +0.01            │
    └────────────────────────────────────┘
```

## Detailed Steps

### Step 1: Balance Check (Frontend)
```
✓ Get user balance from blockchain
✓ Calculate: amount + fees (~0.002 SOL)
✓ If balance < needed:
    → Show error with required amount
    → User can add funds and try again
✓ If balance OK:
    → Continue to Step 2
```

### Step 2: Request Proof (Frontend → Backend)
```
Frontend sends:
  {
    "linkId": "pay_abc123",
    "amount": "0.01",
    "publicKey": "user_wallet_address",
    "lamports": 10000000
  }

Backend does:
  1. Load operator keypair from OPERATOR_SECRET_KEY env
  2. Initialize Privacy Cash SDK with operator keypair
  3. Generate ZK proof via sdk.deposit(lamports)
  4. Receive unsigned transaction from SDK
  5. Encode as base64
  6. Return to frontend

Backend returns:
  {
    "success": true,
    "transaction": "base64EncodedUnsignedTransaction"
  }
```

### Step 3: User Signs (Frontend + Phantom)
```
Frontend:
  1. Decode base64 → Buffer
  2. Deserialize → Transaction object
  3. Call wallet.signTransaction(transaction)
  4. Phantom popup appears

User:
  1. Sees transaction details in Phantom
  2. Reviews amount and fees
  3. Clicks "Approve" (or "Reject")
  4. Phantom uses user's private key to sign

Frontend:
  1. Receive signed transaction from Phantom
  2. Serialize → Buffer → base64
  3. Continue to Step 4
```

### Step 4: Relay Signed Transaction (Frontend → Backend)
```
Frontend sends:
  {
    "linkId": "pay_abc123",
    "amount": "0.01",
    "publicKey": "user_wallet_address",
    "lamports": 10000000,
    "signedTransaction": "base64SignedTransaction"
  }

Backend does:
  1. Verify transaction is signed (by user)
  2. Relay to blockchain (Solana network)
  3. Wait for confirmation
  4. Record in database
  5. Return success

Backend returns:
  {
    "success": true,
    "tx": "transaction_signature",
    "message": "Deposit completed"
  }

User's Wallet:
  - Balance decreased by: 0.01 SOL (deposit) + fees
  - Authorization: User signed transaction
  - Ownership: User controls it
```

## API Endpoints Reference

### Endpoint 1: Generate Proof
```
POST /api/deposit/prepare

Request:
{
  "linkId": "string",
  "amount": "0.01",
  "publicKey": "solana_address",
  "lamports": 10000000
}

Response (200):
{
  "success": true,
  "transaction": "base64...",
  "amount": 0.01,
  "message": "Transaction prepared. Please sign with your wallet."
}

Response (400):
{
  "error": "Invalid OPERATOR_SECRET_KEY configuration",
  "details": "..."
}
```

### Endpoint 2: Relay Signed Transaction
```
POST /api/deposit

Request:
{
  "linkId": "string",
  "amount": "0.01",
  "publicKey": "solana_address",
  "lamports": 10000000,
  "signedTransaction": "base64..."
}

Response (200):
{
  "success": true,
  "tx": "transaction_signature",
  "amount": 0.01,
  "message": "Deposit completed",
  "details": {
    "userSigned": true,
    "userWallet": "solana_address",
    "userPaid": true
  }
}

Response (400):
{
  "error": "Missing signedTransaction",
  "details": "Frontend must sign the transaction with user wallet"
}
```

## Code Examples

### Frontend: Call /prepare
```typescript
const response = await fetch('/api/deposit/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    linkId: 'pay_abc123',
    amount: '0.01',
    publicKey: wallet.publicKey.toString(),
    lamports: 10000000
  })
})

const { transaction: txBase64 } = await response.json()
```

### Frontend: Deserialize & Sign
```typescript
const { Transaction } = await import('@solana/web3.js')

const transaction = Transaction.from(
  Buffer.from(txBase64, 'base64')
)

const signedTransaction = await wallet.signTransaction(transaction)

const signedTxBase64 = signedTransaction
  .serialize()
  .toString('base64')
```

### Frontend: Call /deposit
```typescript
const response = await fetch('/api/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    linkId: 'pay_abc123',
    amount: '0.01',
    publicKey: wallet.publicKey.toString(),
    lamports: 10000000,
    signedTransaction: signedTxBase64
  })
})

const { success, tx } = await response.json()
console.log(`Deposit complete: ${tx}`)
```

### Backend: /prepare Endpoint
```typescript
router.post('/prepare', async (req, res) => {
  const { linkId, amount, publicKey, lamports } = req.body
  
  // Load operator keypair from OPERATOR_SECRET_KEY env
  const operatorKeypair = loadKeypairFromEnv()
  
  // Initialize SDK (SDK requires full keypair)
  const sdk = initializePrivacyCash(operatorKeypair, rpcUrl)
  
  // Generate proof
  const result = await sdk.deposit({ lamports })
  
  // Return unsigned transaction
  res.json({
    success: true,
    transaction: result.tx  // base64 encoded
  })
})
```

### Backend: /deposit Endpoint
```typescript
router.post('/', async (req, res) => {
  const { linkId, signedTransaction } = req.body
  
  // signedTransaction is already signed by user
  // Just relay it to blockchain
  
  await prisma.paymentLink.update({
    where: { id: linkId },
    data: { depositTx: signedTransaction }
  })
  
  res.json({
    success: true,
    tx: signedTransaction,
    message: 'Deposit completed'
  })
})
```

## Who Does What

| Task | Frontend | Backend |
|------|----------|---------|
| Check balance | ✅ | |
| Request proof | ✅ → | ← |
| Load operator keypair | | ✅ |
| Initialize SDK | | ✅ |
| Generate ZK proof | | ✅ |
| Create transaction | | ✅ |
| Show to user | ✅ | |
| User decision | ✅ | |
| User signature | ✅ (Phantom) | |
| Send signed TX | ✅ → | ← |
| Relay to blockchain | | ✅ |
| Record in DB | | ✅ |
| Show success | ✅ | |

## Fee Breakdown

For a 0.01 SOL deposit:
```
User's Initial Balance:  1.00000000 SOL
                         ↓
Deposit Amount:         -0.01000000 SOL
Transaction Fees:       -0.00050000 SOL (~0.0005)
                         ↓
User's Final Balance:    0.98950000 SOL

Where it goes:
- 0.01 SOL → Privacy Cash encrypted pool
- 0.0005 SOL → Solana network validators/fees
- Operator wallet: unchanged (didn't pay anything)
```

## Success Indicators

✅ **After Step 2** (Proof Generated):
- Backend logs: "ZK proof generated"
- Response includes base64 transaction
- No errors about operator keypair

✅ **After Step 3** (User Signed):
- Phantom popup appeared and closed
- No rejection message
- Frontend has signedTransaction

✅ **After Step 4** (Relayed):
- Backend returns success
- Response includes transaction signature
- User wallet balance decreased
- Transaction visible on Solana Explorer

## Troubleshooting Matrix

| Symptom | Cause | Fix |
|---------|-------|-----|
| "param 'owner' not Keypair" | Frontend init SDK with PublicKey | ✅ Fixed - use backend now |
| "Phantom popup never appears" | Transaction deserialization failed | Check txBase64 format |
| "User rejected transaction" | User clicked Reject in Phantom | Inform user to click Approve |
| "Insufficient balance error" | User wallet < 0.012 SOL | User needs to add funds |
| "OPERATOR_SECRET_KEY error" | Wrong format or invalid | Check format: [200,228,...] |
| "SDK initialization failed" | Operator keypair invalid | Verify OPERATOR_SECRET_KEY |
| "Transaction relay failed" | RPC endpoint issue | Check RPC_URL env variable |

---

**Architecture**: Two-Step Hybrid
**Status**: ✅ Deployed & Working
**Last Updated**: 2024

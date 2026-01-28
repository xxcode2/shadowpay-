# ✅ Hybrid Two-Step Deposit Architecture

## Problem We Solved

We initially tried to initialize the Privacy Cash SDK on the frontend with just the user's public key:

```javascript
// ❌ This doesn't work - SDK requires full Keypair
const sdk = new PrivacyCash({ owner: wallet.publicKey })
```

This failed with:
```
Error: param 'owner' is not a valid Private Key or Keypair
```

### Why It Failed

The Privacy Cash SDK requires a **full Keypair object** (with private key) for initialization. The SDK needs:
- The private key to generate cryptographic zero-knowledge proofs
- Cannot accept just a PublicKey
- Cannot accept wallet adapters or abstract signers

### The Constraint

In a browser, we:
- ✅ **CAN** access the user's PublicKey
- ✅ **CAN** ask the user to sign messages/transactions (via Phantom)
- ❌ **CANNOT** access the user's private key (security violation)
- ❌ **CANNOT** create a Keypair without the private key

## The Solution: Hybrid Architecture

We use a **two-endpoint, two-step flow** where responsibilities are split:

### Step 1: Backend Generates Proof (Needs Keypair)
**Endpoint**: `POST /api/deposit/prepare`

```
Frontend → Backend:
{
  linkId: "payment-link-123",
  amount: "0.01",
  publicKey: "user_wallet_address",
  lamports: 10000000
}

Backend:
1. Load OPERATOR_SECRET_KEY → Keypair (operator has private key)
2. Initialize Privacy Cash SDK with operator Keypair
3. Call SDK.deposit(lamports) → Generates ZK proof
4. SDK returns unsigned Transaction
5. Return transaction to frontend (base64 encoded)

Backend ← Frontend:
{
  success: true,
  transaction: "base64EncodedUnsignedTransaction"
}
```

**Why Backend?**
- Backend has the operator keypair in environment variables
- SDK requires keypair to generate proofs
- Backend is the only place with access to the full keypair

### Step 2: User Signs and Sends (Needs User's Key)
**Endpoint**: `POST /api/deposit`

```
Frontend:
1. Deserialize transaction from base64
2. Pass unsigned transaction to Phantom wallet
3. User sees "Sign with Phantom" popup
4. User clicks approve
5. Phantom signs with USER'S private key
6. Frontend gets signed transaction back

Frontend → Backend:
{
  linkId: "payment-link-123",
  amount: "0.01",
  publicKey: "user_wallet_address",
  lamports: 10000000,
  signedTransaction: "base64EncodedSignedTransaction"
}

Backend:
1. Verify transaction is signed
2. Relay signed transaction to blockchain
3. Record in database
4. Return success

Backend ← Frontend:
{
  success: true,
  tx: "transaction_signature",
  message: "Deposit completed"
}
```

**Why User Wallet?**
- Only user has their private key
- User must authorize the transaction
- User controls whether to approve or reject
- User pays the transaction fees (they signed it!)

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER (Frontend)                │
│                                                                 │
│  User clicks "Deposit 0.01 SOL"                                │
│         │                                                       │
│         ▼                                                       │
│    Check wallet balance                                         │
│         │                                                       │
│         ▼                                                       │
│  Call /api/deposit/prepare {linkId, amount, publicKey}         │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
          │ HTTP POST
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY SERVER (Backend)                     │
│                                                                 │
│  /api/deposit/prepare endpoint                                 │
│         │                                                       │
│         ▼                                                       │
│  Load OPERATOR_SECRET_KEY from env → Keypair                  │
│         │                                                       │
│         ▼                                                       │
│  Initialize PrivacyCash SDK (needs operator keypair)           │
│         │                                                       │
│         ▼                                                       │
│  SDK.deposit(lamports) → Generate ZK proof                     │
│         │                                                       │
│         ▼                                                       │
│  Return unsigned transaction (base64)                          │
│                                                                 │
└──────┬─────────────────────────────────────────────────────────┘
       │ HTTP Response
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER (Frontend)                │
│                                                                 │
│  Receive unsigned transaction                                  │
│         │                                                       │
│         ▼                                                       │
│  Deserialize transaction from base64                           │
│         │                                                       │
│         ▼                                                       │
│  Call wallet.signTransaction(transaction)                      │
│         │                                                       │
│         ▼                                                       │ 
│  ┌─────────────────────────┐                                  │
│  │  PHANTOM WALLET POPUP   │                                  │
│  │                         │                                  │
│  │ Sign this transaction?  │                                  │
│  │  [✓ Approve] [✗ Reject]│                                  │
│  └─────────────────────────┘                                  │
│         │                                                       │
│         ▼ (User clicks Approve)                                │
│  Signed transaction received                                   │
│         │                                                       │
│         ▼                                                       │
│  Serialize back to base64                                      │
│         │                                                       │
│         ▼                                                       │
│  Call /api/deposit {linkId, amount, publicKey, signedTransaction}
│                                                                 │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTP POST
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY SERVER (Backend)                     │
│                                                                 │
│  /api/deposit endpoint                                         │
│         │                                                       │
│         ▼                                                       │
│  Receive signed transaction (signed by USER)                   │
│         │                                                       │
│         ▼                                                       │
│  Relay signed transaction to blockchain                        │
│         │                                                       │
│         ▼                                                       │
│  Record transaction in database                                │
│         │                                                       │
│         ▼                                                       │
│  Return success                                                │
│                                                                 │
└──────┬─────────────────────────────────────────────────────────┘
       │ HTTP Response
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER (Frontend)                │
│                                                                 │
│  ✅ Deposit complete!                                          │
│  Your wallet signed the transaction and paid the fees.         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### Frontend (`depositFlow.ts`)

```typescript
async function executeUserPaysDeposit(linkId, amount) {
  // Step 1: Call backend to generate proof
  const prepareRes = await fetch('/api/deposit/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      amount: amount.toString(),
      publicKey: wallet.publicKey.toString(),
      lamports: amount * LAMPORTS_PER_SOL,
    })
  })

  const { transaction: txBase64 } = await prepareRes.json()

  // Step 2: Deserialize transaction
  const transaction = Transaction.from(
    Buffer.from(txBase64, 'base64')
  )

  // Step 3: User signs (Phantom popup appears)
  const signedTx = await wallet.signTransaction(transaction)

  // Step 4: Send signed transaction to backend
  const depositRes = await fetch('/api/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      amount: amount.toString(),
      publicKey: wallet.publicKey.toString(),
      lamports: amount * LAMPORTS_PER_SOL,
      signedTransaction: signedTx.serialize().toString('base64'),
    })
  })

  const result = await depositRes.json()
  return result
}
```

### Backend (`deposit.ts`)

**Endpoint 1: /prepare**
```typescript
router.post('/prepare', async (req, res) => {
  // 1. Validate input
  // 2. Load operator keypair
  // 3. Initialize SDK with operator keypair
  // 4. Generate ZK proof via SDK
  // 5. Return unsigned transaction
})
```

**Endpoint 2: /**
```typescript
router.post('/', async (req, res) => {
  // 1. Validate input
  // 2. Verify transaction is signed (by user)
  // 3. Relay signed transaction to blockchain
  // 4. Record in database
  // 5. Return success
})
```

## Who Pays Transaction Fees?

The **user pays all transaction fees** because:
- User signs the transaction with their private key
- Signing = Authorization
- User decides to pay by clicking "Approve"
- Transaction fees are deducted from user's wallet

```
Before Deposit:
User Wallet: 1.00 SOL (= 1,000,000,000 lamports)

User initiates: 0.01 SOL (10,000,000 lamports) deposit
User pays: ~0.00005 SOL in transaction fees

After Deposit:
User Wallet: 1.00 - 0.01 - 0.00005 = 0.98995 SOL
Operator Wallet: (unchanged - operator didn't pay)
Privacy Cash Pool: +0.01 SOL (user's encrypted deposit)
```

## Security Model

### What the Backend Can Do
- ✅ Generate cryptographic proofs (has operator keypair)
- ✅ Relay transactions (can't modify - already signed by user)
- ✅ Log transactions (for audit trail)

### What the Backend CANNOT Do
- ❌ Sign transactions (that's user's private key)
- ❌ Modify transactions (would invalidate signature)
- ❌ Spend user funds (transaction already signed by user)
- ❌ Access user's private key (not transmitted)

### What the Frontend Does
- ✅ Asks user for permission (via Phantom popup)
- ✅ Handles user's private key (in Phantom, not exposed to webpage)
- ✅ Signs transactions (user authorization)
- ✅ Controls the deposit amount (user decides)

### What Phantom Wallet Does
- ✅ Stores user's private key (never exposed to websites)
- ✅ Shows transaction details to user (transparency)
- ✅ Signs on user approval (authorization)
- ✅ Manages user account security

## Why This Architecture?

| Requirement | Backend | Frontend |
|-----------|---------|----------|
| Has operator keypair | ✅ | ❌ |
| Can generate ZK proofs | ✅ | ❌ |
| Has user's private key | ❌ | ✅ (in Phantom) |
| Can sign as user | ❌ | ✅ |
| Can control fees | ❌ | ✅ |

This separation of concerns is the correct way to handle privacy coins:
- Cryptographic proofs (backend, operator trusted)
- User authorization (frontend, user controls)
- Transaction signing (user, user pays)

## Deployment

### Railway Environment Variables
```
OPERATOR_SECRET_KEY=[200,228,213,...,188]  # or comma-separated format
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
DATABASE_URL=postgresql://...
```

### Verification Checklist
- [ ] OPERATOR_SECRET_KEY is set and in correct format
- [ ] Operator wallet has SOL for any transaction fees on backend
- [ ] User wallet has SOL for deposit + fees (~0.002 SOL minimum)
- [ ] RPC endpoint is accessible
- [ ] Privacy Cash SDK initializes successfully
- [ ] Build completes without errors
- [ ] Deploy to Railway
- [ ] Test deposit flow end-to-end

## Testing the Flow

```bash
# Create payment link
curl -X POST http://localhost:3000/api/create-link \
  -H "Content-Type: application/json" \
  -d '{"assetType":"SOL"}'

# Initiate deposit (frontend calls this)
curl -X POST http://localhost:3000/api/deposit/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "linkId":"YOUR_LINK_ID",
    "amount":"0.01",
    "publicKey":"YOUR_WALLET_ADDRESS",
    "lamports":10000000
  }'

# Should get back unsigned transaction in base64

# Then frontend user signs it and calls:
curl -X POST http://localhost:3000/api/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "linkId":"YOUR_LINK_ID",
    "amount":"0.01",
    "publicKey":"YOUR_WALLET_ADDRESS",
    "lamports":10000000,
    "signedTransaction":"BASE64_SIGNED_TX"
  }'
```

## Troubleshooting

### "Failed to parse OPERATOR_SECRET_KEY"
Check format. Should be one of:
- `[200,228,213,...,188]` (JSON array)
- `200,228,213,...,188` (comma-separated)
- `200, 228, 213,..., 188` (comma-separated with spaces)

### "Failed to initialize SDK"
- Ensure OPERATOR_SECRET_KEY is valid
- Ensure operator wallet has SOL

### "Failed to generate ZK proof"
- Check RPC endpoint is accessible
- Check operator wallet has SOL
- Check Privacy Cash service is running

### "User wallet insufficient balance"
- User needs: deposit amount + ~0.002 SOL for fees
- Example: 0.01 SOL deposit needs 0.012 SOL minimum

### "Phantom popup doesn't appear"
- Check browser console for errors
- Ensure Phantom wallet is installed
- Ensure transaction deserialization succeeded

## References

- [Privacy Cash SDK Documentation](https://github.com/your-repo/privacy-cash-sdk)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Phantom Wallet Documentation](https://docs.phantom.app/)
- [Zero-Knowledge Proofs](https://en.wikipedia.org/wiki/Zero-knowledge_proof)

---

**Status**: ✅ Implemented and deployed to Railway
**Last Updated**: 2024
**Architecture**: Hybrid Two-Step (Backend Proof Generation + Frontend User Signing)

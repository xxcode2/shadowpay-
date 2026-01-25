# 🏗️ ShadowPay Architecture - FINAL CORRECTED

## Core Principle

**"User deposits directly. Operator relays withdrawals."**

- ✅ User executes PrivacyCash deposit from **frontend** with their wallet
- ✅ Backend **only records** the transaction (no execution, no keys)
- ✅ Operator acts as **relayer** for withdrawals (pays network fees only)

---

## System Architecture

```
FLOW: Sender → Frontend Deposit → Backend Records → Operator Relays → Receiver

┌──────────────────────────────────────────────────────────────────┐
│ SENDER: Frontend (Browser)                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1️⃣  Create Link             → POST /api/create-link              │
│      Returns: linkId for tracking                                │
│                                                                  │
│  2️⃣  Execute Deposit          → PrivacyCash SDK (FRONTEND)        │
│      User's Phantom wallet signs                                 │
│      PrivacyCash handles ZK proofs                               │
│      Returns: tx hash                                            │
│                                                                  │
│  3️⃣  Record Deposit           → POST /api/deposit                 │
│      Sends: linkId + tx hash + publicKey                         │
│      Backend saves to database                                   │
│                                                                  │
│  📊 User Control: ✅ Full control of transaction                  │
│  💳 User Pays: ✅ Full amount (deposit + fees)                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             ↕ HTTP API
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND: Node.js (Stateless Record Keeper)                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📝 Routes:                                                       │
│  • POST /api/create-link      Create link metadata                │
│  • POST /api/deposit          Record deposit (no execution)       │
│  • GET  /api/link/:id         Fetch link for claiming             │
│  • POST /api/claim-link       Execute withdrawal relay            │
│  • GET  /api/history          List sent/received                  │
│                                                                  │
│  🔐 Security:                                                     │
│  ✅ Operator key ONLY for relay (low privilege)                   │
│  ✅ No private keys for deposits                                  │
│  ✅ Stateless - can scale horizontally                            │
│  ✅ No PrivacyCash SDK needed                                     │
│                                                                  │
│  ❌ Does NOT execute deposits                                     │
│  ❌ Does NOT hold user funds                                      │
│  ❌ Does NOT sign user transactions                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             ↕ RPC/Relay
┌──────────────────────────────────────────────────────────────────┐
│ Solana Blockchain (Mainnet)                                      │
│ • Privacy Cash Pool: Stores encrypted UTXOs                      │
│ • Operator: Relays withdrawal transactions                       │
└──────────────────────────────────────────────────────────────────┘
                             ↕ Claim
┌──────────────────────────────────────────────────────────────────┐
│ RECEIVER: Frontend (Browser)                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1️⃣  Share Link ID with receiver                                 │
│      (or full URL: shadowpay.app/?link=linkId)                  │
│                                                                  │
│  2️⃣  Receiver visits link                                        │
│      GET /api/link/:linkId → Returns amount                      │
│                                                                  │
│  3️⃣  Receiver claims                                             │
│      POST /api/claim-link → Backend executes withdrawal          │
│      PrivacyCash withdraws to recipient's address                │
│                                                                  │
│  4️⃣  Receiver receives SOL                                       │
│      Amount = Deposit - Privacy Cash fees                        │
│                                                                  │
│  📊 Anonymity: ✅ Sender unknown                                  │
│  💳 Receiver Pays: ✅ Nothing (operator pays fees)                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Fee Model

### Breakdown (for 0.01 SOL deposit)

| Item | Amount | Paid By |
|------|--------|---------|
| **Deposit Amount** | 0.01 SOL | Sender |
| Privacy Cash Base Fee | 0.006 SOL | Sender |
| Privacy Cash Protocol Fee (0.35%) | ~0.000035 SOL | Sender |
| Solana TX Fee (deposit) | ~0.001 SOL | Sender |
| **Subtotal for Deposit** | **~0.017 SOL** | **Sender** |
| - | - | - |
| **Withdrawal Amount** | ~0.017 SOL | Pool (sender paid) |
| Solana TX Fee (withdrawal) | ~0.002 SOL | Operator |
| Operator Service Fee | 0% (free relay) | - |
| **Receiver Gets** | **~0.017 SOL** | Receiver |

### Key Insight
- Sender pays **everything upfront** when depositing
- Receiver gets **net amount** after fees
- Operator pays **only network fees** for relay (~0.002 SOL)
- No per-transaction cost for operator

---

## Data Structures

### PaymentLink
```typescript
{
  id: string              // UUID - link identifier
  amount: number          // SOL amount (not lamports)
  lamports: BigInt        // Raw lamports (BigInt)
  assetType: string       // 'SOL'
  depositTx: string       // Solana tx hash from sender's PrivacyCash deposit
  withdrawTx: string      // Solana tx hash from operator's relay
  claimed: boolean        // Is link claimed?
  claimedBy: string       // Recipient wallet address
  createdAt: DateTime     // Timestamp
  expiresAt: DateTime     // When link expires
}
```

### Transaction (History)
```typescript
{
  id: string              // UUID
  type: 'deposit' | 'withdraw'
  linkId: string          // Link reference
  transactionHash: string // Solana tx hash
  amount: number          // SOL amount
  assetType: string       // 'SOL'
  status: 'confirmed'     // Always confirmed (recorded after blockchain)
  fromAddress: string     // Sender address (for deposits)
  toAddress: string       // Receiver address (for withdrawals)
  createdAt: DateTime
}
```

---

## Code Flow Examples

### 1. Create Link (Frontend)

```typescript
// Step 1: Create metadata on backend
const createRes = await fetch('/api/create-link', {
  method: 'POST',
  body: JSON.stringify({ amount: 0.01, assetType: 'SOL' })
})
const { linkId } = await createRes.json()
// linkId: "abc-123-xyz"
```

### 2. Execute Deposit (Frontend - PrivacyCash)

```typescript
// Step 2: Load PrivacyCash SDK and execute deposit
const pc = new PrivacyCash({
  RPC_url: 'https://mainnet.helius-rpc.com',
  owner: phantomWallet,  // User's wallet
  enableDebug: true
})

const { tx: depositTx } = await pc.deposit({
  lamports: 0.01 * 1e9  // 0.01 SOL in lamports
})
// depositTx: "5abc...xyz" (blockchain tx hash)
```

### 3. Record Deposit (Frontend)

```typescript
// Step 3: Tell backend we're done depositing
const recordRes = await fetch('/api/deposit', {
  method: 'POST',
  body: JSON.stringify({
    linkId: "abc-123-xyz",
    depositTx: "5abc...xyz",
    publicKey: wallet.publicKey.toString(),
    amount: 0.01
  })
})
// Backend saves to database, link is now active
```

### 4. Claim Link (Receiver)

```typescript
// Receiver side: claim the link
const claimRes = await fetch('/api/claim-link', {
  method: 'POST',
  body: JSON.stringify({
    linkId: "abc-123-xyz",
    recipientAddress: receiver.publicKey.toString()
  })
})
const { withdrawTx } = await claimRes.json()
// withdrawTx: "5def...123" (blockchain tx hash)
// Receiver receives ~0.017 SOL in their wallet
```

---

## What Makes This Correct?

### ✅ User Control
- User controls the deposit transaction (signs with Phantom)
- User's private key never touches backend
- User can audit the deposit on blockchain

### ✅ Scalability
- Backend is stateless (just database)
- No large dependencies (PrivacyCash SDK only on frontend)
- Many frontends can use same operator
- Operator wallet can be rotated

### ✅ Security
- Operator key has minimal privilege (relay only)
- User's key only used for deposit (high control)
- No private keys stored on backend
- Fund recovery possible (link ID gives access)

### ✅ Privacy
- Sender-receiver relationship hidden (PrivacyCash)
- Funds routed through Privacy Cash pool
- Transaction amounts not visible on-chain
- Only linkId needed to claim (no addresses)

### ❌ What NOT to Do (Wrong Architecture)
```
DON'T:
- Execute PrivacyCash on backend with operator key
- Have backend sign user's deposit transactions
- Require operator to hold large balance for deposits
- Use backend's private key for user operations
```

---

## Deployment

### Environment Variables
```bash
# RPC endpoint
SOLANA_RPC_URL=https://mainnet.helius-rpc.com

# Operator wallet (ONLY for relay)
# Format: 64 comma-separated numbers from secret key
OPERATOR_SECRET_KEY=232,221,205,...,23

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Frontend
VITE_SOLANA_RPC=https://mainnet.helius-rpc.com
VITE_BACKEND_URL=https://shadowpay-backend.app
```

### Operator Setup
```bash
# Generate new operator wallet
solana-keygen new --no-passphrase -o operator-key.json

# Convert to environment variable
cat operator-key.json | jq -r '.[] | @json' | tr -d '\n' > operator-key.txt

# Top up with SOL (for relay fees)
solana transfer OPERATOR_ADDRESS 0.1 --allow-unfunded-recipient
```

### Server Requirements
- **Storage**: PostgreSQL or compatible
- **Runtime**: Node.js 18+
- **Memory**: 256MB+
- **CPU**: 0.5 vCPU+
- **Network**: HTTPS only

---

## Status

✅ **Architecture**: Correct  
✅ **Frontend**: PrivacyCash on browser, user deposits  
✅ **Backend**: Records transactions, relays withdrawals  
✅ **Database**: Tracks links and history  
✅ **Security**: User controls funds, operator has minimal privilege  
✅ **Build**: Both frontend and backend compile  
✅ **Deployed**: Running on Railway + Vercel  

**Ready for production!** 🚀

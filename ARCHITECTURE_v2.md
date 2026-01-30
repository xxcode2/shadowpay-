# ✅ SHADOWPAY v2.0 - CORRECT ARCHITECTURE

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                          │
│                                                                 │
│  ❌ NO SDK calls                                                │
│  ✅ Only calls backend APIs                                      │
│  ✅ Simple HTTP requests                                         │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                   BACKEND (Express + Prisma)                     │
│                                                                 │
│  POST   /api/links              ← Create link (deposit)         │
│  GET    /api/links/:id          ← Get link details              │
│  POST   /api/links/:id/claim    ← Claim link (withdraw)         │
│  GET    /api/links              ← List all links                │
│                                                                 │
│  ✅ Backend has Privacy Cash SDK                                │
│  ✅ Backend has operator keypair                                │
│  ✅ Backend calls SDK deposit/withdraw                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │ SDK Calls
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│              Privacy Cash SDK (privacycash npm)                  │
│                                                                 │
│  - Generate ZK proofs                                           │
│  - Manage UTXO state                                            │
│  - Submit to Solana relayer                                     │
└──────────────────┬──────────────────────────────────────────────┘
                   │ Blockchain calls
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│           Solana Blockchain + Privacy Cash Relayer              │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Core Concepts

### LINK ≠ KEY ≠ WALLET ≠ SECRET

**LINK** is just an identifier/pointer:
- Generated: `crypto.randomBytes(16).toString('hex')`
- Stored in: Database
- References: Deposit state + metadata

**What backend saves for each link:**
```typescript
{
  linkId: "abc123...",        // identifier
  amount: 0.25,               // amount in SOL
  lamports: 250000000,        // amount in lamports (SOURCE OF TRUTH)
  assetType: "SOL",
  status: "active" | "claimed",
  claimed: false,
  claimedBy: null,
  depositTx: "...",           // TX from privacy cash deposit
  withdrawTx: null,           // TX from privacy cash withdraw
  createdAt: "2025-02-27",
  updatedAt: "2025-02-27"
}
```

### NO sensitive crypto data in link:
- ❌ private key
- ❌ nullifier
- ❌ merkle path
- ❌ UTXO secret

## 📡 API Endpoints

### 1️⃣ POST /api/links - CREATE LINK

**What happens:**
- Frontend sends amount
- Backend initializes Privacy Cash SDK with operator keypair
- Backend calls `sdk.deposit(lamports)`
- SDK generates ZK proof + submits to relayer
- Backend saves link metadata to database
- Backend returns linkId + shareUrl

**Request:**
```json
{
  "amount": 0.25,
  "memo": "payment for coffee",
  "expiryDays": 7
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "abc123def456...",
  "amount": 0.25,
  "status": "active",
  "depositTx": "5Tx1234...",
  "shareUrl": "https://shadowpay.app/claim/abc123def456...",
  "message": "Payment link created successfully."
}
```

**Frontend code:**
```typescript
import { createPaymentLink } from './linkAPI'

const result = await createPaymentLink({
  amount: 0.25,
  memo: "coffee"
})

const shareUrl = result.shareUrl
const linkId = result.linkId
```

---

### 2️⃣ GET /api/links/:id - PREVIEW LINK

**What happens:**
- User clicks shared link
- Frontend queries backend for link details
- Backend returns amount, status, expiry
- Frontend shows payment request UI

**Response:**
```json
{
  "linkId": "abc123def456...",
  "amount": 0.25,
  "assetType": "SOL",
  "status": "active",
  "claimed": false,
  "claimedBy": null,
  "createdAt": "2025-02-27T10:00:00Z",
  "expiryAt": "2025-03-06T10:00:00Z"
}
```

**Frontend code:**
```typescript
import { getPaymentLink } from './linkAPI'

const link = await getPaymentLink(linkId)

// Show to recipient:
console.log(`You're receiving ${link.amount} SOL`)
console.log(`Status: ${link.status}`)
```

---

### 3️⃣ POST /api/links/:id/claim - CLAIM LINK

**What happens:**
- Recipient provides their wallet address
- Backend finds link metadata
- Backend initializes Privacy Cash SDK with operator keypair
- Backend calls `sdk.withdraw(amount, recipientAddress)`
- SDK generates ZK proof + verifies commitment
- SDK submits withdrawal to relayer
- Relayer sends encrypted SOL to recipient
- Backend marks link as claimed

**Request:**
```json
{
  "recipientAddress": "ABC123xyz..."
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "abc123def456...",
  "withdrawTx": "5TxAbcd1234...",
  "recipient": "ABC123xyz...",
  "amount": 0.25,
  "status": "claimed",
  "message": "Payment claimed successfully!"
}
```

**Frontend code:**
```typescript
import { claimPaymentLink } from './linkAPI'

const result = await claimPaymentLink(
  linkId,
  recipientAddress
)

// Recipient got the funds!
console.log(`Received: ${result.amount} SOL`)
console.log(`TX: ${result.withdrawTx}`)
```

---

### 4️⃣ GET /api/links - LIST LINKS (Admin)

**Response:**
```json
{
  "count": 42,
  "links": [
    {
      "linkId": "abc123...",
      "amount": 0.25,
      "status": "active",
      "claimed": false,
      "claimedBy": null,
      "createdAt": "2025-02-27T10:00:00Z",
      "updatedAt": "2025-02-27T10:00:00Z"
    },
    // ... more links
  ]
}
```

## 🔐 Security & Non-Custody

**Why this is non-custodial:**

1. **Deposit**: User (via operator) deposits to Privacy Cash pool
   - Funds go to Privacy Cash smart contract, not ShadowPay
   - Only Privacy Cash can release them
   - Link is just a reference ID

2. **Withdrawal**: Recipient controls their wallet
   - Recipient provides their own Solana address
   - Backend uses operator keypair to withdraw from pool
   - Funds go directly to recipient
   - Recipient has full control

3. **Link is not a secret**
   - Link is just a random ID in database
   - No sensitive data embedded
   - Can't spend funds with link alone
   - SDK + merkle tree + nullifier prevent reuse

## 🚀 Frontend Integration

### Old way (❌ DEPRECATED):
```typescript
// Don't do this anymore!
import { PrivacyCash } from 'privacycash'

const pc = new PrivacyCash({...})  // ❌ Wrong!
await pc.deposit(...)              // ❌ Wrong!
```

### New way (✅ CORRECT):
```typescript
// Do this instead!
import { createPaymentLink, claimPaymentLink, getPaymentLink } from './linkAPI'

// Create
const result = await createPaymentLink({ amount: 0.25 })

// Preview
const link = await getPaymentLink(linkId)

// Claim
const claimed = await claimPaymentLink(linkId, recipientAddress)
```

## 🧪 Testing

### 1. Create a link:
```bash
curl -X POST http://localhost:5000/api/links \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "memo": "test"}'
```

### 2. Get link details:
```bash
curl http://localhost:5000/api/links/abc123def456...
```

### 3. Claim link:
```bash
curl -X POST http://localhost:5000/api/links/abc123def456.../claim \
  -H "Content-Type: application/json" \
  -d '{"recipientAddress": "ABC123xyz..."}'
```

## 📋 Checklist for implementation

- ✅ Backend `POST /api/links` - performs deposit
- ✅ Backend `GET /api/links/:id` - return metadata
- ✅ Backend `POST /api/links/:id/claim` - performs withdrawal
- ✅ Frontend `linkAPI.ts` - API client
- ✅ TypeScript compilation
- ✅ Build passes
- [ ] React components use linkAPI
- [ ] E2E test with real operator wallet
- [ ] Mainnet testing

## 🎓 Why this architecture is better

| Aspect | Old Way | New Way |
|--------|---------|---------|
| **SDK calls** | Frontend | Backend |
| **Operator key** | Stored in frontend env (unsafe) | Backend env (secure) |
| **Amount source** | Embedded in link (not ideal) | Database (source of truth) |
| **Deposit responsibility** | User pays directly | Operator deposits, user reimburses |
| **Withdrawal responsibility** | User needs SDK | Backend handles, transparent |
| **Separation of concerns** | Mixed | Clean |
| **Security** | Frontend has access to secrets | Backend secured |
| **Simplicity** | Complex SDK logic in frontend | Simple HTTP API |


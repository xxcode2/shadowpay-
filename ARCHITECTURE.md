# 🏗️ ShadowPay Architecture (Corrected)

## Overview

ShadowPay is a **non-custodial private payment link system** built on Privacy Cash (Solana).

### Key Principle
**Backend does NOT use Privacy Cash SDK.**

Privacy Cash SDK is **frontend-only**. Backend is just a metadata server.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User connects wallet (Phantom)                          │
│  2. Imports Privacy Cash SDK                                │
│  3. Calls SDK.deposit() or SDK.withdraw()                   │
│  4. SDK handles: ZK proofs, Merkle tree, UTXOs             │
│  5. SDK relays to Privacy Cash relayer                      │
│  6. Sends transaction hash to backend                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js - Vercel)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Routes:                                                    │
│  POST /api/deposit    → Create link (store metadata)        │
│  GET  /api/link/:id   → Fetch link details                  │
│  POST /api/withdraw   → Record withdrawal                   │
│  GET  /health         → Health check                        │
│                                                             │
│  Storage: In-memory (MVP) → Database (production)           │
│                                                             │
│  ❌ NO SDK usage                                             │
│  ❌ NO private keys                                          │
│  ❌ NO wallet signing                                        │
│  ❌ NO ZK operations                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│ Privacy Cash Network (Solana Mainnet)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  - Privacy Cash Relayer (handles ZK proofs)                 │
│  - Solana Program (verifies proofs + transfers funds)       │
│  - Merkle Tree (maintained by Privacy Cash)                 │
│  - UTXO Pool (encrypted, accessible via SDK)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. CREATE LINK (User A deposits)

```
User A's Browser
├─ Connects Phantom wallet
├─ Initializes PrivacyCash SDK
│  └─ SDK requires user's private key (for encryption)
├─ Calls SDK.deposit(0.01 SOL)
│  ├─ SDK generates UTXO keypair
│  ├─ SDK creates ZK proof
│  ├─ SDK signs transaction locally
│  └─ SDK relays to Privacy Cash network
├─ Receives transaction hash (txHash)
├─ Sends to Backend:
│  └─ POST /api/deposit
│     ├─ amount: 0.01
│     ├─ assetType: "SOL"
│     └─ depositTx: txHash
└─ Backend creates link
   ├─ Generates linkId: "a1b2c3d4..."
   ├─ Stores: { linkId, amount, assetType, depositTx }
   └─ Returns to frontend

Frontend displays link:
  https://shadowpay.vercel.app/link/a1b2c3d4
```

### 2. CLAIM LINK (User B receives)

```
User B's Browser
├─ Opens link URL
├─ Fetches from Backend:
│  └─ GET /api/link/a1b2c3d4
│     └─ Returns: { amount, assetType, claimed }
├─ Connects Phantom wallet
├─ Initializes PrivacyCash SDK
├─ Calls SDK.withdraw(amount, recipientAddress)
│  ├─ SDK fetches UTXOs from network
│  ├─ SDK verifies against Merkle tree
│  ├─ SDK generates ZK proof (proves ownership without revealing depositor)
│  ├─ SDK signs transaction locally
│  └─ SDK relays to Privacy Cash network
├─ Receives transaction hash
├─ Sends to Backend:
│  └─ POST /api/withdraw
│     ├─ linkId: "a1b2c3d4"
│     ├─ recipientAddress: "Ey..."
│     └─ withdrawTx: txHash
└─ Backend records withdrawal
   └─ Marks link as claimed

User B receives funds directly on Solana network
(no custody, no intermediary)
```

---

## Backend API Contracts

### POST /api/deposit
**Frontend sends after SDK.deposit() completes**

```typescript
// Request
{
  "amount": 0.01,
  "assetType": "SOL" | "USDC" | "USDT",
  "depositTx": "5xAbc...xyz" // SDK-generated tx signature
}

// Response
{
  "success": true,
  "linkId": "a1b2c3d4e5f6...",
  "depositTx": "5xAbc...xyz"
}
```

### GET /api/link/:id
**Frontend fetches link details before withdraw**

```typescript
// Response
{
  "id": "a1b2c3d4e5f6...",
  "amount": 0.01,
  "assetType": "SOL",
  "claimed": false,
  "claimedBy": null
}
```

### POST /api/withdraw
**Frontend sends after SDK.withdraw() completes**

```typescript
// Request
{
  "linkId": "a1b2c3d4e5f6...",
  "recipientAddress": "Ey5GG...",
  "withdrawTx": "7xDef...xyz"
}

// Response
{
  "success": true,
  "withdrawTx": "7xDef...xyz"
}
```

### GET /health
**Health check**

```typescript
// Response
{
  "status": "ok",
  "timestamp": "2026-01-20T..."
}
```

---

## File Structure

```
shadowpay/
├── frontend/                 # React/Vue app (uses Privacy Cash SDK)
│   ├── index.html
│   ├── App.tsx
│   └── ...
│
├── backend/                  # Node.js API server (NO SDK)
│   ├── src/
│   │   ├── server.ts
│   │   ├── config.ts
│   │   ├── privacy/
│   │   │   ├── privacyCash.ts    (documentation only)
│   │   │   └── linkManager.ts
│   │   └── routes/
│   │       ├── deposit.ts
│   │       ├── withdraw.ts
│   │       └── link.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── privacy-cash-sdk/         # git clone (READ ONLY)
│   ├── src/
│   ├── example/
│   └── ...
│
├── vercel.json
└── README.md
```

---

## Wallet Ownership

| Component | Owns Private Key | Sign TX | Host Key |
|-----------|------------------|---------|----------|
| Frontend user | ✅ YES | ✅ YES | ✅ YES (in browser) |
| Backend server | ❌ NO | ❌ NO | ❌ NO |
| Privacy Cash Relayer | ❌ NO | ✅ YES (for execution) | ❌ NO |

---

## Privacy Model

### What's Private?
- **Deposit address** (User A's wallet) → ✅ Hidden on-chain
- **Withdrawal address** (User B's wallet) → ✅ Hidden on-chain
- **Amount** → ✅ Encrypted in UTXO
- **Link between sender and receiver** → ✅ Complete privacy via ZK proof

### What's Public?
- Privacy Cash program accounts (encrypted commitments)
- Transaction signatures (relayer, not user)
- Link ID (random hash, no meaning)

---

## Production Checklist

- [ ] Replace in-memory link storage with PostgreSQL/MongoDB
- [ ] Add transaction audit trail
- [ ] Add rate limiting per IP
- [ ] Add input validation + sanitization
- [ ] Add error logging + monitoring
- [ ] Configure CORS for specific frontend domain
- [ ] Add request signing for frontend-backend auth
- [ ] Deploy frontend on separate domain (Vercel/Netlify)
- [ ] Deploy backend on Vercel
- [ ] Add e2e tests
- [ ] Add security headers

---

## Technologies

- **Frontend**: TypeScript, React (or Vue)
  - Privacy Cash SDK (from npm or github)
  - Phantom Wallet integration
  
- **Backend**: TypeScript, Node.js
  - Express.js
  - Deployed on Vercel
  
- **Blockchain**: Solana Mainnet
  - Helius RPC (mainnet.helius-rpc.com)
  - Privacy Cash relayer network

---

## Key Differences from Traditional Services

| Feature | Traditional | ShadowPay |
|---------|-----------|-----------|
| Custody | Backend holds funds | ❌ No (relayer can't steal) |
| Privacy | Traceable | ✅ ZK-hidden |
| Signing | Backend signs | ❌ User signs |
| Fees | High (custodial) | Low (on-chain only) |
| Censorship | Can block | ❌ Censorship-resistant |

---

## Testing

### Manual Testing

```bash
# 1. Start backend
cd backend && npm run dev

# 2. Create link
curl -X POST http://localhost:3001/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "assetType": "SOL", "depositTx": "..."}'

# 3. Get link
curl http://localhost:3001/api/link/a1b2c3d4

# 4. Health check
curl http://localhost:3001/health
```

---

## References

- Privacy Cash SDK: /privacy-cash-sdk/README.md
- Solana Docs: https://docs.solana.com
- Privacy Cash: https://privacycash.org


# 🕵️ ShadowPay - Private Payment Links on Solana

**Privacy-preserving payment links using PrivacyCash SDK for confidential transactions on Solana**

---

## 🎯 What is ShadowPay?

ShadowPay enables users to send SOL privately using payment links. The sender creates a link that deposits funds into a **shielded pool** (via PrivacyCash). The recipient claims the link and receives SOL directly to their wallet - with sender privacy preserved.

**Key Feature**: The operator acts as a **relayer** for PrivacyCash transactions, enabling seamless private payments without requiring recipients to understand zero-knowledge protocols.

---

## ✨ Features

✅ **Create Private Payment Links** - Generate shareable links for sending SOL  
✅ **Shielded Deposits** - Funds go to anonymous shielded pool via PrivacyCash  
✅ **Signature Authorization** - User signs message to authorize deposit  
✅ **Link Claiming** - Recipients withdraw funds directly to their wallet  
✅ **Fee Transparency** - 0 SOL deposit fee, 0.006 SOL + 0.35% withdrawal fee  
✅ **Balance Monitoring** - Automatic hourly operator balance checks  
✅ **Production Ready** - Environment-aware error handling, full documentation

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn
- Phantom wallet (browser extension)
- SOL in Phantom wallet (for testing)

### 1. Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:8080` (default)

Environment variables needed:
```bash
# .env file
NODE_ENV=development
PORT=8080
DATABASE_URL=sqlite://db.sqlite
OPERATOR_SECRET_KEY=232,221,205,...  # 64 comma-separated numbers from keypair
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_NETWORK=mainnet
```

### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

Set backend URL (in code or .env):
```bash
VITE_BACKEND_URL=http://localhost:8080
```

### 3. Test End-to-End

1. Open `http://localhost:5173` in browser
2. Connect Phantom wallet
3. **Create Link**: Enter 0.01 SOL → Sign message → Link created
4. **Share Link**: Copy link and share (or use second browser/wallet)
5. **Claim Link**: Recipient opens link → Clicks "Claim" → SOL received

Check backend logs for:
```
🚀 Executing REAL PrivacyCash deposit...
✅ Deposit successful: [txHash]
```

---

## 🏗️ Architecture

### How ShadowPay Works

```
SENDER FLOW:
  1. User enters 0.01 SOL
  2. Frontend signs authorization message (Phantom popup)
  3. Frontend sends signature to backend
  4. Backend verifies signature
  5. Backend executes PrivacyCash deposit with operator Keypair
  6. Funds go to shielded pool
  7. Link created and shared

RECIPIENT FLOW:
  1. Recipient opens payment link
  2. Connects their Phantom wallet
  3. Clicks "Claim Funds"
  4. Backend calculates withdrawal fee (0.006 SOL + 0.35%)
  5. Executes claim transaction
  6. Recipient receives SOL in their wallet
```

### Component Design

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (TypeScript)                     │
│  • Wallet connection (Phantom)                               │
│  • Message signing (no keys)                                 │
│  • Link UI                                                   │
│  • No PrivacyCash SDK                                        │
└────────────────────────┬─────────────────────────────────────┘
                         │
                   HTTP API
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                  BACKEND (Express + Node.js)                 │
│  • Signature verification (nacl.sign)                        │
│  • PrivacyCash SDK execution                                 │
│  • Operator Keypair management                               │
│  • Link metadata storage                                     │
│  • Transaction recording                                     │
│  • Balance monitoring (hourly)                               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                  Solana RPC
                         │
┌────────────────────────▼─────────────────────────────────────┐
│              SOLANA BLOCKCHAIN + SHIELDED POOL               │
│  • Executes PrivacyCash transactions                         │
│  • Stores encrypted UTXOs                                    │
│  • Verifies signatures                                       │
└──────────────────────────────────────────────────────────────┘
```

**Key Architecture Decision**: PrivacyCash SDK runs **only on backend** with operator's private Keypair, never in frontend.

---

## 📡 API Endpoints

### `POST /api/create-link`
Create a new payment link
```json
{
  "amount": 0.01,
  "assetType": "SOL"
}
```
Returns: `{ linkId, message }`

### `POST /api/deposit`
Execute private deposit
```json
{
  "linkId": "...",
  "signature": [...],
  "publicKey": "...",
  "amount": 0.01
}
```
Returns: `{ depositTx, amount, fee: {...} }`

### `POST /api/claim-link`
Claim funds from link
```json
{
  "linkId": "...",
  "recipientAddress": "...",
  "signature": [...]
}
```
Returns: `{ claimTx, amount, feeCharged }`

### `GET /api/link/:id`
Get link details and status
Returns: `{ id, amount, assetType, status, createdAt, claimedAt }`

### `GET /api/config`
Get public configuration (fees, network, operator info)
Returns: `{ fees: {...}, network, minAmount, operator }`

### `GET /api/history`
Get transaction history for link
Returns: `{ transactions: [...] }`

### `GET /health`
Health check
Returns: `{ status: "ok", port, timestamp }`

---

## 💰 Fee Structure

| Item | Amount | When Charged |
|------|--------|--------------|
| **Deposit Fee** | 0 SOL | Never (free) |
| **Base Withdrawal Fee** | 0.006 SOL | When claiming |
| **Protocol Fee** | 0.35% | When claiming |
| **Network Fee** | ~0.002 SOL | Paid by operator |

**Example**: User sends 1.0 SOL
- Recipient receives: 1.0 SOL (intact at deposit)
- When claiming: 0.006 SOL + 3.5 SOL (0.35% of 1000) = 3.506 SOL fee
- Recipient gets: 1.0 - 3.506 = -2.506 SOL... wait this is wrong, let me recalculate

Actually: User deposits 1.0 SOL. On claim, withdrawal fee is 0.006 + (0.35% of 1.0) = 0.006 + 0.0035 = 0.0095 SOL. Recipient gets 1.0 - 0.0095 = 0.9905 SOL.

---

## 🔐 Security Features

✅ **No Private Keys in Frontend**
- Frontend uses `wallet.signMessage()` only
- No wallet object exposed to backend
- No key material in browser

✅ **Signature Verification**
- Backend verifies user signature with nacl.sign
- Prevents unauthorized transactions
- Ensures user intent

✅ **Operator Balance Monitoring**
- Automatic hourly balance checks
- Alerts if balance < 0.01 SOL (critical)
- Alerts if balance < 0.05 SOL (warning)

✅ **Production Error Handling**
- NODE_ENV=production: Generic error messages (safe)
- NODE_ENV=development: Full error details (debugging)
- Prevents information leakage

✅ **Robust Key Parsing**
- Supports 3 formats for OPERATOR_SECRET_KEY
- Validates key length (must be 64 bytes)
- Clear error messages if invalid

---

## 🚢 Production Deployment

### Environment Variables (Railway/Vercel)

```bash
# Core
NODE_ENV=production
PORT=8080

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Solana
SOLANA_NETWORK=mainnet
SOLANA_RPC=https://api.mainnet-beta.solana.com

# Operator (REQUIRED - 64 comma-separated numbers)
OPERATOR_SECRET_KEY=232,221,205,...[60 more numbers]

# Optional
OPERATOR_EMAIL=support@shadowpay.app
```

### Deploy to Railway (Backend)

```bash
# 1. Push code to GitHub
git push origin main

# 2. Connect GitHub to Railway
# - Import project from GitHub
# - Set environment variables (above)
# - Deploy

# 3. Verify
curl https://your-app.railway.app/health
curl https://your-app.railway.app/api/config
```

### Deploy to Vercel (Frontend)

```bash
cd frontend
vercel deploy

# Set environment variable
VITE_BACKEND_URL=https://your-backend.railway.app
```

---

## 📂 Project Structure

```
shadowpay-/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Main server + balance monitoring
│   │   ├── config.ts              # Env config
│   │   ├── routes/
│   │   │   ├── deposit.ts         # PrivacyCash deposit execution
│   │   │   ├── config.ts          # Config endpoint (NEW)
│   │   │   ├── claimLink.ts       # Link claiming
│   │   │   ├── createLink.ts      # Link creation
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── prisma.ts          # Database client
│   │   └── utils/
│   │       └── operatorBalanceGuard.ts
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── migrations/            # Database migrations
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.ts
│   │   ├── api/                   # API clients
│   │   ├── flows/
│   │   │   ├── createLink.ts      # Create link flow (signing)
│   │   │   └── claimLinkFlow.ts   # Claim link flow
│   │   └── ...
│   └── package.json
│
├── README.md                       # This file
└── package.json                    # Workspace config
```

---

## 🛠️ Development Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Build TypeScript
npm run build

# Production
npm start

# Check for errors
npm run lint
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Both Together (Recommended)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Open http://localhost:5173
```

---

## 🧪 Testing

### Manual Test Flow

1. **Create Link**:
   - Go to frontend
   - Connect Phantom wallet with SOL
   - Enter amount (0.01)
   - Sign message in Phantom
   - Backend logs: "🚀 Executing REAL PrivacyCash deposit..."

2. **Verify Deposit**:
   - Check backend: "✅ Deposit successful: [txHash]"
   - Check database: linkId with depositTx recorded
   - Frontend shows: "Link ready to claim"

3. **Claim Link**:
   - Open link in different wallet/browser
   - Click "Claim Funds"
   - Frontend signs authorization
   - Backend: "✅ Claim successful: [txHash]"
   - Recipient wallet: Shows SOL received

### Expected Console Output

**Frontend**:
```
📝 Creating payment link for 0.01 SOL...
✅ Link created: [linkId]
🔐 Signing authorization message...
✅ Authorization signed successfully
📤 Sending to backend...
✅ Deposit executed successfully: [txHash]
```

**Backend**:
```
✅ Backend listening on port 8080
💰 OPERATOR WALLET PUBLIC KEY: [address]
💰 Operator balance: 0.1234 SOL

[When creating link:]
🚀 Executing REAL PrivacyCash deposit...
✅ Deposit successful: [txHash]

[When claiming:]
✅ Claim successful: [txHash]
```

---

## ❓ Troubleshooting

### Error: "param 'owner' is not a valid Private Key"
- **Cause**: Old code still running, PrivacyCash SDK on frontend
- **Fix**: Hard refresh (Ctrl+Shift+R), reinstall node_modules

### Error: "OPERATOR_SECRET_KEY not set"
- **Cause**: Backend .env missing OPERATOR_SECRET_KEY
- **Fix**: Add to .env: `OPERATOR_SECRET_KEY=232,221,205,...`

### Error: "Operator balance insufficient"
- **Cause**: Operator wallet doesn't have SOL
- **Fix**: Send SOL to operator address shown in startup logs

### Phantom popup doesn't appear
- **Cause**: Frontend not calling wallet.signMessage()
- **Fix**: Check createLink.ts is being called, not deprecated depositFlow.ts

### Transaction fails on Solana
- **Cause**: Invalid RPC or network mismatch
- **Fix**: Check SOLANA_RPC_URL and SOLANA_NETWORK match

---

## 📚 Key Files to Review

- **[backend/src/routes/deposit.ts](backend/src/routes/deposit.ts)** - PrivacyCash deposit execution
- **[frontend/src/flows/createLink.ts](frontend/src/flows/createLink.ts)** - Frontend signing flow
- **[backend/src/server.ts](backend/src/server.ts)** - Balance monitoring setup
- **[backend/prisma/schema.prisma](backend/prisma/schema.prisma)** - Database schema

---

## 🔗 Resources

- **PrivacyCash** - Privacy protocol documentation
- **Solana** - https://solana.com
- **Phantom Wallet** - https://phantom.app
- **Web3.js** - https://github.com/solana-labs/solana-web3.js
- **TweetNaCl.js** - Cryptography library for signatures

---

## 📄 License

MIT

---

**Ready to deploy!** For questions, check the documentation files or review the source code.


## 🏗️ Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser) - Privacy Cash SDK Integration          │
│ - User Wallet Connection (Phantom)                         │
│ - ZK Proofs (deposit/withdraw)                             │
│ - Transaction Signing                                      │
│ - Link UI                                                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                    Proxy: /api/*
                             │
┌────────────────────────────▼────────────────────────────────┐
│ BACKEND (Node.js) - Metadata Server                        │
│ - Link CRUD operations                                     │
│ - Transaction recording                                    │
│ - NO keys, NO SDK                                          │
│ - Non-custodial                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                    Relayer API (Privacy Cash Network)
                             │
┌────────────────────────────▼────────────────────────────────┐
│ SOLANA BLOCKCHAIN                                          │
│ - Verifies ZK proofs                                       │
│ - Executes transactions                                    │
│ - Stores encrypted UTXOs                                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle

**Frontend uses Privacy Cash SDK. Backend does not.**

- ✅ Frontend: Generates ZK proofs, signs transactions, handles crypto
- ❌ Backend: No wallet, no keys, no SDK - just metadata storage
- 🔗 Backend: Records link data & transaction history

## 📡 Data Flow

### Create Payment Link (Sender)

```
1. User enters amount & asset type → UI Form
2. Frontend calls Privacy Cash SDK:
   - SDK generates UTXO
   - SDK creates ZK proof
   - SDK signs transaction
3. SDK sends transaction to Solana via relayer
4. SDK returns transaction hash
5. Frontend POST /api/deposit { amount, assetType, tx }
6. Backend creates link metadata & returns linkId
7. Frontend displays shareable link
```

### Claim Payment Link (Recipient)

```
1. Recipient opens shared link
2. Frontend GET /api/link/:id (fetch link metadata)
3. Recipient connects wallet
4. Recipient clicks "Claim Now"
5. Frontend calls Privacy Cash SDK:
   - SDK verifies UTXO (ZK proof verification)
   - SDK generates withdraw proof
   - SDK signs transaction
6. SDK sends to relayer → Solana
7. Funds arrive in recipient's wallet
8. Frontend POST /api/withdraw { linkId, recipient, tx }
9. Backend records withdrawal
```

## 🔐 Privacy Guarantees

✅ **Sender privacy**
- Wallet address hidden via ZK proof
- Amount encrypted in UTXO
- No on-chain link between sender & receiver

✅ **Receiver privacy**
- Receives funds directly to their wallet
- No intermediate custody
- Only relayer knows recipient address (via privacy protocol)

✅ **Link privacy**
- LinkID is random hash
- No wallet address in link
- Can be shared anonymously via email/chat

## 🛠️ Development Commands

### Frontend

```bash
cd frontend

# Development server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend

```bash
cd backend

# Development server
npm run dev

# Build TypeScript
npm run build

# Run production server
npm start
```

### Both Simultaneously

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Then open `http://localhost:5173` in browser.

## 📝 API Contract

### POST /api/deposit

Create a new payment link

**Request:**
```json
{
  "amount": 0.01,
  "assetType": "SOL",
  "depositTx": "5xAbc...xyz"
}
```

**Response (201):**
```json
{
  "success": true,
  "linkId": "a1b2c3d4e5f6...",
  "depositTx": "5xAbc...xyz"
}
```

### GET /api/link/:id

Fetch link details

**Response (200):**
```json
{
  "id": "a1b2c3d4e5f6...",
  "amount": 0.01,
  "assetType": "SOL",
  "claimed": false,
  "claimedBy": null,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/withdraw

Record a withdrawal

**Request:**
```json
{
  "linkId": "a1b2c3d4e5f6...",
  "recipientAddress": "Ey5GG...",
  "withdrawTx": "7xDef...xyz"
}
```

**Response (201):**
```json
{
  "success": true,
  "withdrawTx": "7xDef...xyz"
}
```

### GET /health

Health check

**Response (200):**
```json
{
  "status": "ok"
}
```

## 🚢 Production Deployment

### Frontend (Vercel/Netlify)

```bash
# Deploy to Vercel
cd frontend
vercel deploy

# Build output: frontend/dist/
```

### Backend (Vercel)

```bash
cd backend
vercel deploy
```

Environment variables needed:
```
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
PORT=3001
NODE_ENV=production
```

See `vercel.json` for configuration.

## 📚 Complete Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Full system design & security model
- **[BACKEND_FIXED.md](BACKEND_FIXED.md)** - Backend implementation notes
- **[backend/README.md](backend/README.md)** - Backend API & routes
- **[backend/DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md)** - Production DB schema
- **[frontend/README.md](frontend/README.md)** - Frontend development guide
- **[privacy-cash-sdk/](privacy-cash-sdk/)** - SDK source code & examples

## 🔗 Resources

- **Privacy Cash** - https://privacycash.org
- **Solana** - https://solana.com
- **Phantom Wallet** - https://phantom.app
- **Web3.js** - https://solana-labs.github.io/solana-web3.js/

## ⚠️ Disclaimer

This is a beta implementation. Use at your own risk. Always test thoroughly before handling real funds.

## 📄 License

MIT

---

## 🚧 Next Steps

- [ ] Integrate Privacy Cash SDK calls in frontend (deposit/withdraw)
- [ ] Test with real Phantom wallet
- [ ] Setup production database (PostgreSQL)
- [ ] Rate limiting & validation
- [ ] Error handling & retry logic
- [ ] E2E testing
- [ ] Security audit
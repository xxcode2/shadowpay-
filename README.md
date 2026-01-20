# 🕵️ ShadowPay - Private Payment Links on Solana

**Non-custodial, zero-knowledge private payment links powered by Privacy Cash SDK**

## 📋 Project Structure

```
shadowpay/
├── frontend/              # 🎨 Vite + TypeScript
│   ├── src/
│   │   ├── main.ts
│   │   └── app.ts
│   ├── index.html
│   ├── package.json
│   └── README.md
│
├── backend/               # 🖥️ Express + Node.js
│   ├── src/
│   │   ├── server.ts
│   │   ├── config.ts
│   │   ├── privacy/
│   │   │   ├── privacyCash.ts
│   │   │   └── linkManager.ts
│   │   └── routes/
│   │       ├── deposit.ts
│   │       ├── withdraw.ts
│   │       └── link.ts
│   ├── package.json
│   └── README.md
│
├── privacy-cash-sdk/      # 📚 Git cloned (READ-ONLY)
│
├── ARCHITECTURE.md        # System design
├── BACKEND_FIXED.md       # Backend changes summary
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 24+
- npm/yarn
- Phantom wallet (browser extension)

### 1. Start Backend

```bash
cd backend
npm install
npm run dev
```

**Server runs on:** `http://localhost:3001`

API Endpoints:
- `POST /api/deposit` - Create link
- `GET /api/link/:id` - Get link details
- `POST /api/withdraw` - Record withdrawal
- `GET /health` - Health check

### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

**App runs on:** `http://localhost:5173`

Frontend connects to backend via proxy:
- Frontend makes request to `/api/deposit`
- Proxy forwards to `http://localhost:3001/api/deposit`

### 3. Test in Browser

1. Open `http://localhost:5173`
2. Click "🔌 Connect Wallet" (requires Phantom)
3. Go to "💸 Create Link" tab
4. Enter amount (e.g., 0.01) and select asset type (SOL, USDC, USDT)
5. Click "Create Link"
6. Copy generated link
7. Share with recipient!

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
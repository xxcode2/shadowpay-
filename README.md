# 🕵️ ShadowPay - Private Payments on Solana

**Zero-knowledge private payment platform on Solana using Privacy Cash SDK**

---

## 🎯 What is ShadowPay?

ShadowPay is a privacy-first payment application that enables users to send SOL confidentially on the Solana blockchain using zero-knowledge proofs. Unlike traditional blockchain transactions where sender, receiver, and amount are visible, ShadowPay keeps all transaction details private.

**How it works:**
- Sender deposits SOL into a **shielded pool** using ZK proofs
- Recipient wallet address is **encrypted and hidden**
- Transaction amount is **obfuscated** on-chain
- Only the sender and recipient can see the payment occurred

---

## ✨ Features

✅ **Zero-Knowledge Privacy** - Transactions use ZK proofs, no on-chain sender/receiver link  
✅ **Send Privately** - Enter amount, recipient address, and send with privacy  
✅ **Receive Payments** - View incoming private payments with separate available/withdrawn tabs  
✅ **Transaction History** - Track all sent and received payments (10 items per page)  
✅ **Multiple Tokens** - Support for SOL, USDC, USDT, ZEC, ORE, STORE  
✅ **Non-Custodial** - Your private keys never leave your device  
✅ **Open Source** - Built on Privacy Cash SDK with transparent architecture  
✅ **Fast & Cheap** - Solana blockchain: ~2 second finality, $0.0005 per transaction

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or pnpm
- Phantom wallet browser extension
- SOL for testing

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Start Backend

```bash
cd backend
npm run dev
```

Runs on: `http://localhost:8080`

**Environment Setup (.env in `backend/`):**
```bash
NODE_ENV=development
PORT=8080
DATABASE_URL=sqlite:./db.sqlite
OPERATOR_SECRET_KEY=<your_keypair_as_numbers>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Runs on: `http://localhost:5173`

### 4. Test the Application

1. Open `http://localhost:5173` in your browser
2. Click "Connect Wallet" and approve in Phantom
3. **Send Tab**: Enter amount, select token, enter recipient address
4. **Receive Tab**: View incoming payments
5. **History Tab**: See all your transactions
6. **About Tab**: Learn how privacy works

---

## 🏗️ Architecture

### Technology Stack

| Component | Tech | Purpose |
|-----------|------|---------|
| **Frontend** | TypeScript + Vite + Tailwind CSS | UI, wallet connection, ZK proofs |
| **Backend** | Express + Node.js + Prisma | API, transaction management |
| **Blockchain** | Solana + Privacy Cash SDK | ZK proofs, shielded pool |
| **Database** | SQLite / PostgreSQL | Link & transaction storage |

### Transaction Flow

```
SEND FLOW:
  1. User enters amount, recipient, token
  2. Frontend signs authorization message (Phantom)
  3. Backend verifies signature
  4. Backend executes Privacy Cash deposit
  5. Recipient address is encrypted
  6. ZK proof validates transaction
  7. Funds added to shielded pool
  ✅ Recipient notified

RECEIVE FLOW:
  1. Backend decrypts incoming payments
  2. Shows "Available" for unclaimed payments
  3. Recipient clicks "Claim" on payment
  4. Withdrawal initiated from shielded pool
  5. ✅ SOL received in wallet
```

---

## 📡 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/private-send` | POST | Send private payment |
| `/api/incoming` | GET | Get incoming payments (Available/Withdrawn) |
| `/api/history` | GET | Get transaction history |
| `/api/health` | GET | Health check |

---

## 📁 Project Structure

```
shadowpay-/
├── frontend/
│   ├── src/
│   │   ├── app.ts              # Application logic, tab management
│   │   └── flows/              # Privacy Cash integration
│   └── public/
│       └── assets/pay.png      # Logo
│
├── backend/
│   ├── src/
│   │   └── routes/             # API endpoints
│   └── prisma/
│       └── schema.prisma       # Database schema
│
└── README.md                    # This file
```

---

## 🔐 Security & Privacy

✅ **No Private Keys in Frontend** - Only message signing via Phantom  
✅ **Zero-Knowledge Proofs** - Transaction validity verified without revealing data  
✅ **Non-Custodial** - ShadowPay never holds your funds  
✅ **Encrypted Recipients** - Recipient address hidden on-chain  
✅ **Open Source** - Code is verifiable and auditable

---

## 🛠️ Development

### Build Frontend

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

### Environment Variables

**Frontend (auto):**
- Backend URL: `http://localhost:8080` (development)

**Backend (.env):**
```
NODE_ENV=development
PORT=8080
DATABASE_URL=sqlite:./db.sqlite
OPERATOR_SECRET_KEY=<keypair>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## 📊 Current Status

✅ **Working Features:**
- Wallet connection (Phantom)
- Send private payments with ZK proofs
- Receive and claim payments
- Transaction history (10 items/page pagination)
- Incoming payments tab (5 items/page)
- About tab with privacy explanation
- Multiple token support
- Clean UI with 4-tab navigation (Send/Receive/History/About)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit pull request

---

## 📝 License

MIT

---

## 🔗 Links

- **Privacy Cash**: https://privacycash.io/
- **Solana**: https://solana.com/
- **Phantom Wallet**: https://phantom.app/

---

**Questions?** Check the About tab in the app for more details on how privacy works!

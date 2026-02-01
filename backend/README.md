# 🚀 ShadowPay Backend - Express + Privacy Cash SDK

Non-custodial private payment API built with Node.js, Express, and Privacy Cash SDK.

## 📁 Project Structure

```
backend/
├── src/
│   ├── config.ts                       # Environment & configuration
│   ├── server.ts                       # Express server setup
│   ├── routes/
│   │   ├── deposit.ts                  # Private deposit endpoint
│   │   ├── depositSPL.ts               # SPL token deposits
│   │   ├── withdraw.ts                 # Withdrawal endpoint
│   │   ├── withdrawSPL.ts              # SPL token withdrawals
│   │   ├── claimLink.ts                # Claim payment endpoint
│   │   ├── createLink.ts               # Create payment link
│   │   ├── history.ts                  # Transaction history
│   │   ├── incoming.ts                 # Incoming payments
│   │   ├── health.ts                   # Health check
│   │   ├── operatorKeypair.ts          # Operator management
│   │   ├── savings.ts                  # Savings operations
│   │   ├── tokens.ts                   # Token info
│   │   ├── config.ts                   # Public config endpoint
│   │   └── link.ts                     # Link operations
│   ├── services/
│   │   ├── privacyCash.ts              # Privacy Cash wrapper
│   │   ├── linkService.ts              # Link management
│   │   ├── keypairManager.ts           # Operator key management
│   │   └── splTokenService.ts          # SPL token operations
│   ├── utils/
│   │   ├── privacyCashOperations.ts    # ZK proof operations
│   │   ├── operatorBalanceGuard.ts     # Balance monitoring
│   │   └── encryptionHelper.ts         # Message encryption
│   └── lib/
│       ├── prisma.ts                   # Database client
│       └── ensureSchema.ts             # Schema initialization
├── prisma/
│   ├── schema.prisma                   # Database schema
│   └── migrations/                     # Database migrations
├── package.json
├── tsconfig.json
└── .env.example
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- SQLite or PostgreSQL
- Solana wallet with SOL (for operator)
- Privacy Cash SDK (installed in package.json)

### Installation & Development

```bash
cd backend
npm install
npm run dev
```

**Backend runs on:** `http://localhost:8080`

### Environment Setup

Create `.env` file:

```bash
# Server
NODE_ENV=development
PORT=8080

# Database
DATABASE_URL=sqlite:./db.sqlite

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet

# Operator Keypair (REQUIRED - from generate-operator.ts)
# Format: 64 comma-separated numbers
OPERATOR_SECRET_KEY=232,221,205,...[64 bytes total]
```

### Generate Operator Keypair

```bash
npx ts-node generate-operator.ts
```

Output will show:
- Operator public key (fund this with SOL)
- Secret key (paste into OPERATOR_SECRET_KEY)
- Balance status

## 🏗️ Architecture

### Request Flow

```
Frontend (Browser)
    ↓
Browser: Phantom signs message
    ↓
Browser: Generate ZK proof (Privacy Cash SDK)
    ↓
POST /api/private-send
    ↓
Backend: Verify signature
    ↓
Backend: Record transaction (Prisma)
    ↓
Backend: Return success
    ↓
Frontend: Display confirmation
```

### Non-Custodial Design

✅ **Frontend never sends private keys**
- Only signs messages with Phantom

✅ **Backend never executes PrivacyCash**
- Frontend SDK handles all ZK operations
- Backend only records metadata

✅ **Operator is a relayer**
- Pays network fees
- Doesn't access user UTXOs
- Balance monitored hourly

## 📡 API Endpoints

### POST /api/private-send
Create private payment

**Request:**
```json
{
  "amount": 0.01,
  "senderAddress": "ABC123...",
  "recipientAddress": "XYZ789...",
  "token": "SOL"
}
```

**Response:**
```json
{
  "paymentId": "uuid",
  "amount": "0.01",
  "lamports": 10000000
}
```

### GET /api/incoming
Get incoming payments

**Response:**
```json
{
  "available": [
    {
      "id": "payment-id",
      "amount": "1.0",
      "sender": "ABC123...",
      "createdAt": "2026-01-31T..."
    }
  ],
  "withdrawn": [
    ...
  ]
}
```

### GET /api/history
Get transaction history

**Response:**
```json
{
  "sent": [
    {
      "id": "tx-id",
      "amount": "0.5",
      "recipient": "XYZ789...",
      "status": "confirmed",
      "createdAt": "2026-01-31T..."
    }
  ],
  "received": [
    ...
  ]
}
```

### GET /api/health
Health check

**Response:**
```json
{
  "status": "ok",
  "port": 8080,
  "timestamp": "2026-01-31T..."
}
```

### GET /api/config
Public configuration

**Response:**
```json
{
  "minAmount": "0.001",
  "network": "mainnet",
  "operatorAddress": "ABC123..."
}
```

## 💾 Database Schema

### Links Table
```sql
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  amount TEXT NOT NULL,
  assetType TEXT DEFAULT 'SOL',
  recipientAddress TEXT,
  claimed BOOLEAN DEFAULT false,
  claimedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  linkId TEXT,
  senderAddress TEXT,
  recipientAddress TEXT,
  amount TEXT,
  status TEXT ('pending', 'confirmed', 'failed'),
  transactionHash TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

See `prisma/schema.prisma` for full schema.

## 🔐 Security Considerations

### Signature Verification
```typescript
// Backend verifies frontend signature
const isValid = nacl.sign.detached.verify(
  messageBytes,
  signatureBytes,
  publicKeyBytes
)
```

### Operator Balance Monitoring
```
Every 1 hour:
  Check operator balance
  Alert if < 0.05 SOL (warning)
  Alert if < 0.01 SOL (critical)
```

### Environment Protection
```bash
# Production
NODE_ENV=production
# Errors are generic (no info leak)

# Development
NODE_ENV=development
# Full error details for debugging
```

### Key Management
```typescript
// Keys never logged or exposed
// Validate key format (must be 64 bytes)
// Use environment variables only
```

## 🔄 Privacy Cash Integration

### Deposit Flow
1. Frontend generates ZK proof
2. Frontend signs deposit transaction
3. Frontend submits to Privacy Cash relayer
4. Backend records transaction
5. UTXO encrypted to recipient's key

### Withdrawal Flow
1. Recipient decrypts UTXO using their key
2. Recipient generates withdrawal proof
3. Recipient withdraws to their wallet
4. Backend records withdrawal

### Zero-Knowledge Proofs
- Generated client-side (frontend)
- Verified on-chain by Solana
- No private data revealed

## 📊 Monitoring

### Operator Balance Checks
```
Status: ✓ Running
Check Interval: 60 minutes
Last Check: 2026-01-31 12:30 UTC
Current Balance: 0.250 SOL
Status: OK (above 0.01 SOL minimum)
```

### Logs
```bash
# Development logs to console
npm run dev

# Production logs to file
tail -f logs/production.log
```

## 🛠️ Database Management

### Run Migrations
```bash
npm run migrations
```

### Seed Database
```bash
npm run seed
```

### Reset Database (development only)
```bash
# Delete and recreate
rm db.sqlite
npm run migrations
```

## 🚢 Deployment

### Railway Deployment

```bash
# 1. Set environment variables
PORT=8080
DATABASE_URL=postgresql://user:pass@host/db
OPERATOR_SECRET_KEY=232,221,205,...

# 2. Deploy
railway up
```

### Vercel Serverless (if using edge functions)

Not recommended for this app - use Railway or similar for persistent server.

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| Build time | ~5s |
| Server startup | <1s |
| API response | 100-500ms |
| Database query | 10-100ms |
| ZK proof verify | <1s (on-chain) |

## 🐛 Troubleshooting

### Error: "OPERATOR_SECRET_KEY not set"
```bash
# Generate operator key
npx ts-node generate-operator.ts
# Copy key to .env OPERATOR_SECRET_KEY=...
```

### Error: "Operator balance insufficient"
```bash
# Send SOL to operator wallet
# Check address in logs
# Wait ~30 seconds for next check
```

### Error: "Cannot connect to database"
```bash
# Ensure DATABASE_URL is correct
# For SQLite: DATABASE_URL=sqlite:./db.sqlite
# For PostgreSQL: DATABASE_URL=postgresql://...
# Run migrations: npm run migrations
```

### Error: "Signature verification failed"
```bash
# Frontend must sign with Phantom
# Message format must be exact
# Check logs for signature details
```

## 📚 Resources

- **Express.js:** https://expressjs.com/
- **Prisma ORM:** https://www.prisma.io/
- **Privacy Cash SDK:** https://github.com/privacy-cash/...
- **Solana:** https://solana.com/
- **Railway:** https://railway.app/

## 📄 License

MIT

---

**Ready to run!** Start with `npm run dev` 🚀

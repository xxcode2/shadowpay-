# ShadowPay - Privacy Cash Integration Guide

ShadowPay is a **non-custodial private payment link system** built on Solana using the Privacy Cash SDK.

## Architecture (LOCKED)

### Core Principles
1. **Privacy Cash SDK runs ONLY in the frontend (browser)**
2. **Backend MUST NOT import or initialize PrivacyCash**
3. **Backend MUST NOT hold private keys, encryption keys, commitments, or UTXOs**
4. **All cryptographic operations happen in the browser**
5. **Backend is metadata-only orchestration**

### Backend Responsibilities
- Create payment link records
- Check link validity
- Prevent double-claim (atomic database operations)
- Mark link as claimed
- Store transaction metadata

### Frontend Responsibilities
- Handle wallet connection
- Sign off-chain message for encryption key derivation
- Execute deposits via Privacy Cash SDK
- Execute withdrawals via Privacy Cash SDK
- Send metadata to backend

## Integration Flows

### Sender Flow (Deposit)

```
1. User creates a payment link
   POST /api/create-link { amount, assetType }
   ← Returns linkId

2. User connects wallet and derives encryption key
   - Wallet signs off-chain message
   - EncryptionService derives key from signature
   - Key stored only in browser memory

3. User deposits via Privacy Cash SDK
   await client.deposit({ lamports })
   ← Returns { tx }

4. Frontend records deposit on backend
   POST /api/deposit { linkId, depositTx }
   ← Link is now ready to share

5. Sender shares link URL
   https://shadowpay.vercel.app?link={linkId}
```

### Receiver Flow (Withdraw/Claim)

```
1. Receiver opens payment link
   GET /api/link/{linkId}
   ← Get link metadata (amount, assetType, claimed status)

2. Receiver connects wallet and derives encryption key
   - Wallet signs off-chain message
   - EncryptionService derives key from signature

3. Receiver withdraws via Privacy Cash SDK
   await client.withdraw({ lamports, recipientAddress })
   ← Returns { tx, recipient, amount_in_lamports, fee_in_lamports }

4. Frontend claims link on backend (ATOMIC)
   POST /api/claim-link { linkId, withdrawTx, recipientAddress }
   ← Link marked as claimed (prevents double-claim)

5. Receiver receives funds in clean wallet
   - No on-chain link between deposit and withdrawal
   - Privacy guaranteed by Privacy Cash protocol
```

## Backend Endpoints

### POST /api/create-link
Creates a new payment link.

**Request:**
```json
{
  "amount": 1000000000,
  "assetType": "SOL"
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "abc123...",
  "amount": 1000000000,
  "assetType": "SOL",
  "shareUrl": "https://shadowpay.vercel.app?link=abc123..."
}
```

### POST /api/deposit
Records a deposit transaction.

**Request:**
```json
{
  "linkId": "abc123...",
  "depositTx": "5Jd7..."
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "abc123...",
  "depositTx": "5Jd7...",
  "message": "Deposit recorded. Link is ready to claim."
}
```

### POST /api/claim-link
Claims a link and marks it as withdrawn (ATOMIC).

**Request:**
```json
{
  "linkId": "abc123...",
  "withdrawTx": "9Kd4...",
  "recipientAddress": "So11111111111111111111111111111111111111112"
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "abc123...",
  "claimedBy": "So11111111111111111111111111111111111111112",
  "withdrawTx": "9Kd4...",
  "amount": 1000000000,
  "assetType": "SOL",
  "message": "Link successfully claimed"
}
```

### GET /api/link/:id
Retrieves link metadata.

**Response:**
```json
{
  "id": "abc123...",
  "amount": 1000000000,
  "assetType": "SOL",
  "claimed": false,
  "claimedBy": null,
  "depositTx": "5Jd7...",
  "withdrawTx": null,
  "createdAt": "2026-01-23T...",
  "updatedAt": "2026-01-23T..."
}
```

## Database Schema

```prisma
model PaymentLink {
  id          String   @id @default(cuid())
  amount      Float
  assetType   String   // "SOL", "USDC", "USDT"
  
  claimed     Boolean  @default(false)
  claimedBy   String?
  
  depositTx   String
  withdrawTx  String?
  
  transactions Transaction[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("payment_links")
}

model Transaction {
  id              String   @id @default(cuid())
  type            String   // "deposit" | "withdraw"
  status          String   @default("pending")
  amount          Float
  assetType       String
  transactionHash String
  fromAddress     String?
  toAddress       String?
  
  linkId          String
  link            PaymentLink @relation(fields: [linkId])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([linkId])
  @@map("transactions")
}
```

### Key Design Decisions
- ❌ **NO commitment field** - Backend doesn't manage cryptographic state
- ❌ **NO encryption key column** - Keys stay in browser only
- ❌ **NO UTXO tracking** - Privacy Cash SDK manages UTXOs privately
- ✅ **Atomic claim** - `UPDATE WHERE claimed=false` prevents double-spend
- ✅ **Metadata only** - Backend stores transaction hashes, not private data

## Privacy Cash SDK Usage

### Frontend Services

#### PrivacyCashService
Manages encryption key derivation from wallet signatures.

```typescript
import { PrivacyCashService } from '@/services/privacyCashService'

// Derive encryption key
await PrivacyCashService.deriveEncryptionKey(wallet)

// Check if ready
if (PrivacyCashService.isReady()) {
  // Safe to use Privacy Cash SDK
}
```

#### Deposit Flow
```typescript
import { executeDeposit } from '@/flows/depositFlow'

const result = await executeDeposit({
  linkId: 'abc123...',
  lamports: 1000000000,
  wallet,
  assetType: 'SOL',
})
```

#### Claim/Withdraw Flow
```typescript
import { executeClaimLink } from '@/flows/claimLinkFlow'

const result = await executeClaimLink({
  linkId: 'abc123...',
  recipientWallet: wallet,
})
```

### Privacy Cash SDK API Reference

#### Initialize Client
```typescript
import { PrivacyCash } from 'privacycash'

const client = new PrivacyCash({
  RPC_url: 'https://api.mainnet-beta.solana.com',
  owner: wallet.publicKey,
  enableDebug: false,
})
```

#### Deposit SOL
```typescript
const result = await client.deposit({
  lamports: 1000000000 // 1 SOL
})
// Returns: { tx: "5Jd7..." }
```

#### Withdraw SOL
```typescript
const result = await client.withdraw({
  lamports: 1000000000,
  recipientAddress: 'So11...',
})
// Returns: {
//   tx: "9Kd4...",
//   recipient: "So11...",
//   amount_in_lamports: 994000000,
//   fee_in_lamports: 6000000,
//   isPartial: false
// }
```

#### Check Balance
```typescript
const balance = await client.getPrivateBalance()
// Returns: { lamports: 1000000000 }
```

## Double-Claim Prevention

The critical security feature is **atomic database updates**:

```typescript
// CORRECT: Only updates if claimed is false
const updated = await prisma.paymentLink.updateMany({
  where: {
    id: linkId,
    claimed: false, // ← Critical check
  },
  data: {
    claimed: true,
    claimedBy: recipientAddress,
    withdrawTx,
  },
})

if (updated.count === 0) {
  throw new Error('Link already claimed')
}
```

This ensures that even with race conditions or multiple simultaneous requests, only ONE claim succeeds.

## Security Considerations

### What the Backend Can't Do
- ❌ Initialize Privacy Cash SDK
- ❌ Hold private keys or mnemonics
- ❌ Hold encryption keys
- ❌ Manage UTXOs
- ❌ Execute deposits (user does via SDK)
- ❌ Execute withdrawals (user does via SDK)
- ❌ Generate zero-knowledge proofs

### What the Backend Must Do
- ✅ Validate input (amount, addresses, linkId)
- ✅ Check link existence and status
- ✅ Record transaction hashes
- ✅ Prevent double-claim atomically
- ✅ Serve metadata only

### What the Frontend Must Do
- ✅ Request user signature for encryption key
- ✅ Manage wallet connection
- ✅ Execute Privacy Cash SDK deposits
- ✅ Execute Privacy Cash SDK withdrawals
- ✅ Send transaction hashes to backend

### Never
- 🚫 Send private keys to backend
- 🚫 Send encryption keys to backend
- 🚫 Send wallet seed phrases anywhere
- 🚫 Trust backend for privacy (use Privacy Cash SDK)
- 🚫 Execute crypto ops on backend

## Environment Setup

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/shadowpay
NODE_ENV=production
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Frontend (.env.local)
```
VITE_BACKEND_URL=https://api.shadowpay.vercel.app
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SHARE_BASE_URL=https://shadowpay.vercel.app
```

## Deployment

### Backend
```bash
npm install
npx prisma migrate deploy
npm run build
npm start
```

### Frontend
```bash
npm install
npm run build
npm run preview
```

## Testing

### Create a Link
```bash
curl -X POST http://localhost:3000/api/create-link \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000000000, "assetType": "SOL"}'
```

### Get Link Details
```bash
curl http://localhost:3000/api/link/{linkId}
```

### Record Deposit
```bash
curl -X POST http://localhost:3000/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"linkId": "{linkId}", "depositTx": "5Jd7..."}'
```

### Claim Link
```bash
curl -X POST http://localhost:3000/api/claim-link \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "{linkId}",
    "withdrawTx": "9Kd4...",
    "recipientAddress": "So11..."
  }'
```

## Files Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── createLink.ts      # POST /api/create-link
│   │   ├── deposit.ts         # POST /api/deposit
│   │   ├── withdraw.ts        # POST /api/claim-link
│   │   └── link.ts            # GET /api/link/:id
│   ├── services/
│   │   └── linkManager.ts     # Core business logic
│   ├── lib/
│   │   └── prisma.ts          # Database client
│   └── server.ts              # Express app
├── prisma/
│   └── schema.prisma          # Database schema
└── package.json

frontend/
├── src/
│   ├── services/
│   │   └── privacyCashService.ts     # Encryption key management
│   ├── flows/
│   │   ├── depositFlow.ts            # Deposit orchestration
│   │   └── claimLinkFlow.ts          # Claim/withdraw orchestration
│   ├── api/
│   │   └── linkApi.ts                # API client
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   ├── config.ts                     # Configuration
│   └── INTEGRATION_GUIDE.ts          # Usage examples
└── package.json
```

## Common Issues

### "Insufficient balance"
User needs more SOL in wallet for network fees + deposit amount.

### "Link already claimed"
Someone already withdrew from this link.

### "Failed to sign message"
User rejected wallet signature request. Try again and approve the message.

### "Deposit already recorded"
This link already has a deposit. Create a new link.

### "No private balance"
User hasn't deposited any Privacy Cash funds yet.

## Performance Tips

### Balance Checking
```typescript
// Cache balance for 30 seconds
const balance = await client.getPrivateBalance()
// SDK caches UTXOs locally
await client.clearCache() // Force refresh
```

### Multiple Withdrawals
```typescript
// Split large amounts to improve privacy
await client.withdraw({ lamports: 400_000_000 })
// Wait a day
await client.withdraw({ lamports: 350_000_000 })
// Wait another day
await client.withdraw({ lamports: 250_000_000 })
```

## License

MIT - See LICENSE file

## Support

For issues or questions about the Privacy Cash SDK, see:
https://github.com/Privacy-Cash/privacy-cash-sdk

For ShadowPay architecture questions, see ARCHITECTURE.md

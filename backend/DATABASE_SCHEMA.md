# 🗄️ ShadowPay Database Schema

**Database:** Supabase PostgreSQL  
**ORM:** Prisma  
**Status:** ✅ Integrated with Supabase

---

## Database Tables

### 1. `payment_links`
Stores all payment links created by users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (CUID) | Unique link identifier |
| `amount` | Float | Amount of SOL/USDC/USDT |
| `assetType` | String | Asset type: "SOL", "USDC", or "USDT" |
| `claimed` | Boolean | Whether link has been claimed |
| `claimedBy` | String (nullable) | Wallet address that claimed the link |
| `depositTx` | String | Transaction hash from deposit |
| `withdrawTx` | String (nullable) | Transaction hash from withdrawal |
| `createdAt` | DateTime | When link was created |
| `updatedAt` | DateTime | Last updated timestamp |

**Example:**
```json
{
  "id": "clh7x8y9z0a1b2c3d4e5f6g7",
  "amount": 0.5,
  "assetType": "SOL",
  "claimed": false,
  "claimedBy": null,
  "depositTx": "5cJz...qWq",
  "withdrawTx": null,
  "createdAt": "2024-01-20T12:00:00Z",
  "updatedAt": "2024-01-20T12:00:00Z"
}
```

---

### 2. `transactions`
Audit log of all deposit and withdraw transactions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (CUID) | Unique transaction identifier |
| `type` | String | "deposit" or "withdraw" |
| `linkId` | String | Reference to payment_links.id |
| `transactionHash` | String (UNIQUE) | Solana transaction hash |
| `status` | String | "pending", "confirmed", or "failed" |
| `amount` | Float | Transaction amount |
| `assetType` | String | Asset type |
| `fromAddress` | String (nullable) | Sender wallet address |
| `toAddress` | String (nullable) | Recipient wallet address |
| `createdAt` | DateTime | When transaction was recorded |
| `updatedAt` | DateTime | Last updated timestamp |

---

## API Endpoints

### Deposit (Create Link)
**POST** `/api/deposit`

**Request:**
```json
{
  "amount": 0.5,
  "assetType": "SOL",
  "depositTx": "5cJz...qWq"
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "clh7x8y9z0a1b2c3d4e5f6g7",
  "depositTx": "5cJz...qWq",
  "url": "https://shadowpay.vercel.app/link/clh7x8y9z0a1b2c3d4e5f6g7"
}
```

---

### Get Link
**GET** `/api/link/:id`

**Response:**
```json
{
  "id": "clh7x8y9z0a1b2c3d4e5f6g7",
  "amount": 0.5,
  "assetType": "SOL",
  "claimed": false,
  "claimedBy": null,
  "createdAt": "2024-01-20T12:00:00Z",
  "updatedAt": "2024-01-20T12:00:00Z"
}
```

---

### Withdraw (Claim Link)
**POST** `/api/withdraw`

**Request:**
```json
{
  "linkId": "clh7x8y9z0a1b2c3d4e5f6g7",
  "recipientAddress": "9B5X...gX3",
  "withdrawTx": "3aBc...dEf"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Withdrawal recorded and link claimed",
  "withdrawTx": "3aBc...dEf",
  "link": {
    "id": "clh7x8y9z0a1b2c3d4e5f6g7",
    "amount": 0.5,
    "assetType": "SOL",
    "claimed": true,
    "claimedBy": "9B5X...gX3",
    "createdAt": "2024-01-20T12:00:00Z",
    "updatedAt": "2024-01-20T12:00:00Z"
  }
}
```

---

## Setup & Migration

### Local Development
```bash
# Install dependencies
npm install

# Setup Prisma
npx prisma migrate dev --name init

# View database in Prisma Studio
npm run db:studio
```

### Production (Vercel)
Database URL is set via environment variable in vercel.json:
```
DATABASE_URL=postgres://postgres.cojxffgdjlhbuyokrpib:5enFwLqFBJBUq77w@...
```

---

## Security Notes

- ✅ No private keys stored
- ✅ No sensitive SDK data persisted
- ✅ Transaction hashes are immutable audit trail
- ✅ All addresses are public (on-chain public keys)
- ✅ Supabase provides encryption at rest
- ✅ RLS policies can be enabled for additional security
  lastActive: Date;
  linksCreated: number;
  totalDeposited: number;  // Dalam SOL equivalent
  
  // UNIQUE INDEX: walletAddress
  // INDEX: createdAt (untuk analytics)
}

// Implementation Examples:

// PostgreSQL
/*
CREATE TABLE payment_links (
  id VARCHAR(32) PRIMARY KEY,
  amount BIGINT NOT NULL,
  asset_type VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP,
  claimed_by VARCHAR(44),
  deposit_tx VARCHAR(88) NOT NULL,
  expires_at TIMESTAMP,
  
  INDEX idx_created_at (created_at),
  INDEX idx_claimed_at (claimed_at)
);

CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(10) NOT NULL,
  link_id VARCHAR(32),
  wallet_address VARCHAR(44) NOT NULL,
  asset_type VARCHAR(10) NOT NULL,
  amount BIGINT NOT NULL,
  tx_hash VARCHAR(88) NOT NULL UNIQUE,
  status VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error TEXT,
  
  INDEX idx_tx_hash (tx_hash),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (link_id) REFERENCES payment_links(id)
);
*/

// MongoDB
/*
db.paymentLinks.createIndex({ createdAt: 1 })
db.paymentLinks.createIndex({ claimedAt: 1 })

db.transactions.createIndex({ txHash: 1 }, { unique: true })
db.transactions.createIndex({ walletAddress: 1 })
db.transactions.createIndex({ createdAt: 1 })
*/

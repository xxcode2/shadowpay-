# ShadowPay Backend

Node.js backend server for ShadowPay, using Privacy Cash SDK to handle private payments.

## Architecture

### Components

1. **Privacy Cash Integration** (`src/privacy/privacyCash.ts`)
   - Initializes and manages PrivacyCash SDK instance
   - Handles connection to Solana RPC
   - Manages backend keypair for signing

2. **Link Manager** (`src/privacy/linkManager.ts`)
   - Manages payment link lifecycle (create, lookup, claim)
   - In-memory storage (MVP - upgrade to DB for production)

3. **API Routes**
   - `POST /api/deposit` - Create private payment link
   - `POST /api/withdraw` - Claim and withdraw from link
   - `GET /api/link/:id` - Lookup link details
   - `POST /api/link/:id/claim` - Mark link as claimed

## Data Flow

### Deposit (Create Link)

```
Frontend User A
    ↓
[Connect Wallet]
    ↓
POST /api/deposit { amount, assetType }
    ↓
Backend (Privacy Cash SDK)
    ↓
- Generates UTXO pair
- Encrypts UTXOs
- Submits to Privacy Cash relayer
    ↓
Returns: linkId, depositTx
    ↓
Frontend displays payment link
```

### Withdraw (Claim Link)

```
Frontend User B
    ↓
[Open payment link]
    ↓
GET /api/link/:id
    ↓
[Connect wallet]
    ↓
POST /api/withdraw { amount, assetType, recipientAddress }
    ↓
Backend (Privacy Cash SDK)
    ↓
- Creates ZK proof
- Verifies against Merkle tree
- Submits to Privacy Cash relayer
- Relayer signs and executes
    ↓
Returns: withdrawTx, amountReceived
    ↓
Funds arrive at recipient
```

## Setup

### Prerequisites
- Node.js 24+
- Solana devnet/testnet/mainnet RPC URL

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your Solana RPC URL
3. Generate backend keypair:
   ```bash
   solana-keygen new --no-passphrase --outfile backend-keypair.json
   ```
4. Encode keypair to base64 and add to `.env` as `BACKEND_KEYPAIR_SECRET`

### Running

**Development:**
```bash
npm run dev
```

**Build & Run:**
```bash
npm run build
npm start
```

## API Contracts

### POST /api/deposit

**Request:**
```json
{
  "amount": 0.01,
  "assetType": "SOL"
}
```

**Response:**
```json
{
  "success": true,
  "linkId": "a1b2c3d4...",
  "depositTx": "5xAbc..."
}
```

### GET /api/link/:id

**Response:**
```json
{
  "id": "a1b2c3d4...",
  "amount": 0.01,
  "assetType": "SOL",
  "claimed": false,
  "claimedBy": null
}
```

### POST /api/withdraw

**Request:**
```json
{
  "amount": 0.01,
  "assetType": "SOL",
  "recipientAddress": "EZC...xyz"
}
```

**Response:**
```json
{
  "success": true,
  "withdrawTx": "7xDef...",
  "recipient": "EZC...xyz",
  "amountReceived": 1000000,
  "fees": 5000
}
```

## Privacy Model

- **Deposit**: User signs locally, backend relays to Privacy Cash
- **Withdraw**: Backend uses SDK to create ZK proof, relayer signs
- **Link**: Identified by random hash, no public wallet connection
- **Asset Type**: Separated by SPL mint, no cross-mixing

## Supported Assets

- SOL (native Solana)
- USDC
- USDT

## Important Notes

### SDK Responsibility

DO NOT reimplement:
- ZK proof generation
- Merkle tree logic
- UTXO encryption/decryption
- Snarkjs circuit interaction
- WASM loading

Privacy Cash SDK handles all of this.

### Backend Responsibilities

- Initialize PrivacyCash with backend keypair
- Accept API requests from frontend
- Call SDK methods (deposit/withdraw)
- Manage payment link lifecycle
- Return transaction signatures

### Frontend Responsibilities

- Connect user's wallet
- Sign transactions locally
- Display UI
- Call backend API
- Never directly use PrivacyCash SDK

## Production Considerations

1. **Storage**: Replace in-memory links with database (PostgreSQL, MongoDB)
2. **Queue**: Use Bull/RabbitMQ for async deposit/withdrawal processing
3. **Monitoring**: Add logging, metrics, alerting
4. **Rate Limiting**: Add rate limiting per IP/wallet
5. **Validation**: Strict input validation, amount limits
6. **Error Handling**: Graceful error recovery, transaction retry logic
7. **Keys**: Use key management service (AWS KMS, HashiCorp Vault)
8. **CORS**: Configure specific allowed origins

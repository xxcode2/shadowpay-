# Privacy Cash SDK Integration Guide

## Architecture Overview

### Non-Custodial Deposit Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (User's Browser)                                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. User derives encryption key from wallet signature             │
│    └─> Signs "Privacy Money account sign in"                    │
│    └─> Creates encryption key (only user has this)              │
│                                                                   │
│ 2. Create UTXO (Unspent Transaction Output)                     │
│    └─> amount: User's deposit amount                            │
│    └─> blinding: Random secret (for privacy)                    │
│    └─> pubkey: PoseidonHash(private_key)                        │
│    └─> commitment: Hash(amount, pubkey, blinding, mint)         │
│                                                                   │
│ 3. User signs the UTXO with wallet                              │
│    └─> Wallet popup appears                                     │
│    └─> User approves the transaction                            │
│    └─> Signature is obtained                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend (Operator as Relayer)                                    │
├─────────────────────────────────────────────────────────────────┤
│ 4. Receive signed UTXO from frontend                             │
│    └─> Verify signature                                         │
│    └─> Record in database                                       │
│                                                                   │
│ 5. Relay to Privacy Cash indexer                                │
│    └─> POST /deposit with signed UTXO                           │
│    └─> Forward to Privacy Cash network                          │
│    └─> Get transaction signature                                │
│                                                                   │
│ 6. Return confirmation to frontend                              │
│    └─> Transaction signature                                    │
│    └─> Status: In Privacy Cash pool                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Privacy Cash Network                                             │
├─────────────────────────────────────────────────────────────────┤
│ • Funds are now encrypted in Privacy Cash pool                  │
│ • Only user (with encryption key) can decrypt/withdraw          │
│ • Operator never has custody                                    │
│ • Funds remain on-chain or fully custodied by Privacy Cash      │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Encryption Key Derivation

**Purpose**: Create a unique encryption key for this user

```typescript
// User signs off-chain message
const message = "Privacy Money account sign in"
const signature = await wallet.signMessage(message)

// Encryption service derives key from signature
const encryptionService = new EncryptionService()
encryptionService.deriveEncryptionKeyFromSignature(signature)
```

**Result**: Only this user can decrypt their UTXOs

### 2. UTXO (Unspent Transaction Output)

**Structure**:
```typescript
{
  amount: BN,           // Amount in lamports/base units
  blinding: BN,         // Random secret (privacy factor)
  pubkey: string,       // PoseidonHash(private_key)
  mintAddress: string,  // Token mint (SOL or SPL token)
  index: number,        // Position in merkle tree
}
```

**Creation**:
```typescript
const amount = new BN(1_000_000_000) // 1 SOL
const blinding = new BN(Math.floor(Math.random() * 1000000000))
const utxoKeypair = encryptionService.getUtxoKeypair()

// UTXO represents encrypted funds
const utxo = {
  amount,
  blinding,
  pubkey: utxoKeypair.pubkey,
  mintAddress: "So11111111111111111111111111111111111111112" // SOL
}
```

### 3. Commitment (Privacy Commitment)

**Formula**:
```
commitment = PoseidonHash(amount, pubkey, blinding, mintAddress)
```

**Purpose**: 
- Proves funds are committed to Privacy Cash pool
- Only verifiable with user's key
- Used to prevent double-spending

### 4. Nullifier (Spend Proof)

**Formula**:
```
nullifier = PoseidonHash(commitment, index, signature)
```

**Purpose**:
- Marks UTXO as "spent" when withdrawn
- Prevents same UTXO from being used twice
- User signs with private key to create

## Implementation Steps

### Step 1: User Initializes Encryption Key

```typescript
// In PrivacyCashService.deriveEncryptionKey(wallet)
const message = new TextEncoder().encode("Privacy Money account sign in")
const signature = await wallet.signMessage(message)
const encryptionService = new EncryptionService()
encryptionService.deriveEncryptionKeyFromSignature(signature)
```

### Step 2: Create UTXO for Deposit

```typescript
// In executeRealDeposit()
const amountBN = new BN(lamports)
const blindingBN = new BN(Math.random() * 1e9)
const utxoKeypair = PrivacyCashService.getUtxoKeypair()

const utxoData = {
  amount: amountBN.toString(),
  blinding: blindingBN.toString(),
  pubkey: utxoKeypair.pubkey.toString(),
  mintAddress: "So11111111111111111111111111111111111111112",
  timestamp: Date.now(),
  linkId,
}
```

### Step 3: User Signs UTXO

```typescript
const messageToSign = new TextEncoder().encode(
  JSON.stringify(utxoData)
)
const signature = await wallet.signMessage(messageToSign)
```

### Step 4: Backend Relays to Privacy Cash

```typescript
// In /api/deposit/relay endpoint
const relayResponse = await fetch(
  'https://api3.privacycash.org/deposit',
  {
    method: 'POST',
    body: JSON.stringify({
      utxo: depositPayload.utxo,
      signature: depositPayload.signature,
      senderAddress: depositPayload.senderAddress,
    })
  }
)
```

## Data Flow for Deposit

```
Frontend Flow:
1. User connects wallet (Phantom, Solflare, etc)
2. User enters amount
3. Click "Deposit to Privacy Cash"
   → deriveEncryptionKey() - user signs once
   → Creates UTXO with random blinding
   → User signs UTXO with wallet
   → Sends to /api/deposit/relay

Backend Flow:
4. Receives signed UTXO from frontend
5. Verifies signature
6. Records in database:
   - linkId (which link this is for)
   - UTXO data (amount, commitment)
   - Signature
7. Relays to Privacy Cash indexer
8. Receives transaction signature
9. Returns success to frontend

Privacy Cash Network:
10. Creates commitment on-chain
11. Encrypts UTXO with user's pubkey
12. Stores in database
13. Only user can decrypt with privkey

User's Withdraw Flow:
- User requests withdrawal
- Uses privkey to decrypt their UTXO
- Creates nullifier (spend proof)
- Backend relays withdrawal
- Privacy Cash marks as spent
- Funds sent to user's wallet
```

## SPL Token Support

For SPL tokens (like USDC), use `getUtxosSPL()` and `depositSPL()`:

```typescript
// Get user's USDC UTXOs
const usdcMint = new PublicKey("EPjFWaJy47gHeQZzauZsi29Qdf3qLvQfuqwMsrmjQAGk")
const utxos = await getUtxosSPL({
  publicKey: userWallet,
  connection,
  encryptionService,
  storage,
  mintAddress: usdcMint
})

// Deposit USDC
await depositSPL({
  publicKey: userWallet,
  lamports: 10_000_000, // 10 USDC
  encryptionService,
  connection,
  storage,
  mintAddress: usdcMint
})
```

## Privacy & Security Properties

### ✅ Non-Custodial
- Operator never holds user funds
- Operator only relays transactions
- User signs with their own wallet

### ✅ Encrypted
- UTXOs encrypted with user's key
- Only user can decrypt their balance
- Randomization via "blinding" factor

### ✅ Private
- Amounts not visible on-chain
- User identity not linked to amounts
- Nullifiers prevent traceability

### ✅ Verifiable
- ZK proofs used for withdrawals
- No cheating possible
- Privacy Cash network is trustless

## Error Handling

```typescript
// User rejects signature
try {
  const sig = await wallet.signMessage(message)
} catch (err) {
  // "User rejected the signature"
  // Catch and show user-friendly error
}

// Network timeout
try {
  const res = await fetch(relayUrl)
} catch (err) {
  // "Network timeout. Please try again."
  // Implement retry logic
}

// Privacy Cash unavailable
try {
  const res = await fetch(privacyCashUrl)
} catch (err) {
  // "Privacy Cash SDK error. Please refresh."
  // Fallback to previous block
}
```

## Testing Locally

```bash
# Start backend (relayer)
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Open browser and test:
# 1. Connect Phantom wallet (devnet)
# 2. Request devnet SOL airdrop
# 3. Create payment link
# 4. Try deposit flow
# 5. Check database for recorded deposit
```

## References

- **Tornado Cash Nova**: UTXO model inspiration
  - https://github.com/tornadocash/tornado-nova
  - Uses same ZK proving system

- **Privacy Cash**: Full non-custodial privacy
  - Solana-native implementation
  - Merkle tree of commitments
  - Relayer pattern for privacy

- **EdDSA & Poseidon Hash**: Cryptographic primitives
  - EdDSA signatures on Curve25519
  - Poseidon hash function (ZK-friendly)

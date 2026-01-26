# ShadowPay - Privacy Cash SDK Integration Guide

This document provides complete integration documentation for the Privacy Cash SDK in ShadowPay.

## Overview

ShadowPay integrates the Privacy Cash SDK to enable private, shielded deposits and withdrawals. The SDK handles:
- ✅ User signature requests for encryption key derivation
- ✅ Zero-knowledge proof generation
- ✅ Encrypted UTXO creation
- ✅ Direct transaction submission to Solana

## Architecture

### Frontend Flow

```
User Input (Amount)
    ↓
Connect Wallet (Phantom)
    ↓
Request Signature ("Privacy Money account sign in")
    ↓
SDK Initializes Privacy Cash Client
    ↓
SDK Generates ZK Proof
    ↓
SDK Executes Deposit Transaction
    ↓
Frontend Receives Transaction Signature
    ↓
Record in Backend Database
```

### Key Components

#### 1. **PrivacyCash SDK Initialization**

```typescript
const pc = new PrivacyCash({
  RPC_url: RPC_URL,        // Solana RPC endpoint
  owner: wallet,           // Wallet adapter or Keypair
  enableDebug: isDev       // Enable debug logging
})
```

#### 2. **Deposit Execution**

```typescript
const result = await pc.deposit({
  lamports: 100_000_000  // Amount in lamports
})
// Returns: { tx: string } - Transaction signature
```

#### 3. **Backend Recording**

Backend receives transaction hash and records it in database:
- Validates link existence
- Stores transaction hash
- Creates transaction record
- Returns confirmation

## Frontend Integration

### File: `frontend/src/flows/depositFlow.ts`

This file handles the deposit execution using the Privacy Cash SDK.

**Key Features:**
- SDK initialization with RPC URL
- Wallet signature handling
- Transaction execution
- Error handling with user-friendly messages
- Backend notification

**Usage:**
```typescript
import { executeRealDeposit } from './flows/depositFlow.ts'

const result = await executeRealDeposit({
  lamports: 100_000_000,  // 0.1 SOL
  wallet: walletAdapter,  // Phantom wallet
  linkId: 'payment-link-id'
})

console.log('Deposit TX:', result.tx)
```

### File: `frontend/src/services/privacyCashService.ts`

Service for managing encryption key derivation and Privacy Cash operations.

**Methods:**
- `deriveEncryptionKey(wallet)` - Derive encryption key from wallet signature
- `isReady()` - Check if service is initialized
- `getEncryptionService()` - Get encryption service instance
- `reset()` - Reset state for wallet switching

## Backend Integration

### File: `backend/src/routes/deposit.ts`

REST endpoint: `POST /api/deposit`

**Request Body:**
```json
{
  "linkId": "string",          // Payment link ID
  "depositTx": "string",       // Transaction signature
  "amount": "string|number",   // Amount in SOL
  "publicKey": "string"        // Sender's public key
}
```

**Response:**
```json
{
  "success": true,
  "tx": "string",              // Transaction signature
  "amount": "number",
  "message": "string",
  "fee": {
    "depositFee": 0,
    "note": "Withdrawal fees (0.006 SOL + 0.35%) will be charged when recipient claims"
  }
}
```

**Validations:**
- Link exists and not already funded
- Valid Solana address format
- Required fields present

## Deposit Flow Details

### 1. Transaction Created
- User provides amount in SOL
- SDK creates deposit transaction with ZK proof

### 2. Relayer Screening
- Your wallet address is screened through CipherOwl for malicious activity
- Transaction signature is verified

### 3. On-Chain Submission
- Relayer submits transaction to Solana blockchain
- Transaction is confirmed on mainnet

### 4. UTXO Created
- Encrypted UTXO is created and stored on-chain
- Only decryptable by you using your encryption key
- ShadowPay backend records transaction hash for tracking

## Zero-Knowledge Proof

The Privacy Cash SDK automatically handles ZK proof generation:

```typescript
// SDK handles all of this internally:
// 1. ZK proof proves you own the funds
// 2. Encrypted commitment only you can decrypt
// 3. Relayer cannot modify parameters
const result = await pc.deposit({ lamports: 50_000_000 })
```

## Deposit Limits

The protocol enforces deposit limits to prevent abuse:

```typescript
try {
  const result = await pc.deposit({ lamports })
} catch (error) {
  if (error.message.includes("Don't deposit more than")) {
    // Reduce amount and retry
  }
}
```

Check current limits by examining error messages during deposit.

## Fees

| Fee Type | Amount |
|----------|--------|
| Protocol Fee | Free (0) |
| Network Fee | ~0.002 SOL (Solana transaction fee) |
| Withdrawal Fee | 0.006 SOL + 0.35% (when claiming) |

## Consolidation

Multiple deposits are automatically consolidated:

```typescript
// First deposit: 0.1 SOL
await executeRealDeposit({
  lamports: 100_000_000,
  wallet,
  linkId: 'link-1'
})

// Second deposit: 0.05 SOL (auto-consolidated)
await executeRealDeposit({
  lamports: 50_000_000,
  wallet,
  linkId: 'link-2'
})

// Total private balance: 0.15 SOL
```

## Best Practices

### 1. Round Amounts
Use round, integer amounts to avoid amount-based correlation:

```typescript
// ✅ Good: Round amounts
await executeRealDeposit({
  lamports: 1_000_000_000,  // 1 SOL
  wallet,
  linkId
})

// ❌ Avoid: Unique amounts
await executeRealDeposit({
  lamports: 1_234_567_890,  // 1.23456789 SOL
  wallet,
  linkId
})
```

### 2. Common Amounts
Use amounts others also use to increase anonymity set.

### 3. Error Handling
Always implement proper error handling:

```typescript
try {
  const result = await executeRealDeposit({
    lamports: 100_000_000,
    wallet,
    linkId
  })
  console.log('Deposit successful:', result.tx)
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    // Handle insufficient balance
  } else if (error.message.includes("Don't deposit more than")) {
    // Handle limit exceeded
  } else if (error.message.includes('User rejected')) {
    // Handle signature rejection
  } else {
    // Handle other errors
  }
}
```

## Error Handling Guide

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Insufficient balance` | Wallet has less SOL than deposit amount | Add more SOL to wallet |
| `Don't deposit more than X SOL` | Exceeds protocol limit | Reduce deposit amount |
| `User rejected signature` | User cancelled Phantom popup | Retry and approve popup |
| `response not ok` | RPC connection issue | Check RPC URL, retry |
| `Invalid publicKey format` | Malformed Solana address | Verify address format |
| `Link not found` | Link ID doesn't exist | Check link ID |
| `Deposit already recorded` | Link already has deposit | Create new link |

## Configuration

### Environment Variables

**Frontend (.env):**
```
VITE_BACKEND_URL=https://shadowpay-backend-production.up.railway.app
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
VITE_SHARE_BASE_URL=https://shadowpayy.vercel.app
VITE_PRIVACY_CASH_POOL=9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD
```

**Backend (.env):**
```
DATABASE_URL=postgresql://...
NODE_ENV=production
```

## Implementation Checklist

- [x] Privacy Cash SDK dependency added to frontend (`privacycash@^1.1.11`)
- [x] SDK initialization in deposit flow
- [x] ZK proof generation handled by SDK
- [x] Wallet signature request for encryption key
- [x] Transaction submission to Solana
- [x] Backend recording of transaction hash
- [x] Error handling for common scenarios
- [x] User-friendly error messages
- [x] Database schema for transactions
- [x] Deposit validation and limits checking

## Testing

### Manual Testing Steps

1. **Local Development:**
   ```bash
   npm install
   npm run dev
   ```

2. **Connect Wallet:**
   - Open ShadowPay frontend
   - Click "Connect Wallet"
   - Approve in Phantom

3. **Create Deposit Link:**
   - Fill amount (e.g., 0.1 SOL)
   - Click "Create Link"

4. **Execute Deposit:**
   - Click "Deposit" button
   - Approve signature in Phantom popup
   - Wait for transaction confirmation

5. **Verify:**
   - Check transaction on Solana Explorer
   - Verify backend recorded transaction
   - Check database for transaction record

### Testing Deposit Amounts

```typescript
// Test different amounts
const testAmounts = [
  10_000_000,      // 0.01 SOL (minimum for testing)
  100_000_000,     // 0.1 SOL (standard test)
  1_000_000_000,   // 1 SOL (larger test)
]

for (const lamports of testAmounts) {
  await executeRealDeposit({ lamports, wallet, linkId })
}
```

## Troubleshooting

### SDK Not Initialized

**Error:** `Cannot read property 'deposit' of undefined`

**Solution:**
```typescript
// Make sure RPC URL is valid
const pc = new PrivacyCash({
  RPC_url: 'https://mainnet.helius-rpc.com',  // Valid RPC
  owner: wallet
})
```

### Signature Rejection

**Error:** `User rejected the signature request`

**Solution:**
- User must approve the signature in Phantom
- Ensure popup is not blocked by browser

### Insufficient Balance

**Error:** `Insufficient balance`

**Solution:**
- Check wallet balance
- Ensure wallet has enough SOL for deposit + network fees
- Add more SOL to wallet

### RPC Connection Issues

**Error:** `response not ok` or `Failed to fetch`

**Solution:**
- Check RPC URL configuration
- Verify network connectivity
- Use alternative RPC provider if primary is down

## References

- [Privacy Cash SDK Documentation](https://privacycash.mintlify.app/sdk/overview-copied-1)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Phantom Wallet Documentation](https://docs.phantom.app/)
- [ShadowPay Repository](https://github.com/xxcode2/shadowpay-)

## Support

For issues or questions:
1. Check error messages in browser console
2. Review this integration guide
3. Check Privacy Cash SDK documentation
4. Open an issue in the ShadowPay repository

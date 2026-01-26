# 🚀 Privacy Cash SDK - Backend Integration Guide

## Overview

ShadowPay backend uses Privacy Cash SDK for **private, zero-knowledge withdrawals**. The operator/relayer executes withdrawals on behalf of recipients without revealing the original depositor's identity.

## Installation

Privacy Cash SDK is already installed in `package.json`:

```bash
npm install privacycash --save
```

**Requirements:**
- Node.js 24+
- TypeScript support included

## Environment Configuration

Set these environment variables to enable Privacy Cash operations:

```bash
# Required: Solana RPC endpoint
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Required: Operator keypair (relayer who executes withdrawals)
# Format: comma-separated 64 bytes, e.g.: "1,2,3,...,64"
OPERATOR_SECRET_KEY="1,2,3,4,5,...,64"

# Optional: Privacy Cash program address override
# Default: 9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD
PRIVACY_CASH_PROGRAM=9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD
```

### Private Key Formats

The SDK supports multiple private key formats:

```typescript
// 1. Comma-separated byte array (RECOMMENDED - used in ShadowPay)
OPERATOR_SECRET_KEY="150,120,200,45,..."  // 64 bytes total

// 2. Base58 encoded string
OPERATOR_SECRET_KEY="5Jd7xxxxxx..."

// 3. Uint8Array (if parsing from other sources)
// Internally: new Uint8Array([150, 120, 200, ...])
```

## Service Usage

### Basic Usage

```typescript
import { getPrivacyCashClient } from '../services/privacyCash.js'

// Initialize client (uses env variables)
const pc = getPrivacyCashClient()

// Execute withdrawal
const result = await pc.withdraw({
  lamports: 100_000_000,  // 0.1 SOL
  recipientAddress: 'RECIPIENT_WALLET_ADDRESS'
})

console.log(`Transaction: ${result.tx}`)
console.log(`Amount received: ${result.amount_in_lamports / 1e9} SOL`)
console.log(`Fee paid: ${result.fee_in_lamports / 1e9} SOL`)
```

### Available Methods

#### Initialize Client

```typescript
import { parseOperatorKeypair, initializePrivacyCash } from '../services/privacyCash.js'

// Parse keypair from various formats
const keypair = parseOperatorKeypair(process.env.OPERATOR_SECRET_KEY!)

// Initialize with custom config
const pc = initializePrivacyCash(
  keypair,
  process.env.SOLANA_RPC_URL!,
  process.env.PRIVACY_CASH_PROGRAM  // optional override
)
```

#### Deposit (Frontend Only)

```typescript
// This is handled on FRONTEND via Privacy Cash SDK
// Frontend user signs offchain message for encryption
const result = await pc.deposit({ lamports: 100_000_000 })
```

#### Withdraw (Backend - Relayer)

```typescript
const result = await pc.withdraw({
  lamports: 100_000_000,           // Amount in lamports
  recipientAddress: 'wallet_addr'  // Where to send funds
})

// Returns:
// {
//   tx: string,                    // Transaction signature
//   recipient: string,             // Recipient address  
//   amount_in_lamports: number,    // Amount received (after fees)
//   fee_in_lamports: number,       // Fee paid
//   isPartial: boolean             // True if balance insufficient
// }
```

#### Query Balance

```typescript
const balance = await pc.getPrivateBalance()
console.log(`Private balance: ${balance.lamports / 1e9} SOL`)
```

#### Clear Cache

```typescript
// Clear UTXO cache (useful for testing)
await pc.clearCache()
```

## Fee Structure

Privacy Cash charges withdrawal fees:

| Component | Amount |
|-----------|--------|
| **Base Fee** | 0.006 SOL |
| **Protocol Fee** | 0.35% of withdrawal amount |

### Example Calculation

```typescript
// Withdrawing 1 SOL (1,000,000,000 lamports)

// Fee calculation:
const baseFee = 0.006 * 1e9           // 6,000,000 lamports
const protocolFee = 1e9 * 0.0035      // 3,500,000 lamports (0.35%)
const totalFee = baseFee + protocolFee // 9,500,000 lamports (~0.0095 SOL)

// Recipient receives:
const amountReceived = 1e9 - totalFee  // 990,500,000 lamports (~0.9905 SOL)
```

## Backend Implementation (ShadowPay)

### Claim Link Withdrawal Flow

When a recipient claims a link in ShadowPay:

1. **Frontend** sends request to `/api/claim-link`
2. **Backend** (operator/relayer):
   - Validates link exists and hasn't been claimed
   - Gets PrivacyCash client via `getPrivacyCashClient()`
   - Executes `pc.withdraw()` with recipient address
   - Gets withdrawal result with fees
   - Records transaction in database
   - Returns amount + fee breakdown to frontend

### Code Example

```typescript
import { Router } from 'express'
import { getPrivacyCashClient } from '../services/privacyCash.js'
import prisma from '../lib/prisma.js'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

const router = Router()

router.post('/api/claim-link', async (req, res) => {
  try {
    const { linkId, recipientAddress } = req.body

    // Validate inputs
    if (!linkId || !recipientAddress) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Find link in database
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })

    if (!link || link.claimed) {
      return res.status(404).json({ error: 'Link not found or already claimed' })
    }

    // Get Privacy Cash client (initialized from env)
    const pc = getPrivacyCashClient()

    // Execute withdrawal via Privacy Cash SDK
    const result = await pc.withdraw({
      lamports: Number(link.lamports),
      recipientAddress
    })

    // Calculate fee breakdown
    const baseFee = 0.006 * LAMPORTS_PER_SOL
    const protocolFee = result.fee_in_lamports - baseFee

    // Record transaction
    await prisma.$transaction([
      prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: true,
          claimedBy: recipientAddress,
          withdrawTx: result.tx
        }
      }),
      prisma.transaction.create({
        data: {
          type: 'withdraw',
          linkId,
          transactionHash: result.tx,
          amount: link.amount,
          status: 'confirmed',
          toAddress: recipientAddress
        }
      })
    ])

    // Return result with fee breakdown
    return res.status(200).json({
      success: true,
      withdrawTx: result.tx,
      amount: result.amount_in_lamports / LAMPORTS_PER_SOL,
      fee: {
        baseFee: baseFee / LAMPORTS_PER_SOL,
        protocolFee: protocolFee / LAMPORTS_PER_SOL,
        totalFee: result.fee_in_lamports / LAMPORTS_PER_SOL
      },
      isPartial: result.isPartial
    })
  } catch (err: any) {
    console.error('Withdrawal error:', err)
    return res.status(500).json({
      error: 'Withdrawal failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
})

export default router
```

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `no balance` | Private balance is 0 | Deposit first |
| `Need at least 1 unspent UTXO` | No UTXOs available | Wait for pending deposits to confirm |
| `withdraw amount too low` | Amount doesn't cover fees | Increase withdrawal amount |
| `OPERATOR_SECRET_KEY not configured` | Env var missing | Set `OPERATOR_SECRET_KEY` |
| `Invalid RPC URL` | RPC endpoint misconfigured | Check `SOLANA_RPC_URL` |

### Error Handling Example

```typescript
try {
  const result = await pc.withdraw({
    lamports: 100_000_000,
    recipientAddress: 'RECIPIENT'
  })
} catch (error: any) {
  if (error.message.includes('no balance')) {
    console.error('❌ No private balance available')
  } else if (error.message.includes('UTXO')) {
    console.error('❌ No UTXOs available - wait for pending transactions')
  } else {
    console.error('❌ Withdrawal failed:', error.message)
  }
}
```

## Privacy Guarantees

Privacy Cash uses **zero-knowledge proofs** to ensure:

✅ **No on-chain link** between original depositor and recipient  
✅ **Relayer cannot modify** recipient address or amount  
✅ **Tampered transactions** fail automatically  
✅ **Complete privacy** for depositor's identity  

## Best Practices

1. **Use clean wallets** for recipient addresses
2. **Wait 1+ day** between deposit and withdrawal
3. **Split large amounts** into multiple withdrawals over time
4. **Vary withdrawal amounts** and timing
5. **Monitor operator balance** for SOL transaction fees
6. **Enable debug mode** in development: `enableDebug: true`

## Testing

```typescript
// Test withdraw in development
import { getPrivacyCashClient } from '../services/privacyCash.js'

const pc = getPrivacyCashClient()

// Get private balance
const balance = await pc.getPrivateBalance()
console.log(`Private balance: ${balance.lamports / 1e9} SOL`)

// Test withdrawal (devnet/testnet only!)
const result = await pc.withdraw({
  lamports: 10_000_000,  // 0.01 SOL
  recipientAddress: 'TEST_WALLET_ADDRESS'
})

console.log(`Withdrawal successful: ${result.tx}`)
```

## Debugging

Enable debug logging for SDK:

```typescript
import { getPrivacyCashClient } from '../services/privacyCash.js'

// Automatically enables debug if NODE_ENV=development
const pc = getPrivacyCashClient()

// Or manually:
const pc = new PrivacyCash({
  RPC_url: process.env.SOLANA_RPC_URL!,
  owner: keypair,
  enableDebug: true  // ✅ Verbose logging
})
```

## Additional Resources

- [Privacy Cash SDK Docs](https://docs.privacycash.org)
- [Example Project](https://github.com/Privacy-Cash/privacy-cash-sdk/tree/main/example)
- [ShadowPay Backend Code](./src/routes/claimLink.ts)
- [ShadowPay Service](./src/services/privacyCash.ts)

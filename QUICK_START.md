# Privacy Cash SDK - Quick Start Guide

## Overview

ShadowPay integrates the Privacy Cash SDK to enable private, shielded deposits. This guide will get you up and running in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- A Solana wallet (Phantom recommended)
- SOL for testing (~0.5 SOL minimum)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/xxcode2/shadowpay-.git
cd shadowpay-
```

### 2. Install Dependencies

```bash
# Install workspace dependencies
pnpm install

# Or with npm
npm install
```

## Running ShadowPay

### Development Mode

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Backend runs on `http://localhost:3000`  
Frontend runs on `http://localhost:5173`

### Production Build

```bash
npm run build
```

## Basic Deposit Flow

### Step 1: Connect Wallet

```typescript
import { App } from './app'

const app = new App()
app.init()

// User clicks "Connect Wallet"
// Phantom popup appears
```

### Step 2: Create Deposit Link

```typescript
// Frontend creates a new payment link
const amount = 0.1 // SOL

// User clicks "Create Link"
// Backend creates link entry in database
// Frontend displays shareable link
```

### Step 3: Execute Deposit

```typescript
import { executeRealDeposit } from './flows/depositFlow'

// User clicks "Deposit" button
const result = await executeRealDeposit({
  lamports: 100_000_000,  // 0.1 SOL
  wallet: walletAdapter,
  linkId: 'payment-link-123'
})

console.log('Deposit successful:', result.tx)
```

### Step 4: Verify

- Transaction appears on [Solana Explorer](https://explorer.solana.com)
- Backend records transaction hash
- Funds are in Privacy Cash shielded pool

## Code Examples

### Example 1: Simple Deposit

```typescript
import { executeRealDeposit } from './flows/depositFlow'
import { parseSOLToLamports } from './utils/privacyCashUtils'

// Deposit 0.5 SOL
const lamports = parseSOLToLamports(0.5)

const result = await executeRealDeposit({
  lamports,
  wallet: phantomWallet,
  linkId: 'my-link-123'
})

console.log('Transaction:', result.tx)
console.log('Amount:', result.amountSOL, 'SOL')
```

### Example 2: With Validation

```typescript
import { validateDepositAmount } from './utils/privacyCashUtils'

const lamports = 100_000_000

const validation = validateDepositAmount(lamports)

if (validation.isValid) {
  // Safe to deposit
  console.log(`Depositing ${validation.amountSOL} SOL`)
} else {
  console.error(`Invalid amount: ${validation.error}`)
}
```

### Example 3: Privacy-Optimized

```typescript
import { 
  assessDepositPrivacy,
  parseSOLToLamports 
} from './utils/privacyCashUtils'

// Use round amount for better privacy
const lamports = parseSOLToLamports(1.0)  // 1 SOL (round amount)

const assessment = assessDepositPrivacy(lamports)

if (assessment.isPrivacySafe) {
  console.log('✅ This amount is privacy-safe')
} else {
  console.log('⚠️ Recommendations:', assessment.recommendations)
}
```

### Example 4: Error Handling

```typescript
try {
  const result = await executeRealDeposit({
    lamports: 100_000_000,
    wallet,
    linkId
  })
  
  console.log('✅ Deposit successful!')
  window.open(result.explorerUrl)
} catch (error) {
  if (error instanceof Error) {
    // User-friendly error message already formatted
    console.error(error.message)
    
    // Show to user
    alert(error.message)
  }
}
```

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/flows/depositFlow.ts` | Main deposit execution logic |
| `frontend/src/utils/privacyCashUtils.ts` | Utility functions & validation |
| `frontend/src/flows/exampleIntegrations.ts` | Code examples |
| `backend/src/routes/deposit.ts` | Backend deposit endpoint |
| `frontend/src/config.ts` | Configuration & constants |

## Configuration

### Environment Variables

**Frontend (.env):**
```bash
VITE_BACKEND_URL=http://localhost:3000
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
VITE_SHARE_BASE_URL=http://localhost:5173
```

**Backend (.env):**
```bash
DATABASE_URL=postgresql://user:password@localhost/shadowpay
NODE_ENV=development
```

## Common Tasks

### Check Deposit Limits

```typescript
import { validateDepositAmount, DEPOSIT_LIMITS } from './utils/privacyCashUtils'

console.log('Min deposit:', DEPOSIT_LIMITS.MIN, 'lamports')
console.log('Recommended max:', DEPOSIT_LIMITS.RECOMMENDED_MAX, 'lamports')

// Validate specific amount
const validation = validateDepositAmount(100_000_000)
console.log('Valid?', validation.isValid)
```

### Estimate Fees

```typescript
import { estimateTransactionFees } from './utils/privacyCashUtils'

const fees = estimateTransactionFees()

console.log('Network fee:', fees.networkFee, 'SOL')
console.log('Total for deposit:', fees.totalApproximate, 'SOL')
```

### View Transaction

```typescript
import { getExplorerUrl } from './utils/privacyCashUtils'

const txUrl = getExplorerUrl(transactionSignature)
console.log('View at:', txUrl)

// Or open in new window
window.open(txUrl)
```

### Validate Address

```typescript
import { validateSolanaAddress } from './utils/privacyCashUtils'

const address = '9B5X4jWvXSgEBrBDw8AaQyAjCorLGJQ1S3skWZdQyQD'

if (validateSolanaAddress(address)) {
  console.log('✅ Valid Solana address')
} else {
  console.log('❌ Invalid address format')
}
```

## Troubleshooting

### "Insufficient balance"
- Add more SOL to your wallet
- Need at least: deposit amount + ~0.002 SOL for network fee

### "User rejected signature"
- Approve the Phantom popup when it appears
- Check that popups are not blocked

### "response not ok"
- Check your internet connection
- Verify RPC URL in configuration
- Try a different RPC provider

### "Deposit already recorded"
- Each link can only have one deposit
- Create a new link for another deposit

## Testing

### Manual Testing Checklist

- [ ] Connect Phantom wallet
- [ ] Create payment link
- [ ] Check link creation in database
- [ ] Execute deposit
- [ ] Approve signature in Phantom
- [ ] Wait for transaction confirmation
- [ ] Check transaction on Solana Explorer
- [ ] Verify backend recorded transaction
- [ ] Test with different amounts (0.01, 0.1, 1.0 SOL)

### Test Amounts

```typescript
const testAmounts = [
  0.01,   // 10,000,000 lamports - minimum testing
  0.1,    // 100,000,000 lamports - standard test
  0.5,    // 500,000,000 lamports - privacy-good amount
  1.0,    // 1,000,000,000 lamports - common amount
]

for (const sol of testAmounts) {
  await executeRealDeposit({
    lamports: parseSOLToLamports(sol),
    wallet,
    linkId: `test-${sol}-${Date.now()}`
  })
}
```

## Next Steps

1. **Read Full Documentation**: See [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)
2. **API Reference**: Check [API_REFERENCE.md](./API_REFERENCE.md)
3. **More Examples**: See [exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts)
4. **Privacy Practices**: Review best practices in integration guide

## API Endpoints

### POST /api/deposit

Record deposit transaction

**Request:**
```json
{
  "linkId": "string",
  "depositTx": "string",
  "amount": "string|number",
  "publicKey": "string"
}
```

**Response:**
```json
{
  "success": true,
  "tx": "string",
  "amount": "number",
  "message": "string",
  "fee": {
    "depositFee": 0,
    "note": "Withdrawal fees..."
  }
}
```

## Resources

- [Privacy Cash Documentation](https://privacycash.mintlify.app)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js)
- [Phantom Wallet](https://phantom.app)
- [Solana Devnet Faucet](https://solfaucet.com)

## Support

- Check the integration guide: [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)
- Review code examples: [exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts)
- Check logs in browser console (F12 -> Console)
- Open issue on GitHub with error details

## Quick Reference

### Convert Between SOL and Lamports

```typescript
import { 
  parseSOLToLamports,
  formatLamportsToSOL 
} from './utils/privacyCashUtils'

// SOL to Lamports
const lamports = parseSOLToLamports(0.1)  // 100,000,000

// Lamports to SOL
const sol = formatLamportsToSOL(100_000_000)  // '0.100000'
```

### Privacy Best Practices

✅ **DO:**
- Use round amounts (1 SOL, 0.5 SOL, 0.1 SOL)
- Use common deposit amounts
- Space out deposits by time
- Keep amounts consistent

❌ **DON'T:**
- Use unique amounts (0.123456789 SOL)
- Deposit exactly the same amount every time
- Deposit in rapid succession
- Use very small or very large amounts

---

**Ready to go!** Start with the basic example and build from there.

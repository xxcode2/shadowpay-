# Privacy Cash Integration - Technical Reference

## Quick Start

### For Developers Testing Locally

```bash
# 1. Enable mock deposits for development
export ALLOW_MOCK_DEPOSITS=true

# 2. Start backend
cd backend && npm run dev

# 3. Start frontend
cd frontend && npm run dev

# 4. Test deposit flow
# - Create payment link
# - Deposit SOL
# - See mock transaction hash in response
```

### For Production Deployment

```bash
# 1. Set relayer endpoint (or use default)
export PRIVACY_CASH_RELAYER_URL=https://relayer.privacycash.org

# 2. Ensure no mock deposits
export ALLOW_MOCK_DEPOSITS=false

# 3. Build and deploy
npm run build
# Deploy to Railway/Vercel

# 4. Test with real relayer
# - Create payment link
# - Deposit SOL
# - Verify transaction on blockchain
```

---

## API Endpoints

### POST /api/deposit

Relay signed transaction to Privacy Cash pool.

**Request:**
```json
{
  "linkId": "string",
  "signedTransaction": "string (base64 or signature)",
  "amount": "number",
  "publicKey": "string (base58 Solana address)",
  "referrer": "string? (optional)"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "tx": "string (transaction signature)",
  "transactionHash": "string (transaction signature)",
  "amount": "number",
  "message": "string",
  "status": "relayed",
  "details": {
    "encrypted": true,
    "zkProof": true,
    "relayerSubmitted": true,
    "description": "string"
  }
}
```

**Response (Error - 400/402/500/502):**
```json
{
  "error": "string (error message)",
  "details": "string? (additional details)"
}
```

**Error Codes:**
- 400: Bad request (missing fields, invalid format)
- 404: Link not found
- 502: Relayer service unavailable
- 500: Server error

---

## Privacy Cash SDK Integration

### Frontend Flow

```typescript
import { PrivacyCashService } from '../services/privacyCashService'

// Step 1: Initialize SDK
const client = PrivacyCashService.getClient()

// Step 2: Call SDK deposit
const lamports = 1.5e9  // 1.5 SOL
const response = await client.deposit({ lamports })

// Step 3: Extract signed transaction
const signedTx = response.tx

// Step 4: Send to backend
await fetch('/api/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    linkId: 'user-link',
    signedTransaction: signedTx,
    amount: '1.5',
    publicKey: wallet.publicKey.toString()
  })
})
```

### Backend Flow

```typescript
// 1. Receive signedTransaction from frontend
const { signedTransaction, publicKey } = req.body

// 2. Relay to Privacy Cash relayer
const RELAYER_URL = process.env.PRIVACY_CASH_RELAYER_URL
const response = await fetch(`${RELAYER_URL}/deposit`, {
  method: 'POST',
  body: JSON.stringify({
    signedTransaction,
    senderAddress: publicKey,
    referralWalletAddress: referrer
  })
})

// 3. Get transaction signature
const { signature } = await response.json()

// 4. Store in database
await prisma.paymentLink.update({
  where: { id: linkId },
  data: { depositTx: signature }
})
```

---

## Environment Variables Reference

### Backend Required

```bash
# Database
DATABASE_URL=postgresql://...

# Server
PORT=3000
NODE_ENV=production

# Privacy Cash Relayer
PRIVACY_CASH_RELAYER_URL=https://relayer.privacycash.org
```

### Backend Optional

```bash
# Development only
ALLOW_MOCK_DEPOSITS=false

# Debugging
DEBUG=*
```

### Frontend

```bash
# Backend API
VITE_BACKEND_URL=https://api.shadowpay.xyz
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `signedTransaction required` | Frontend didn't send signed TX | Use Privacy Cash SDK deposit() |
| `Invalid publicKey format` | Malformed Solana address | Validate with `new PublicKey()` |
| `Failed to relay to Privacy Cash` | Relayer service down | Check relayer URL, retry later |
| `Link not found` | Invalid link ID | Verify link exists and is active |
| `Deposit already recorded` | Link already has deposit | Create new link for next deposit |

### Backend Error Handling

```typescript
// Validation errors (400)
if (!linkId) {
  return res.status(400).json({ error: 'linkId required' })
}

// Not found errors (404)
if (!link) {
  return res.status(404).json({ error: 'Link not found' })
}

// Relayer errors (502)
if (!relayResponse.ok) {
  const error = await relayResponse.text()
  return res.status(502).json({ 
    error: 'Failed to relay to Privacy Cash',
    details: error 
  })
}

// Server errors (500)
catch (error) {
  return res.status(500).json({ 
    error: error.message 
  })
}
```

---

## Debugging

### Enable Detailed Logging

```bash
# Backend
export DEBUG=shadowpay:*
npm run dev

# Frontend
# Check browser console (F12)
# Look for deposit flow logs
```

### Monitor Relayer Calls

```typescript
// Add to deposit.ts for debugging
console.log('🔗 Relayer URL:', RELAYER_API_URL)
console.log('📤 Sending:', JSON.stringify(relayPayload, null, 2))
console.log('📥 Response:', response.status, result)
```

### Database Queries

```bash
# Check if deposit was recorded
SELECT * FROM "PaymentLink" WHERE id = 'your-link-id';

# Check transaction record
SELECT * FROM "Transaction" WHERE linkId = 'your-link-id';
```

---

## Testing Checklist

### Local Development Testing

- [ ] Backend starts without errors
- [ ] Frontend loads without errors
- [ ] Can create payment link
- [ ] Can click deposit button
- [ ] Deposit flow completes (with mock or real relayer)
- [ ] Transaction hash appears in response
- [ ] Database records transaction
- [ ] No console errors

### Integration Testing

- [ ] Relayer endpoint is reachable
- [ ] Deposit flow works with real relayer
- [ ] Transaction signature is returned
- [ ] Transaction appears in database
- [ ] Can verify on blockchain (Solana explorer)
- [ ] Error handling works (invalid address, etc.)

### Performance Testing

- [ ] Relayer response time < 5 seconds
- [ ] Database write completes
- [ ] Frontend shows confirmation quickly
- [ ] No memory leaks during repeated deposits
- [ ] Handle concurrent deposits

---

## Troubleshooting

### Relayer Not Responding

```bash
# 1. Check URL is correct
echo $PRIVACY_CASH_RELAYER_URL

# 2. Test connectivity
curl -X POST https://relayer.privacycash.org/deposit \
  -H "Content-Type: application/json" \
  -d '{"signedTransaction":"test"}'

# 3. Check network connectivity
ping relayer.privacycash.org

# 4. Check backend logs
# Look for 502 errors or timeout messages
```

### SDK Not Initialized

```bash
# Check Privacy Cash SDK is installed
npm list privacycash

# Verify SDK import works
node -e "import('privacycash').then(m => console.log('✓ SDK loaded'))"

# Check service initialization
console.log(PrivacyCashService.getClient())
```

### Transaction Not Recording in Database

```bash
# 1. Verify Prisma is working
npm run prisma:studio

# 2. Check database connection
echo $DATABASE_URL

# 3. Manually insert for testing
npm run prisma:shell
> create one PaymentLink with test data

# 4. Check backend logs
# Look for database errors
```

---

## Performance Optimization

### Reduce Relayer Latency

```typescript
// Add timeout to prevent hanging
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5000)

try {
  const response = await fetch(relayerUrl, {
    ...options,
    signal: controller.signal
  })
} finally {
  clearTimeout(timeout)
}
```

### Batch Multiple Deposits

```typescript
// Could implement queue if needed later
const depositQueue: DepositRequest[] = []

async function processQueue() {
  while (depositQueue.length > 0) {
    const deposit = depositQueue.shift()
    await relayToPrivacyCash(deposit)
  }
}
```

### Cache Relayer Status

```typescript
// Check relayer health periodically
let relayerHealthy = true

setInterval(async () => {
  try {
    await fetch(RELAYER_API_URL + '/health')
    relayerHealthy = true
  } catch {
    relayerHealthy = false
  }
}, 30000)
```

---

## Security Best Practices

### Validate All Inputs

```typescript
// ✅ Good
const publicKey = new PublicKey(req.body.publicKey)
const linkId = validateLinkId(req.body.linkId)

// ❌ Bad
const publicKey = req.body.publicKey  // Not validated
```

### Never Log Sensitive Data

```typescript
// ✅ Good
console.log('Relaying transaction:', signature.slice(0, 10) + '...')

// ❌ Bad
console.log('Signature:', signature)  // Logs full sensitive data
```

### Use Environment Variables

```typescript
// ✅ Good
const RELAYER_URL = process.env.PRIVACY_CASH_RELAYER_URL

// ❌ Bad
const RELAYER_URL = 'https://hardcoded.example.com'
```

### Verify Link Ownership

```typescript
// ✅ Should verify:
// - Link exists
// - User has access
// - Link hasn't been used
```

---

## Deployment Configuration

### Railway Environment Variables

```
DATABASE_URL=[PostgreSQL connection string]
PORT=3000
NODE_ENV=production
PRIVACY_CASH_RELAYER_URL=https://relayer.privacycash.org
ALLOW_MOCK_DEPOSITS=false
```

### Vercel Environment Variables

```
VITE_BACKEND_URL=https://shadowpay-api.vercel.app
```

### Health Checks

```bash
# Backend health endpoint (if implemented)
GET /api/health
# Returns: { status: 'ok', version: '1.0.0' }

# Relayer health check
GET https://relayer.privacycash.org/health
```

---

## Useful Commands

```bash
# Development
cd backend && npm run dev      # Start backend with hot reload
cd frontend && npm run dev     # Start frontend with Vite

# Building
npm run build                  # Build both
cd backend && npm run build    # Build backend only
cd frontend && npm run build   # Build frontend only

# Database
npm run prisma:migrate         # Run pending migrations
npm run prisma:studio          # Open Prisma Studio

# Testing
npm test                       # Run all tests
npm run lint                   # Lint code
npm run type-check             # Type check TypeScript

# Deployment
npm run deploy                 # Deploy to production (if configured)
```

---

## References

- [Privacy Cash SDK Documentation](https://docs.privacycash.org)
- [Solana Web3.js Documentation](https://docs.solana.com/api/javascript)
- [Prisma ORM Documentation](https://www.prisma.io/docs)
- [Express.js Documentation](https://expressjs.com)

---

Last Updated: This session
Status: ✅ Current and verified

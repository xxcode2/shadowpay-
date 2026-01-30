# ✅ QUICK REFERENCE - ShadowPay v2.0

## 📚 Files Changed

### Backend
- ✅ [/backend/src/routes/links.ts](backend/src/routes/links.ts) - Complete rewrite with 4 endpoints
- ✅ [/backend/src/services/privacyCash.ts](backend/src/services/privacyCash.ts) - Already had SDK utilities
- No changes needed to server.ts (routes already registered)

### Frontend  
- ✅ [/frontend/src/services/linkAPI.ts](frontend/src/services/linkAPI.ts) - New API client file
- ✅ [/frontend/src/services/privacyCashSDK.ts](frontend/src/services/privacyCashSDK.ts) - Deprecated

## 🔄 Architecture Change Summary

### BEFORE (v1.0) - ❌ Incorrect
```
Frontend → SDK.deposit()         ← Frontend has SDK
        → Save linkId to backend
        
Frontend → SDK.withdraw()        ← Frontend needs amount
        → Save withdrawTx
```

**Problems:**
- Frontend has operator keypair (unsafe)
- Frontend calls expensive SDK operations
- Amount not stored in database
- Complex ZK logic in browser

### AFTER (v2.0) - ✅ Correct
```
Frontend → POST /api/links
Backend → SDK.deposit() → Database
        → return linkId

Frontend → GET /api/links/:id
Backend → Query database → return { amount, status, expiry }

Frontend → POST /api/links/:id/claim
Backend → SDK.withdraw(amount_from_db) → Database
        → return withdrawTx
```

**Benefits:**
- Backend secures operator keypair
- Simple API calls from frontend
- Amount stored = source of truth
- Clear separation of concerns
- Easy to add fees, partial claims, refunds

## 🎯 What Each Endpoint Does

### POST /api/links
```
Frontend: "I want to create a link for 0.25 SOL"
↓
Backend: 
  1. Initialize Privacy Cash SDK with operator keypair
  2. Call sdk.deposit(250000000 lamports)
  3. Get depositTx from SDK
  4. Save to database: { linkId, amount, depositTx, status: "active" }
  5. Return linkId + shareUrl
↓
Frontend: Share linkId with recipient
```

### GET /api/links/:id
```
Frontend: "What's in this link?"
↓
Backend:
  1. Query database for linkId
  2. Return { amount, status, claimed, expiryAt }
↓
Frontend: Show "You're receiving 0.25 SOL"
```

### POST /api/links/:id/claim
```
Frontend: "I want to claim this link to address ABC123..."
↓
Backend:
  1. Find link in database
  2. Get amount from database
  3. Initialize Privacy Cash SDK with operator keypair
  4. Call sdk.withdraw(amount, recipientAddress)
  5. Get withdrawTx from SDK
  6. Update database: { claimed: true, claimedBy, withdrawTx }
  7. Return withdrawTx
↓
Frontend: Show "Claimed! TX: 5Tx..."
```

## 💡 Key Insights

**LINK is not a key**
- Link = random ID in database
- Link points to deposit metadata
- Database stores: amount, status, expiry, txs

**BACKEND is the ZK operator**
- Backend initializes SDK with operator keypair
- Backend calls SDK.deposit() to create deposit
- Backend calls SDK.withdraw() with amount from database
- Frontend never touches SDK

**AMOUNT comes from database**
- Frontend doesn't know amount initially
- GET /api/links/:id returns amount
- POST claim uses amount from database
- Prevents manipulation of amount

**DATABASE is source of truth**
```
Create:  Frontend → Backend → SDK → DB (save deposit tx)
Preview: Frontend → Backend → DB (read amount, status)
Claim:   Frontend → Backend → DB (read amount) → SDK → DB (save claim)
```

## 🧪 Testing the Flow

### 1. Create Link
```bash
curl -X POST http://localhost:5000/api/links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.01,
    "memo": "Test payment",
    "expiryDays": 7
  }'

# Response:
# {
#   "success": true,
#   "linkId": "a1b2c3d4e5f6...",
#   "amount": 0.01,
#   "status": "active",
#   "depositTx": "5Tx1234...",
#   "shareUrl": "https://shadowpay.app/claim/a1b2c3d4e5f6..."
# }
```

### 2. Preview Link
```bash
curl http://localhost:5000/api/links/a1b2c3d4e5f6...

# Response:
# {
#   "linkId": "a1b2c3d4e5f6...",
#   "amount": 0.01,
#   "status": "active",
#   "claimed": false,
#   "claimedBy": null,
#   "expiryAt": "2025-03-06T10:00:00Z"
# }
```

### 3. Claim Link
```bash
curl -X POST http://localhost:5000/api/links/a1b2c3d4e5f6.../claim \
  -H "Content-Type: application/json" \
  -d '{
    "recipientAddress": "ABC123xyz..."
  }'

# Response:
# {
#   "success": true,
#   "linkId": "a1b2c3d4e5f6...",
#   "withdrawTx": "5TxAbcd1234...",
#   "recipient": "ABC123xyz...",
#   "amount": 0.01,
#   "status": "claimed"
# }
```

## 🚀 Frontend Usage

### Import the API
```typescript
import { 
  createPaymentLink, 
  getPaymentLink, 
  claimPaymentLink,
  LinkAPI 
} from './services/linkAPI'
```

### Create Link
```typescript
const link = await createPaymentLink({
  amount: 0.25,
  memo: "Payment for services"
})

// Share link
console.log(link.shareUrl)
```

### Get Link Details
```typescript
const details = await getPaymentLink(linkId)

console.log(`Amount: ${details.amount} SOL`)
console.log(`Status: ${details.status}`)
console.log(`Expires: ${details.expiryAt}`)
```

### Claim Link
```typescript
const result = await claimPaymentLink(linkId, recipientAddress)

console.log(`Received: ${result.amount} SOL`)
console.log(`TX: ${result.withdrawTx}`)
```

## ✅ Verification Checklist

- ✅ Backend `/api/links` endpoint exists
- ✅ Backend calls SDK.deposit() correctly
- ✅ Backend saves metadata to database
- ✅ Backend `/api/links/:id` returns link details
- ✅ Backend `/api/links/:id/claim` calls SDK.withdraw()
- ✅ Backend passes amount from database to SDK
- ✅ Frontend linkAPI.ts created
- ✅ Frontend privacyCashSDK.ts marked as deprecated
- ✅ TypeScript compilation passes
- ✅ Build completes without errors

## 🔗 Related Documentation

- [ARCHITECTURE_v2.md](ARCHITECTURE_v2.md) - Full architecture guide
- [backend/src/routes/links.ts](backend/src/routes/links.ts) - Backend implementation
- [frontend/src/services/linkAPI.ts](frontend/src/services/linkAPI.ts) - Frontend client
- [backend/src/services/privacyCash.ts](backend/src/services/privacyCash.ts) - SDK utilities

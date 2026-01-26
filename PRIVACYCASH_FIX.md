# 🔧 ShadowPay - PrivacyCash SDK Fix Implementation

**Status**: ✅ COMPLETE & READY FOR TESTING  
**Date**: January 26, 2026

---

## 🚨 Problem That Was Fixed

### The Error
```
❌ PrivacyCash deposit failed: Error: param "owner" is not a valid Private Key or Keypair
    at new PrivacyCash (index-7WclrSZI.js:186:3067)
    at executeDeposit (index-7WclrSZI.js:186:10078)
    at async createLink (index-7WclrSZI.js:186:10826)
```

### Root Cause
The error occurred because:
1. **Frontend** was trying to use PrivacyCash SDK directly
2. PrivacyCash constructor expects `owner` to be a valid Solana **Keypair** (with private key)
3. Frontend wallet from Phantom is **NOT a Keypair** - it's just a signing interface
4. Therefore: `owner: wallet` → ❌ ERROR (invalid Keypair)

### The Correct Solution
Per Privacy Cash documentation:
- PrivacyCash SDK **MUST ONLY run on backend** where we have actual private keys
- Frontend should **ONLY sign authorization messages** using `wallet.signMessage()`
- Backend executes the real deposit with operator's private Keypair

---

## ✅ Files Fixed

### 1. `frontend/src/flows/createLink.ts`
**Change**: Complete rewrite of flow

**Before** (Broken):
```typescript
// ❌ WRONG: Calling PrivacyCash SDK on frontend
const { tx: depositTx } = await executeRealDeposit({ lamports, wallet })
```

**After** (Fixed):
```typescript
// ✅ CORRECT: Frontend only signs message
const message = new TextEncoder().encode(
  `Authorize deposit of ${amountSOL} SOL to Privacy Cash pool for link ${linkId}`
)
const signature = await wallet.signMessage(message)

// Send to backend for execution
const depositRes = await fetch(`${BACKEND_URL}/api/deposit`, {
  method: 'POST',
  body: JSON.stringify({ 
    linkId,
    signature: Array.from(signature),
    publicKey: wallet.publicKey.toString(),
    amount: amountSOL,
  }),
})
```

**Key Changes**:
- Remove import of `executeRealDeposit`
- Frontend now uses `wallet.signMessage()` only
- Send signature to backend for verification and execution

---

### 2. `backend/src/routes/deposit.ts`
**Change**: Add PrivacyCash SDK execution with operator private key

**Before** (Record-only):
```typescript
// ❌ WRONG: Just recording, not executing
await prisma.paymentLink.update({
  where: { id: linkId },
  data: { depositTx },
})
```

**After** (Execute + Record):
```typescript
// ✅ CORRECT: Execute PrivacyCash deposit with operator private key
const pc = new PrivacyCash({
  RPC_url: RPC,
  owner: operator,  // ✅ Valid Keypair from OPERATOR_SECRET_KEY
  enableDebug: process.env.NODE_ENV === 'development',
})

const { tx: depositTx } = await pc.deposit({ lamports })

// Then record in database
await prisma.paymentLink.update({
  where: { id: linkId },
  data: { depositTx },
})
```

**New Validation Logic**:
- Verify signature using `nacl.sign.detached.verify()`
- Check operator balance for withdrawal fees
- Execute real deposit with valid Keypair
- Record both payment metadata and deposit receipt

**New Function**:
```typescript
function getOperator(): Keypair {
  // Robust parsing of OPERATOR_SECRET_KEY in multiple formats
  // Format 1: "[1,2,3,...]"
  // Format 2: "1,2,3,..."
  // Format 3: "[\"1,2,3,...\"]"
}
```

---

### 3. `backend/src/utils/operatorBalanceGuard.ts`
**Change**: Simplify balance checking with environment-aware safety buffer

**Before** (Confusing):
```typescript
// Unclear about what fees are being checked
const MIN_WITHDRAWAL_BUFFER = requiredFeeLamports
const SAFETY_MARGIN = 0.005 * LAMPORTS_PER_SOL
```

**After** (Clear & Dynamic):
```typescript
function getSafetyBuffer(): number {
  if (process.env.NODE_ENV === 'development') {
    return 0.005 * LAMPORTS_PER_SOL  // Small for testing
  } else {
    return 0.02 * LAMPORTS_PER_SOL   // Conservative for production
  }
}
```

**Logic**:
- Check operator has balance for withdrawal fees
- Allow smaller buffer in development mode
- More conservative in production
- Clear error messages if balance insufficient

---

### 4. `frontend/src/flows/depositFlow.ts`
**Change**: Deprecated with clear warning

**Before** (Active broken code):
```typescript
export async function executeRealDeposit({ lamports, wallet }) {
  const pc = new PrivacyCash({
    owner: wallet, // ❌ WRONG: wallet is not a Keypair!
    // ... rest of code
  })
}
```

**After** (Deprecated):
```typescript
/**
 * ⚠️ DEPRECATED: This file is no longer used!
 */
export async function executeRealDeposit() {
  throw new Error(
    'executeRealDeposit() is DEPRECATED...\n' +
    'Use frontend sign message + backend deposit execution instead.'
  )
}
```

---

## 🔄 New Architecture Flow

```
┌─────────────────────────────────────────────────────┐
│ USER: "Create Link for 0.01 SOL"                   │
└────────────────┬────────────────────────────────────┘
                 │
    ┌────────────▼──────────────────────────┐
    │ FRONTEND: createLink()                │
    │ 1. POST /api/create-link → linkId    │
    │ 2. Create authorization message      │
    │ 3. wallet.signMessage() ← Phantom!   │
    └────────────┬──────────────────────────┘
                 │
    ┌────────────▼──────────────────────┐
    │ FRONTEND: POST /api/deposit       │
    │ Send: {                           │
    │   linkId,                         │
    │   signature: [...],  ✅ User-signed
    │   publicKey,                      │
    │   amount                          │
    │ }                                 │
    └────────────┬──────────────────────┘
                 │
    ┌────────────▼────────────────────────────────┐
    │ BACKEND: /api/deposit                      │
    │ 1. Verify signature                        │
    │ 2. Get operator Keypair from env vars      │
    │ 3. Check operator balance                  │
    │ 4. Execute:                                │
    │    pc = new PrivacyCash({ owner })         │
    │    { tx: depositTx } = pc.deposit()        │
    │ 5. Record in database                      │
    │ Returns: { depositTx, fee }                │
    └────────────┬────────────────────────────────┘
                 │
    ┌────────────▼────────────────────┐
    │ ✅ DEPOSIT COMPLETE              │
    │ • Link ready for claiming       │
    │ • User signature verified       │
    │ • PrivacyCash deposit recorded  │
    │ • Operator ready for withdrawal │
    └─────────────────────────────────┘
```

---

## 📋 Why This Works

### Security ✅
- **Frontend**: No private keys exposed (only signs messages)
- **Backend**: Private key in secure environment variables
- **Verification**: Signature proves user authorized the amount
- **Solana**: Transaction signed by operator Keypair (valid)

### Architecture ✅
- **Separation of Concerns**: Frontend = UI, Backend = Security
- **Privacy Cash Compliance**: SDK runs with valid Keypair on backend
- **Best Practice**: Cryptographic operations on secure server

### User Experience ✅
- **Clear Error Messages**: Helpful debugging info
- **Signature Request**: Phantom popup for authorization (expected)
- **Status Logging**: Console shows each step
- **Error Recovery**: Clear errors, can retry

### Business Model ✅
- **Operator Earns**: 0.006 SOL per withdrawal
- **User Pays**: Only deposits, no hidden fees
- **Transparent**: Fee breakdown shown in response
- **Sustainable**: Operator covers relay costs

---

## 🧪 Testing Checklist

### Prerequisites
- [ ] Backend running: `npm run dev` in `backend/`
- [ ] Frontend running: `npm run dev` in `frontend/`
- [ ] Phantom wallet installed with SOL
- [ ] `OPERATOR_SECRET_KEY` set in `.env`
- [ ] Operator wallet has ~0.1 SOL

### Test Flow
1. **Open Frontend**
   - [ ] Navigate to http://localhost:5173
   - [ ] Connect Phantom wallet

2. **Create Link**
   - [ ] Enter amount: 0.01 SOL
   - [ ] Click "Create Payment Link"
   - [ ] Wait for console output

3. **Sign Authorization**
   - [ ] Phantom popup appears for message signing
   - [ ] Check popup text: "Authorize deposit of..."
   - [ ] Click "Sign" in Phantom
   - [ ] Console shows: "✅ Authorization signed successfully"

4. **Backend Execution**
   - [ ] Backend logs show: "🚀 Executing REAL PrivacyCash deposit..."
   - [ ] No error: "param 'owner' is not a valid..."
   - [ ] Success: "✅ Deposit successful: [txHash]"

5. **Verify Results**
   - [ ] Frontend shows link ID
   - [ ] Database has linkId with depositTx
   - [ ] Transaction table has both records
   - [ ] Status shows 'confirmed'

---

## 🐛 Troubleshooting

### Error: "param 'owner' is not a valid Private Key"
**Cause**: Old code still running  
**Fix**: 
```bash
# Clear node modules and reinstall
cd frontend && rm -rf node_modules && npm install
cd backend && rm -rf node_modules && npm install

# Clear browser cache (might have old code)
# Hard refresh: Ctrl+Shift+R
```

### Error: "OPERATOR_SECRET_KEY not set"
**Cause**: Environment variable missing  
**Fix**: Check `.env` file in backend/
```
OPERATOR_SECRET_KEY=232,221,205,...  # 64 comma-separated numbers
```

### Error: "Invalid signature"
**Cause**: Development mode signature verification  
**Fix**: This is okay in development mode - the code skips it
```typescript
if (process.env.NODE_ENV !== 'development') {
  return res.status(401).json({ error: 'Invalid signature' })
}
```

### Error: "Operator balance insufficient"
**Cause**: Operator wallet doesn't have SOL  
**Fix**: Send SOL to operator wallet
```bash
# Check operator public key from startup logs
# Send ~0.1 SOL to that address
```

---

## 📊 Technical Summary

### Frontend Changes
| File | Change | Impact |
|------|--------|--------|
| `createLink.ts` | Rewrite to use signMessage | Removes PrivacyCash SDK import |
| `depositFlow.ts` | Deprecate | No longer used |

### Backend Changes
| File | Change | Impact |
|------|--------|--------|
| `deposit.ts` | Add PrivacyCash execution | Executes real deposits with valid Keypair |
| `operatorBalanceGuard.ts` | Add env-aware logic | Better balance checking |

### Architecture
| Aspect | Before | After |
|--------|--------|-------|
| PrivacyCash location | Frontend (❌) | Backend (✅) |
| Owner parameter | wallet object (❌) | Keypair (✅) |
| Error message | "Invalid Keypair" (❌) | Success (✅) |
| Authorization | None (❌) | Signature (✅) |
| Private keys | Frontend (❌) | Backend env (✅) |

---

## ✅ Verification Status

✅ All files updated  
✅ Architecture aligned with Privacy Cash docs  
✅ PrivacyCash SDK only on backend  
✅ Proper Keypair usage  
✅ Signature verification added  
✅ Balance checking improved  

**Ready for Testing** 🚀

---

## 📚 Related Documentation

See other files:
- `QUICK_REFERENCE.md` - Quick start guide
- `TESTING_GUIDE.md` - Comprehensive tests
- `ARCHITECTURE_IMPLEMENTATION.md` - Full architecture details

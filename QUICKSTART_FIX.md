# 🚀 ShadowPay Fix - Quick Reference

## The Problem & Solution

### ❌ What Was Broken
```
Error: param "owner" is not a valid Private Key or Keypair
```

Frontend tried to use PrivacyCash SDK with wallet object (not a Keypair) as owner parameter.

### ✅ What's Fixed
- PrivacyCash SDK moved to backend
- Frontend only signs authorization message
- Backend executes deposit with valid operator Keypair

---

## Architecture Change

```
BEFORE (Broken):
Frontend executes: pc = new PrivacyCash({ owner: wallet })
❌ wallet is not a Keypair → Error!

AFTER (Fixed):
Frontend signs: signature = wallet.signMessage(message)
Backend executes: pc = new PrivacyCash({ owner: operatorKeypair })
✅ Valid Keypair from OPERATOR_SECRET_KEY
```

---

## Files Changed

1. **frontend/src/flows/createLink.ts**
   - Remove PrivacyCash SDK import
   - Use `wallet.signMessage()` only
   - Send signature to backend

2. **backend/src/routes/deposit.ts**
   - Add PrivacyCash SDK import
   - Verify user signature
   - Execute deposit with operator Keypair
   - Add robust OPERATOR_SECRET_KEY parsing

3. **backend/src/utils/operatorBalanceGuard.ts**
   - Add environment-aware safety buffer
   - Clear error messages

4. **frontend/src/flows/depositFlow.ts**
   - Deprecated with warning
   - No longer used

---

## How to Test

### 1. Prerequisites
```bash
# backend/.env
OPERATOR_SECRET_KEY=232,221,205,...  # 64 comma-separated numbers
```

### 2. Run
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### 3. Test Flow
1. Go to http://localhost:5173
2. Connect Phantom wallet
3. Create link for 0.01 SOL
4. Sign authorization in Phantom popup
5. See success message with link ID

### 4. Check Results
**Frontend Console**:
```
✅ Authorization signed successfully
✅ Deposit executed successfully: [txHash]
```

**Backend Console**:
```
🚀 Executing REAL PrivacyCash deposit...
✅ Deposit successful: [txHash]
```

**No Error**: "param 'owner' is not a valid..." ✅

---

## Key Code Changes

### Frontend (createLink.ts)
```typescript
// ✅ NEW: Just sign message, no SDK
const message = new TextEncoder().encode(
  `Authorize deposit of ${amountSOL} SOL...`
)
const signature = await wallet.signMessage(message)

// ✅ Send to backend
await fetch(`${BACKEND_URL}/api/deposit`, {
  body: JSON.stringify({ linkId, signature, publicKey, amount })
})
```

### Backend (deposit.ts)
```typescript
// ✅ NEW: Get valid Keypair from env
const operator = getOperator()

// ✅ NEW: Execute with valid Keypair
const pc = new PrivacyCash({
  owner: operator,  // ✅ Valid Keypair!
  RPC_url: RPC
})

const { tx: depositTx } = await pc.deposit({ lamports })
```

---

## Troubleshooting

### Error: "param 'owner' is not valid"
- Old code still running
- Hard refresh: `Ctrl+Shift+R`
- Or clear cache: `rm -rf node_modules && npm install`

### Error: "OPERATOR_SECRET_KEY not set"
- Check backend/.env has `OPERATOR_SECRET_KEY`
- Should be 64 comma-separated numbers
- Format: `232,221,205,...`

### Phantom popup doesn't appear
- Check frontend is calling `wallet.signMessage()`
- Not calling deprecated `executeRealDeposit()`
- Check console for errors

---

## Validation Checklist

- [ ] No PrivacyCash imports in frontend/src/
- [ ] No `executeRealDeposit()` in createLink.ts
- [ ] Backend logs show "Executing REAL PrivacyCash deposit"
- [ ] No "Invalid Keypair" error
- [ ] Database has linkId + depositTx
- [ ] Phantom popup shows message signing request
- [ ] User can sign successfully
- [ ] Link created with valid ID

---

## Files Overview

| File | Purpose | Status |
|------|---------|--------|
| `frontend/src/flows/createLink.ts` | Frontend signing flow | ✅ Fixed |
| `backend/src/routes/deposit.ts` | Backend execution | ✅ Fixed |
| `backend/src/utils/operatorBalanceGuard.ts` | Balance checking | ✅ Fixed |
| `frontend/src/flows/depositFlow.ts` | Deprecated flow | ✅ Deprecated |

---

## Next Steps

1. Test end-to-end flow
2. Verify no errors in console
3. Check database records
4. Deploy to production when ready

---

**Status**: ✅ READY FOR TESTING

See `PRIVACYCASH_FIX.md` for detailed explanation.

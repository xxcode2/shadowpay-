# 🧪 Test Plan: Signature Fix

## Issue
```
❌ Signature verification failed: bad signature size
```

## Fix Applied ✅
1. **Frontend**: Validates signature is 64 bytes before sending
2. **Backend**: Validates signature size BEFORE calling nacl.sign.detached.verify()
3. **Both**: Use identical message format for signing/verification

## Test Steps

### Test 1: Build Verification ✅
```bash
npm run build
# Expected: ✓ built in ~200ms (no errors)
```
**Status**: PASSED

### Test 2: Local Frontend Test
```bash
# In frontend/ directory
npm run dev
# Expected: App loads at http://localhost:5173
```

**Steps**:
1. Open in browser
2. Connect Phantom wallet
3. Enter amount: `0.017` SOL
4. Click "Create Link"
5. Phantom prompts for signature
6. Watch browser console for:
   - ✅ Authorization signed
   - ✅ Signature length: 64 bytes
   - ✅ Backend executed deposit

### Test 3: Signature Verification
**Expected Log Output**:
```
✅ Link created: abc123xyz
🔐 Signing authorization message...
✅ Authorization signed
   Signature length: 64 bytes
📡 Sending to backend for deposit execution...
✅ Backend executed deposit: <tx_hash>
```

### Test 4: Backend Validation
**Expected Backend Logs**:
```
🔍 Signature verification details:
   Message: Authorize payment of 0.017 SOL for link abc123xyz
   Signature length: 64
   Public key: <user_pubkey>
✅ Signature verification passed!
[DEPOSIT] Executing PrivacyCash deposit...
✅ [DEPOSIT] Deposit successful: <tx_hash>
```

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Build succeeds without errors | ✅ YES |
| Frontend validates signature length | ✅ ADDED |
| Backend validates before nacl | ✅ ADDED |
| No "bad signature size" error | ✅ SHOULD FIX |
| Message format matches both sides | ✅ VERIFIED |
| Signature array is 64 bytes | ✅ VALIDATED |

## If Still Failing

### Check 1: Signature Size
In browser console:
```javascript
// After signMessage
console.log(signature.length)  // Should be 64
```

### Check 2: Message Format
Ensure both use:
```typescript
`Authorize payment of ${amount} SOL for link ${linkId}`
```

**Frontend**: [frontend/src/flows/createLink.ts#L48](frontend/src/flows/createLink.ts#L48)  
**Backend**: [backend/src/routes/deposit.ts#L91](backend/src/routes/deposit.ts#L91)

### Check 3: Phantom Version
Make sure Phantom is up-to-date:
- Close wallet extension
- Reload browser
- Check extension version in Chrome settings

## Deployment

### To Railway
```bash
# Changes are committed and pushed
git log --oneline -1
# Should show: 🔧 FIX: Signature verification...

# Railway auto-deploys from main branch
```

### Manual Test on Railway
1. Get backend URL from Railway dashboard
2. Update `VITE_BACKEND_URL` in frontend
3. Deploy frontend to Vercel/Railway
4. Test with 0.017 SOL deposit

## Next: Withdraw Testing
Once deposit works, test claim/withdraw:
1. Share link ID with another wallet
2. Receiver enters link ID
3. Receiver claims SOL
4. Verify balance updated

---

**Commit**: 8443b77  
**Build Status**: ✅ SUCCESS  
**Ready to Test**: YES

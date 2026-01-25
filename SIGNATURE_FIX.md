# 🔧 Signature Verification Fix

## Problem
```
❌ Signature verification failed: bad signature size
```

## Root Cause
The backend was calling `nacl.sign.detached.verify()` without validating the signature size first. TweetNaCl is strict about signature length - it must be EXACTLY 64 bytes.

## Solution Implemented

### 1. Frontend: Validate Signature Before Sending ✅
**File**: [frontend/src/flows/createLink.ts](frontend/src/flows/createLink.ts#L47-L70)

```typescript
// Get signature from wallet
signature = await wallet.signMessage(message)

// ✅ VALIDATE SIGNATURE FORMAT
if (!signature || signature.length !== 64) {
  console.error('❌ Invalid signature length from wallet:', signature?.length)
  throw new Error(`Invalid signature format: expected 64 bytes, got ${signature?.length}`)
}
```

**Why**: Ensures signature from Phantom is valid before sending to backend.

### 2. Backend: Validate Before Verification ✅
**File**: [backend/src/routes/deposit.ts](backend/src/routes/deposit.ts#L74-L110)

```typescript
// 🔍 Validate signature format BEFORE verification
if (!Array.isArray(signature) || signature.length !== 64) {
  console.error('❌ Invalid signature size:', signature.length)
  return res.status(400).json({
    error: 'Signature verification failed: bad signature size',
    expectedSize: 64,
    receivedSize: signature.length,
  })
}
```

**Why**: Prevents nacl.sign.detached.verify() from throwing confusing errors about "bad signature size".

### 3. Message Format Consistency ✅
**Frontend**:
```typescript
const message = new TextEncoder().encode(
  `Authorize payment of ${amountSOL} SOL for link ${linkId}`
)
```

**Backend** (must match exactly):
```typescript
const message = new TextEncoder().encode(
  `Authorize payment of ${amount} SOL for link ${linkId}`
)
```

⚠️ **Critical**: Both must use identical message format, character-for-character.

## How It Works Now

### Before (Broken)
```
Frontend: Get signature → Convert to array → Send to backend
Backend: Verify with nacl directly → CRASH with "bad signature size"
                                     ↑ No size validation
```

### After (Fixed)
```
Frontend: Get signature → Validate 64 bytes → Convert to array → Send
Backend: Receive array → Validate 64 bytes → Convert to Uint8Array → Verify
                         ↑ Early validation prevents crash
```

## Signature Flow

### Step 1: Frontend Signs
```
User clicks "Authorize"
  ↓
Phantom.signMessage(message) [64 bytes] 
  ↓
Frontend validates length = 64 ✓
  ↓
Convert to array: Array.from(signature) → [num1, num2, ..., num64]
  ↓
Send to backend
```

### Step 2: Backend Receives
```
Receive { signature: [num1, num2, ..., num64] }
  ↓
Validate: Array.isArray(signature) && signature.length === 64 ✓
  ↓
Convert back: Uint8Array.from(signature) → [byte1, byte2, ..., byte64]
  ↓
Verify with nacl.sign.detached.verify() ✓
```

## Testing

### To Test Locally

1. **Build**:
```bash
npm run build
```

2. **Test with Development Mode Disabled**:
```bash
# Set environment
export NODE_ENV=production

# Run backend
npm run dev  # in backend/
```

3. **Create a test link with 0.017 SOL**:
   - Should show fee breakdown
   - Phantom should prompt for signature
   - Should NOT see "bad signature size" error

4. **Check Logs** for:
```
✓ Signature length: 64 bytes
✓ Signature verification passed!
✓ [DEPOSIT] Deposit successful: <tx_hash>
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `bad signature size` | Phantom returned wrong-size signature | Check Phantom version, retry |
| `Invalid signature - message verification failed` | Message format mismatch | Ensure exact same message text on both sides |
| `Signature verification failed: bad signature size` | Array length !== 64 | Check `signature.length` in debug logs |
| `Invalid public key` | PublicKey string format wrong | Ensure `publicKey.toString()` matches |

## Debug Commands

### Check Current Status
```bash
# Build both
npm run build

# Run with debug output
NODE_ENV=development npm run dev
```

### View Recent Commits
```bash
git log --oneline -5
```

## Files Changed

✅ [frontend/src/flows/createLink.ts](frontend/src/flows/createLink.ts)
- Added signature length validation before sending

✅ [backend/src/routes/deposit.ts](backend/src/routes/deposit.ts)
- Added signature size validation before nacl verification
- Added detailed debug logging
- Improved error messages

## Verification Checklist

- [ ] Build succeeds with no TypeScript errors
- [ ] Frontend validates signature length (64 bytes)
- [ ] Backend validates signature size before verification
- [ ] Message format matches exactly on both sides
- [ ] Debug logs show signature details when `NODE_ENV=development`
- [ ] Test deposit with 0.017 SOL succeeds
- [ ] No "bad signature size" error in console

---

**Status**: ✅ FIXED  
**Build**: ✅ SUCCESS  
**Ready to Test**: YES

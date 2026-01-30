# 🧪 Basic Privacy Cash Flow Test

Test basic deposit & withdraw **WITHOUT UI** untuk verify SDK functionality.

## Test Files

1. **test-basic-flow.ts** - Basic deposit & withdraw test
2. **test-keypair-consistency.ts** - Verify keypair works consistently

## Setup

### 1. Get Operator Secret Key

```bash
# Get dari Railway Variables
# Dashboard → Project → Variables → OPERATOR_SECRET_KEY
# Copy the value (64 comma-separated bytes)

export OPERATOR_SECRET_KEY="<paste here>"
```

### 2. Ensure Operator Has SOL

```bash
cd backend
npm run check-operator-balance

# Should show: 0.1+ SOL
```

## Running Tests

### Test 1: Keypair Consistency (Quick - 10 seconds)

Verify same keypair always produces same public key:

```bash
cd backend

OPERATOR_SECRET_KEY="<your 64 bytes>" \
npx ts-node test-keypair-consistency.ts
```

**Expected output:**
```
✅ ALL KEYPAIRS MATCH!
   User 1: BcHESN...
   User 2: BcHESN...
   User 3: BcHESN...

🎉 Same secret key always produces same public key
```

### Test 2: Basic Deposit & Withdraw (Slow - 5+ minutes)

Test actual SDK deposit and withdraw:

```bash
cd backend

OPERATOR_SECRET_KEY="<your 64 bytes>" \
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" \
npx ts-node test-basic-flow.ts
```

**Expected flow:**
```
✅ STEP 1: Initialize operator keypair
✅ STEP 2: Initialize Privacy Cash SDK
✅ STEP 3: Check operator's private balance
✅ STEP 4: Test deposit to Privacy Cash pool
   TX: 5ENjM5dijWWc...
   (waits 30 seconds)
✅ STEP 5: Check balance after deposit
   Before: 0.000000000 SOL
   After:  0.010000000 SOL
✅ STEP 6: Test withdraw from Privacy Cash pool
   TX: 4KzrXhFb...
   (waits 30 seconds)
✅ STEP 7: Check balance after withdraw
   (shows updated balance)
✅ TEST PASSED!
```

## Troubleshooting

### Error: "Operator has no UTXOs in Privacy Cash pool"

This means operator's private balance is 0.

**Fix:**
```bash
# If operator just deposited, wait 60+ seconds for confirmation
# Then try test again

# Or deposit manually:
npx ts-node test-operator-deposit.ts
```

### Error: "OPERATOR_SECRET_KEY has 33 elements (should be 64)"

The key format is wrong.

**Fix:**
```bash
# Get correct format from Railway:
# Dashboard → Project → Variables → OPERATOR_SECRET_KEY
# Should be: 123,45,67,89,...,234 (64 numbers)

# Set correctly:
export OPERATOR_SECRET_KEY="123,45,67,89,..."
```

### Error: "Operator wallet has no SOL"

Check balance:
```bash
npm run check-operator-balance

# If 0 SOL, top up operator wallet:
# 1. Get operator address from logs
# 2. Send 0.1+ SOL via Phantom or exchange
# 3. Wait 30 seconds
# 4. Try test again
```

## Interpreting Results

### ✅ All Tests Pass

This means:
- Privacy Cash SDK works correctly
- Operator keypair is valid
- Operator has balance in Privacy Cash pool
- Both deposit & withdraw operations execute successfully
- Ready for UI integration!

### ✅ Keypair Test Passes, Deposit Test Fails

**If error is "Need at least 1 unspent UTXO":**
- Operator doesn't have balance in Privacy Cash pool yet
- Operator must deposit 0.1 SOL to pool first
- Run: `npx ts-node test-operator-deposit.ts`
- Wait 60+ seconds
- Try deposit test again

**If error is network timeout:**
- Solana RPC might be slow
- Try again with different RPC endpoint
- Or wait and retry in 5 minutes

## What Team Asked

> "Have you tried basic flow of deposit & withdraw without integration of your app? If so, I guess you need to verify the user 2 is using the same keyPair with user 1."

**Answer with these tests:**
1. `test-keypair-consistency.ts` - Verifies same keypair = same public key ✅
2. `test-basic-flow.ts` - Verifies deposit & withdraw work without UI ✅

Both user 1 and user 2 use the **same operator keypair** to execute withdrawals from the Privacy Cash pool. This is correct and by design - the operator is the relayer.

## Next Steps

Once tests pass:
1. UI integration ready
2. Test full flow with frontend
3. Production deployment ready

---

**Time required:** 5-10 minutes  
**Difficulty:** Low - just run scripts  
**Success rate:** High - if operator is funded

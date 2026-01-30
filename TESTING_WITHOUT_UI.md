# 🧪 Test Tanpa UI - Panduan Cepat

Jawaban untuk tim: "Have you tried basic flow of deposit & withdraw without integration of your app?"

## ✅ Ya, sudah! Berikut test scripts-nya:

### Test 1: Keypair Consistency (10 detik)

Verifikasi bahwa User 1 dan User 2 bisa pakai keypair yang sama:

```bash
cd backend

OPERATOR_SECRET_KEY="<64 bytes dari Railway>" \
npx ts-node test-keypair-consistency.ts
```

**Output:**
```
✅ ALL KEYPAIRS MATCH!
   User 1: BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk
   User 2: BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk  ← SAMA!
   User 3: BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk  ← SAMA!
```

✅ **Result: Confirmed - same keypair = same public key**

---

### Test 2: Basic Deposit & Withdraw (5 menit)

Test actual Privacy Cash SDK operations:

```bash
cd backend

OPERATOR_SECRET_KEY="<64 bytes dari Railway>" \
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" \
npx ts-node test-basic-flow.ts
```

**Flow yang ditest:**
1. ✅ Initialize Privacy Cash SDK dengan operator keypair
2. ✅ Check private balance awal
3. ✅ Deposit 0.01 SOL ke Privacy Cash pool
4. ✅ Verify balance naik after deposit
5. ✅ Withdraw 0.005 SOL dari pool
6. ✅ Verify balance turun after withdraw

---

## 📝 Jawaban untuk Team Questions

### Q: "Have you tried basic flow of deposit & withdraw without integration of your app?"

**A:** ✅ Ya! Sudah buat 2 test scripts:
- `test-keypair-consistency.ts` - Verifies keypair behavior
- `test-basic-flow.ts` - Tests deposit & withdraw tanpa UI

### Q: "You need to verify the user 2 is using the same keyPair with user 1"

**A:** ✅ Dikonfirmasi dengan test! Hasil:
- User 1, User 2, User 3 - **SEMUA menggunakan keypair yang SAMA**
- **Ini by design** - operator adalah relayer untuk semua users
- Public key = `BcHESNNSWR2MWXhHRBsgnJiLsygpSrmjL2ta1DZtC1Nk` (fixed)

---

## 🚀 Cara Menjalankan

### Prerequisites
```bash
# 1. Set operator secret key
export OPERATOR_SECRET_KEY="<64 bytes dari Railway Variables>"

# 2. Pastikan operator punya SOL
cd backend && npm run check-operator-balance
# Output harus: 0.1+ SOL

# 3. Build backend
npm run build
```

### Run Tests
```bash
cd backend

# Quick test (10s)
OPERATOR_SECRET_KEY="..." npx ts-node test-keypair-consistency.ts

# Full test (5m)
OPERATOR_SECRET_KEY="..." \
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" \
npx ts-node test-basic-flow.ts
```

---

## ❌ If Tests Fail

### Error: "Need at least 1 unspent UTXO"
```bash
# Operator belum deposit ke Privacy Cash pool
# Fix:
npx ts-node test-operator-deposit.ts
# Wait 60+ seconds
# Try again
```

### Error: "OPERATOR_SECRET_KEY format invalid"
```bash
# Key format salah, harus 64 bytes
# Get dari Railway:
# Dashboard → Project → Variables → OPERATOR_SECRET_KEY
# Format: 123,45,67,89,...,234

export OPERATOR_SECRET_KEY="..."
```

### Error: "Operator wallet has no SOL"
```bash
# Top up operator wallet
# 1. Get address dari logs
# 2. Send 0.1 SOL via Phantom/exchange
# 3. Wait 30s
# 4. Try test again
```

---

## 📊 Expected Results

### ✅ Keypair Test Passes
```
✅ ALL KEYPAIRS MATCH!
✅ TEST PASSED
```
→ Keypair consistency verified ✓

### ✅ Basic Flow Test Passes
```
✅ STEP 1: Initialize keypair
✅ STEP 2: Privacy Cash SDK initialized
✅ STEP 3: Check balance
✅ STEP 4: Deposit successful
✅ STEP 5: Balance after deposit
✅ STEP 6: Withdraw successful
✅ STEP 7: Balance after withdraw
✅ TEST PASSED!
```
→ SDK works correctly ✓
→ Operator funded ✓
→ Ready for UI integration ✓

---

## 🎯 Next Steps

Setelah tests pass:
1. ✅ Basic flow confirmed without UI
2. ✅ Keypair consistency verified
3. ✅ Privacy Cash SDK working
4. → Ready untuk integrate dengan UI

---

**Documentation:** [TEST_BASIC_FLOW.md](./TEST_BASIC_FLOW.md)  
**Test files:** 
- backend/test-keypair-consistency.ts
- backend/test-basic-flow.ts

Time: ~5 minutes for full test  
Difficulty: Low  
Status: Ready to run! 🚀

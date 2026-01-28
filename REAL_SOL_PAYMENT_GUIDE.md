# � Privacy Cash SDK Deposit Flow

## Problem Yang Diperbaiki
User sebelumnya hanya menandatangani pesan (2x sign) tanpa benar-benar deposit SOL. Akibatnya link dibuat tapi penerima tidak bisa claim karena tidak ada balance di Privacy Cash pool.

**Sebelumnya:**
```
User: Bikin link 0.01 SOL → Sign 2x → Link dibuat ✅
Penerima: Claim → "No enough balance to withdraw" ❌
```

## Solusi: Privacy Cash SDK Deposit Flow

**Sekarang (BENAR):**
```
User: Bikin link 0.01 SOL 
  ↓
1️⃣ Frontend buat link ID
  ↓
2️⃣ Phantom popup: "Sign message untuk privacy?"
  ↓
3️⃣ User sign → Encryption key derived ✅
  ↓
4️⃣ UTXO dibuat (encrypted dengan user key)
  ↓
5️⃣ Phantom popup: "Sign UTXO untuk deposit?"
  ↓
6️⃣ User sign → Encrypted UTXO signed ✅
  ↓
7️⃣ Frontend kirim encrypted UTXO ke backend
  ↓
8️⃣ Backend relay ke Privacy Cash pool ✅
  ↓
Link created dengan Privacy Cash deposit TX
  ↓
Penerima: Claim → Withdraw dari Privacy Cash pool ✅
```

## Perbedaan: Manual Transfer vs Privacy Cash SDK

| Aspek | Manual Transfer (❌ SALAH) | Privacy Cash SDK (✅ BENAR) |
|-------|----------|-----------|
| **User signature** | 1x sign (transfer) | 2x sign (encryption + deposit) |
| **Privacy** | Public blockchain | Encrypted shielded pool |
| **Recipient claim** | Dapat langsung | Harus withdraw dari pool |
| **Only you can see** | Semua orang bisa lihat | Only encrypted UTXO |
| **Fee structure** | Hanya network fee | Pool fees + withdrawal fees |

## Files Yang Diubah

### 1. `frontend/src/utils/solTransfer.ts` (DIUBAH)
Bukan untuk manual transfer, tapi untuk **Privacy Cash SDK deposit**:

```typescript
export async function depositViaPriVacyCash(
  wallet: any,
  amount: string,
  linkId: string,
  publicKey: string
): Promise<{ depositTxHash: string; amount: string }>
```

**Flow:**
1. Initialize Privacy Cash SDK
   - User sign message untuk derive encryption key
   - Encryption key = kunci untuk encrypt UTXO
   
2. Create encrypted UTXO
   - Amount, blinding factor, pubkey
   - Fully encrypted dengan user's key
   
3. Sign UTXO data
   - User sign pesan UTXO
   - Proof bahwa user authorized deposit
   
4. Send to backend
   - Backend relay encrypted UTXO ke Privacy Cash API
   - Privacy Cash pool menerima deposit
   
5. Get deposit TX hash
   - Return Privacy Cash transaction hash
   - Link dibuat dengan deposit TX

### 2. `index.html` - `handleCreateLink()` Function
Flow sekarang:

```javascript
// 1. Create link metadata
const linkData = await fetch('/api/create-link', { amount, memo })
const linkId = linkData.id

// 2. Deposit to Privacy Cash pool via SDK
const deposit = await depositViaPriVacyCash(
  wallet,
  amount,
  linkId,
  walletAddress
)
// Returns: depositTxHash (Privacy Cash pool TX)

// 3. Link ready untuk di-share
const linkUrl = `https://shadowpay.app/claim/${linkId}`
```

### 3. `backend/src/routes/createLink.ts`
Simplified (tidak perlu paymentTxHash lagi):

- Buat link metadata dengan linkId
- `depositTx` field akan diset oleh endpoint `/api/deposit` later
- Privacy Cash deposit bukan bagian dari create-link

### 4. `backend/src/routes/config.ts`
Removed operatorAddress (tidak diperlukan):

- Dulu: user transfer SOL ke operator → butuh operatorAddress
- Sekarang: user deposit ke Privacy Cash via SDK → tidak perlu operatorAddress

## Keuntungan

✅ **True Privacy** - SOL encrypted di Privacy Cash pool, tidak public
✅ **User Control** - Only user (with private key) bisa claim
✅ **Operator Agnostic** - Tidak perlu trust operator wallet address
✅ **Shielded Pool** - Blinding factors hide transaction amount
✅ **Cryptographic Proof** - Signature proves user authorized deposit
✅ **Compatible** - Penerima claim via SDK withdraw juga

## User Experience

```
1️⃣ User input amount: "0.01 SOL"
2️⃣ Click "Create Link"
3️⃣ Phantom popup: "Sign message to enable privacy" → Approve
4️⃣ Phantom popup: "Sign UTXO deposit" → Approve  
5️⃣ Link created ✅
6️⃣ Share link: "https://shadowpay.app/claim/..."
7️⃣ Recipient click link
8️⃣ Recipient claim → Phantom popup: "Withdraw 0.01 SOL" → Approve
9️⃣ Recipient receive SOL ✅
```

## Technical Requirements

### Frontend
- ✅ Privacy Cash SDK (privacycash package)
- ✅ Phantom wallet dengan signMessage support
- ✅ BN.js untuk big number handling

### Backend
- ✅ Privacy Cash API endpoint (untuk relay)
- ✅ Database to store link + deposit TX
- ✅ /api/deposit endpoint untuk receive encrypted UTXO

### Environment
```bash
# Backend
SOLANA_NETWORK=mainnet-beta  # or devnet untuk testing
OPERATOR_KEYPAIR=[...secret key...]  # untuk relay/withdraw

# Frontend
VITE_BACKEND_URL=https://backend.example.com
```

## Testing

### Local Setup
```bash
# 1. Start backend
cd backend && npm run dev

# 2. Start frontend
cd frontend && npm run dev

# 3. Connect Phantom wallet (devnet)
- Settings → Network → Devnet
- Get test SOL: https://faucet.solana.com

# 4. Create link
- Enter amount: 0.01
- Click "Create Link"
- Approve 2 signatures di Phantom
- Link dibuat ✅
```

### Monitor Deposits
```bash
# Check backend logs
grep "Privacy Cash" backend.log

# Check database
SELECT id, amount, depositTx FROM payment_links WHERE id='...';

# Verify Privacy Cash pool
# https://privacycash.mintlify.app
```

## Security Notes

🔒 **Private Key Safety**
- User private key NEVER sent to backend
- Only signature sent untuk prove authorization
- Backend relay signature & encrypted UTXO

🔒 **UTXO Encryption**
- Encryption key derived dari user signature
- Only user (dengan matching private key) bisa decrypt
- Backend hanya lihat encrypted blob

🔒 **Operator Trust**
- Operator relay encrypted UTXO tanpa buka isi
- Operator tidak perlu trust user
- Cryptography guarantee fairness

## Troubleshooting

### "User rejected the deposit"
- User clicked "Reject" di Phantom popup
- Nothing wrong, user can try again

### "Insufficient SOL balance"
- User tidak punya cukup SOL untuk network fees
- Solusi: Add more SOL di Phantom

### "Privacy Cash deposit failed"
- Backend OPERATOR_KEYPAIR not configured
- Atau Privacy Cash API endpoint not available
- Check backend logs

### "Link created but recipient can't claim"
- Deposit TX tidak confirm di Privacy Cash yet
- Wait beberapa detik dan retry
- Check Privacy Cash pool status


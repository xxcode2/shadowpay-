# 💳 Real SOL Payment Integration

## Problem Yang Diperbaiki
User sebelumnya hanya menandatangani pesan (2x sign) tanpa benar-benar membayar SOL. Akibatnya link dibuat tapi penerima tidak bisa claim karena tidak ada balance di Privacy Cash pool.

**Sebelumnya:**
```
User: Bikin link 0.01 SOL → Sign 2x → Link dibuat ✅
Penerima: Claim → "No enough balance to withdraw" ❌
```

## Solusi: Real SOL Payment Flow

**Sekarang:**
```
User: Bikin link 0.01 SOL 
  ↓
1️⃣ Frontend minta address wallet operator dari backend (/api/config)
  ↓
2️⃣ Phantom popup: "Kirim 0.01 SOL ke operator?" 
  ↓
3️⃣ User approve → SOL transfer terjadi di blockchain ✅
  ↓
4️⃣ Link dibuat dengan paymentTxHash disimpan
  ↓
Penerima: Claim → Withdraw dari Privacy Cash pool ✅
```

## Files Yang Diubah

### 1. `frontend/src/utils/solTransfer.ts` (NEW)
Utility untuk handle SOL transfer via Phantom wallet:
```typescript
export async function sendSolPayment(
  wallet: any,
  recipientAddress: string,  // Backend operator wallet
  amountSOL: number          // Jumlah yang user mau bayar
): Promise<{ txHash: string; amount: number }>
```

**Cara kerja:**
- Validasi recipient address & amount
- Create transaction dengan SystemProgram.transfer
- Request user signature via `wallet.signTransaction()`
- Send signed transaction ke blockchain
- Wait untuk confirmation
- Return transaction hash

### 2. `index.html` - `handleCreateLink()` Function
Updated untuk request payment sebelum membuat link:

**Langkah-langkah:**
1. User input amount & memo
2. Fetch `/api/config` untuk dapat operator wallet address
3. Call `sendSolPayment()` → Phantom popup muncul
4. User approve payment
5. Jika payment success → call `/api/create-link` dengan `paymentTxHash`
6. Link dibuat & ditampilkan

### 3. `backend/src/routes/createLink.ts`
Updated untuk require `paymentTxHash`:

**Validasi:**
- Amount harus > 0 ✅
- Asset type valid (SOL/USDC/USDT) ✅
- **paymentTxHash REQUIRED** (baru) ✅

**Penyimpanan:**
- `depositTx` field sekarang menyimpan payment transaction hash
- Link tidak bisa dibuat tanpa proof of payment

### 4. `backend/src/routes/config.ts`
Added `operatorAddress` ke public config:

```json
{
  "operatorAddress": "9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX",
  "minAmount": 0.01,
  "network": "mainnet-beta",
  "fees": {...}
}
```

**Env variable diperlukan:**
```bash
OPERATOR_ADDRESS=9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX
```

## Keuntungan

✅ **Real Payment** - User benar-benar bayar SOL, bukan hanya sign
✅ **Proof on Blockchain** - Setiap link punya transaction hash di blockchain
✅ **Recipients Can Claim** - Balance ada di Privacy Cash pool
✅ **Operator Revenue** - Backend receive actual SOL payments
✅ **No Double-Spend** - Atomic database update prevents double claims
✅ **User Friendly** - Clear Phantom popup approval flow

## Testing

### Local Testing Setup
```bash
# Set environment variable
export OPERATOR_ADDRESS="YOUR_SOLANA_WALLET_ADDRESS"

# Run backend
cd backend && npm run dev

# Run frontend
cd frontend && npm run dev
```

### Test Flow
1. Open http://localhost:5173
2. Click "Connect Wallet" → Connect Phantom (devnet)
3. Enter amount: `0.01`
4. Click "Create Link"
5. Phantom popup appears → "Kirim 0.01 SOL ke OPERATOR_ADDRESS?"
6. Approve → Transaction confirmed
7. Link appears → Share to recipient
8. Recipient claim → Balance transferred from Privacy Cash pool ✅

### Phantom DevNet Setup
1. Install Phantom: https://phantom.app
2. Create/import wallet
3. Switch to Devnet: Settings → Network → Devnet
4. Get test SOL: https://faucet.solana.com

## Error Handling

User-friendly error messages:
- "You cancelled the payment request" → User reject di Phantom
- "Insufficient SOL balance" → User tidak punya cukup SOL
- "Backend not properly configured" → OPERATOR_ADDRESS tidak set

## Security Notes

⚠️ **IMPORTANT:**
- Set `OPERATOR_ADDRESS` env var di backend (wajib!)
- Private key operator harus aman di backend
- Frontend hanya menggunakan public address
- Payment validation via blockchain confirmation

## Next Steps

1. Deploy backend dengan `OPERATOR_ADDRESS` env var set
2. Test dengan Phantom wallet devnet
3. Monitor transaction hashes di explorer
4. Implement refund mechanism jika diperlukan

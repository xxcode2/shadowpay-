# 🔧 PANDUAN FIX ERROR DEPOSIT 500

## Error yang Terjadi
```
POST https://shadowpay-backend-production.up.railway.app/api/deposit/prepare
500 (Internal Server Error)
❌ Deposit flow error: response not ok
```

## Kemungkinan Penyebab & Solusi

### 1. 🔐 Privacy Cash SDK Tidak Terinstall / Error

**Cek:**
```bash
cd backend
npm list privacycash
# atau
pnpm list privacycash
```

**Fix:**
```bash
# Install SDK
npm install privacycash
# atau
pnpm install privacycash

# Rebuild
npm run build
```

### 2. ⚙️ Environment Variables Tidak Terkonfigurasi

**Cek file `.env` atau Railway environment variables:**

```env
# Wajib ada salah satu:
OPERATOR_SECRET_KEY=[200,228,213,157,...,188]
# atau
OPERATOR_PRIVATE_KEY=[200,228,213,157,...,188]

# RPC URL (wajib):
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
# atau
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Database (wajib):
DATABASE_URL=postgresql://...
```

**Fix di Railway:**
1. Buka dashboard Railway: https://railway.app/dashboard
2. Pergi ke tab "Variables"
3. Pastikan semua variable di atas ada
4. Redeploy jika perlu

### 3. 🔑 Format Operator Key Salah

**Format yang benar:**
```
[200,228,213,157,234,...]  <- 64 angka, dipisah koma
```

**Generate key baru jika perlu:**
```bash
cd backend
node generate-operator.ts
```

Copy output dan set sebagai `OPERATOR_SECRET_KEY`

### 4. 🌐 RPC URL Bermasalah

**Test RPC:**
```bash
curl -X POST https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

**Recommended RPC providers:**
- Helius: https://helius.dev (free tier available)
- QuickNode: https://quicknode.com
- Alchemy: https://alchemy.com

### 5. 💰 Operator Wallet Balance Kosong

Walaupun user yang bayar fees, operator wallet tetap perlu sedikit SOL untuk inisialisasi SDK.

**Cek balance:**
```bash
# Cari operator public key di logs
# Lalu cek di: https://solscan.io/account/YOUR_PUBLIC_KEY
```

**Fix:**
Kirim minimal 0.01 SOL ke operator wallet

### 6. 🐛 SDK Initialization Error

Jika semua di atas sudah dicek, issue adalah SDK initialization.

---

## 🚀 Quick Fix Steps

### Step 1: Run Diagnostic
```bash
cd backend
npx ts-node diagnostic-deposit.ts
```

### Step 2: Fix Issues yang Ditemukan
Ikuti instruksi dari diagnostic tool

### Step 3: Test Health Endpoint
```bash
curl -X GET https://shadowpay-backend-production.up.railway.app/api/deposit/health
```

Seharusnya return:
```json
{
  "status": "healthy",
  "service": "deposit",
  "checks": {
    "operatorKey": { "status": "ok", "publicKey": "..." },
    "rpc": { "status": "ok", "solanaVersion": "..." },
    "sdk": { "status": "ok" }
  }
}
```

### Step 4: Test Debug Endpoint
```bash
curl -X GET https://shadowpay-backend-production.up.railway.app/api/deposit/debug
```

Ini akan menunjukkan detail tentang environment setup

### Step 5: Test Deposit Prepare (setelah fix)
```bash
curl -X POST https://shadowpay-backend-production.up.railway.app/api/deposit/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "test-link-id",
    "amount": "0.01",
    "publicKey": "YOUR_WALLET_PUBLIC_KEY",
    "lamports": 10000000
  }'
```

---

## 📋 Checklist

- [ ] Privacy Cash SDK terinstall (`npm list privacycash`)
- [ ] `OPERATOR_SECRET_KEY` atau `OPERATOR_PRIVATE_KEY` terset
- [ ] `RPC_URL` atau `SOLANA_RPC_URL` terset
- [ ] `DATABASE_URL` terset
- [ ] RPC URL bisa diakses (test dengan curl)
- [ ] Operator wallet punya balance > 0.01 SOL
- [ ] Backend sudah di-rebuild setelah perubahan
- [ ] `/api/deposit/health` return status ok
- [ ] `/api/deposit/debug` return all checks ok

---

## 🔍 Cara Debug Live di Production (Railway)

### Option 1: Check Railway Logs
1. Buka dashboard Railway
2. Pilih project Anda
3. Buka tab "Deployments"
4. Klik deployment terbaru
5. Scroll ke "Logs" dan cari error messages

### Option 2: Test Endpoints
```bash
# Test health
curl https://shadowpay-backend-production.up.railway.app/api/deposit/health

# Test debug
curl https://shadowpay-backend-production.up.railway.app/api/deposit/debug
```

Kedua endpoint ini akan menunjukkan status lengkap configuration

---

## 💡 Masih Error?

Jika setelah semua langkah di atas masih error:

1. **Share error logs lengkap** dari Railway
2. **Share hasil dari `/api/deposit/debug`**
3. **Share hasil dari diagnostic tool**
4. **Cek:**
   - Apakah privacycash terinstall di Railway? (npm list)
   - Apakah operator key format benar?
   - Apakah RPC URL accessible dari Railway?

---

## 🔍 Error 500 Diagnosis Tree

```
ERROR 500 on /api/deposit/prepare
│
├─ Operator Key Error
│  └─ Fix: Set OPERATOR_SECRET_KEY or OPERATOR_PRIVATE_KEY
│
├─ RPC Connection Error
│  └─ Fix: Set valid RPC_URL or SOLANA_RPC_URL
│
├─ SDK Not Installed
│  └─ Fix: npm install privacycash
│
├─ SDK Initialization Error
│  └─ Fix: Check operator key format and RPC connection
│
├─ SDK.deposit() Error
│  └─ Fix: Check Privacy Cash SDK documentation
│
└─ Transaction Preparation Error
   └─ Fix: Check if SDK returns valid transaction
```

---

## 📞 Support

Jika masih stuck, check:
1. Privacy Cash SDK repository: https://github.com/privacy-cash/sdk
2. Solana documentation: https://docs.solana.com
3. Railway documentation: https://railway.app/docs

Good luck! 🚀

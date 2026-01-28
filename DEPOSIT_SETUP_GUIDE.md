# ✅ Deposit Flow - Cara Pakai dengan Private Key yang Sudah Ada

## Situasi Anda

✅ Anda **sudah punya** private key operator  
✅ Anda **sudah set** di Railway  
✅ Anda **ingin** langsung pakai tanpa generate lagi  

**Baik!** Tidak perlu generate lagi. Ikuti langkah-langkah di bawah.

---

## 🎯 Apa yang Sudah Kami Perbaiki

1. **Parser OPERATOR_SECRET_KEY** - Sekarang bisa handle multiple format:
   - ✅ `[200,228,213,...,188]` (JSON array)
   - ✅ `200,228,213,...,188` (comma-separated)
   - ✅ `200, 228, 213,..., 188` (dengan spasi)

2. **Error Messages** - Lebih jelas di Railway logs saat ada masalah

3. **TypeScript Errors** - SUDAH BERES! Tidak ada error di deposit.ts

---

## ✅ Langkah-Langkah Menggunakan Private Key yang Sudah Ada

### Step 1: Verifikasi OPERATOR_SECRET_KEY di Railway

Go to: https://dashboard.railway.app

1. Pilih project `shadowpay-backend-production`
2. Klik tab "Variables"
3. Cari `OPERATOR_SECRET_KEY`
4. Lihat nilainya - pastikan formatnya salah satu dari:

**Format Valid:**
```
200,228,213,157,140,222,215,18,159,133,75,191,136,...,129,188
```

ATAU:

```
[200,228,213,157,140,222,215,18,159,133,75,191,136,...,129,188]
```

### Step 2: Pastikan Nilai Benar

Cek bahwa nilai:
- ✅ Berisi 64 angka (pisah dengan koma)
- ✅ Tidak ada karakter aneh di awal/akhir
- ✅ Setiap angka antara 0-255
- ✅ Tidak ada kutip (quote) di sekeliling angka

### Step 3: Redeploy Backend

Kita sudah push update kode. Trigger redeploy di Railway:

**Opsi A: Push git (auto redeploy)**
```bash
cd /workspaces/shadowpay-
git add .
git commit -m "Trigger redeploy"
git push origin main
```

**Opsi B: Manual redeploy di Railway**
1. Go to Railway dashboard
2. Klik "Deployments"
3. Pilih deployment terbaru
4. Klik "Redeploy"

### Step 4: Tunggu & Cek Logs

Tunggu ~2-3 menit untuk deployment selesai.

Buka Railway logs dan cari baris ini:

✅ **Jika ada:**
```
✅ Operator keypair loaded successfully
📍 Operator wallet: BrR2YC...your-wallet...xyz
✅ SDK initialized
```

Berarti **BERHASIL!** Lanjut ke Step 5.

❌ **Jika ada error:**
```
❌ KEYPAIR LOADING FAILED
   Error: [pesan error]
```

Lihat detail errornya di bagian "Troubleshooting" di bawah.

### Step 5: Top Up Operator Wallet

Kirim **0.1 SOL** ke wallet public key yang ditampilkan di logs:

```
📍 Operator wallet: BrR2YC...xyz
```

Gunakan Phantom atau exchange apapun. Tunggu ~1 menit untuk confirm.

### Step 6: Test Deposit

1. Buka ShadowPay frontend: https://shadowpayy.vercel.app
2. Klik "Create Payment Link"
3. Isi nominal deposit (misal: 0.001 SOL)
4. Klik "Deposit"
5. Phantom popup akan muncul - klik "Approve"
6. Tunggu beberapa detik...
7. Seharusnya ada pesan "✅ Deposit Success"

---

## 🐛 Troubleshooting

### Error: "Unexpected non-whitespace character after JSON"

**Penyebab**: Format OPERATOR_SECRET_KEY salah

**Solusi**:
1. Lihat logs Railway untuk tahu apa yang tidak sesuai
2. Pastikan nilai hanya angka dan koma
3. Tidak ada spasi sebelum koma: ❌ `200 ,228` | ✅ `200,228`
4. Tidak ada bracket jika pakai comma-separated: ❌ `[200,228]` | ✅ `200,228`

### Error: "Operator wallet balance: 0 SOL"

**Penyebab**: Belum send SOL ke operator wallet

**Solusi**:
1. Lihat operator wallet public key di logs
2. Send minimal 0.1 SOL dari Phantom
3. Tunggu 1 menit untuk confirm
4. Coba deposit lagi

### Error: "Failed to initialize Privacy Cash SDK"

**Penyebab**: Private key corrupt atau RPC connection error

**Solusi**:
1. Pastikan private key tidak corrupt
2. Check RPC URL di environment (default: Helius)
3. Jika pakai custom RPC, pastikan working

### Error: "Link not found"

**Penyebab**: Payment link tidak ada di database

**Solusi**:
1. Create payment link dulu sebelum deposit
2. Pastikan linkId benar

---

## 📊 Request/Response Flow

```
USER BROWSER
     |
     | 1. POST /api/deposit/prepare
     |    (linkId, amount, publicKey, lamports)
     |
     v
BACKEND
     |
     | 2. Load OPERATOR_SECRET_KEY ✅
     | 3. Initialize Privacy Cash SDK ✅
     | 4. Generate ZK proof ✅
     | 5. Create unsigned transaction ✅
     |
     | Return: { transaction: "base64..." }
     |
     v
USER BROWSER
     |
     | 6. Sign transaction dengan Phantom ✅
     |
     | 7. POST /api/deposit
     |    (linkId, amount, signedTransaction)
     |
     v
BACKEND
     |
     | 8. Verify signed transaction ✅
     | 9. Record di database ✅
     | 10. Return success ✅
     |
     v
BLOCKCHAIN
     |
     | Transaction dengan ZK proof terkirim ✅
     | UTXO terenkripsi di Privacy Cash pool ✅
```

---

## ✅ Checklist Verifikasi

Sebelum test deposit, pastikan:

- [ ] OPERATOR_SECRET_KEY sudah di Railway Variables
- [ ] Format sudah benar (64 angka, pisah koma)
- [ ] Backend sudah redeploy (cek Deployments)
- [ ] Logs menunjukkan "✅ Operator keypair loaded successfully"
- [ ] Sudah send 0.1 SOL ke operator wallet
- [ ] Minimal 1 menit sudah lewat dari transfer SOL
- [ ] Payment link sudah dibuat
- [ ] Amount deposit > 0

---

## 🚀 Next Steps

Sekarang tinggal:

1. **Verifikasi** OPERATOR_SECRET_KEY di Railway
2. **Trigger redeploy** (git push atau manual)
3. **Tunggu** 2-3 menit
4. **Check logs** untuk "✅ Operator keypair loaded successfully"
5. **Top up** operator wallet dengan 0.1 SOL
6. **Test deposit** di ShadowPay

---

## 📝 Catatan

- **Tidak perlu generate keypair baru** - punya yang sekarang sudah bagus!
- **TypeScript errors** di editor sudah fix - itu hanya cache issue
- **Parser sekarang lebih fleksibel** - handle berbagai format
- **Error messages lebih jelas** - Rails logs akan show exactly apa masalahnya

---

**Status**: ✅ Siap pakai dengan private key yang sudah ada!  
**Build**: ✅ No errors  
**Next**: Trigger redeploy dan test deposit

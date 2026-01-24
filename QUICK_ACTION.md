# 🚀 QUICK ACTION (DO THIS NOW)

## 🔴 Current Status
- ✅ Code: READY (push ke Railway sudah done)
- ❌ Environment: MISSING vars di Railway dashboard
- ❌ Backend: Return 502 Bad Gateway

## ⚠️ WHY 502?
Railway tidak tahu nilai untuk `OPERATOR_SECRET_KEY` dan `DATABASE_URL`. Jadi saat startup, backend crash.

---

## 📋 LANGKAH YANG HARUS KAMU LAKUKAN (2 MENIT)

### 1️⃣ Buka Railway Dashboard
```
https://railway.app/dashboard
```

### 2️⃣ Pilih Project: shadowpay-backend

### 3️⃣ Klik Tab: Variables (atau Environment)

### 4️⃣ COPY-PASTE Semua Ini (exact copy):

**Buka file ini untuk semua 23 variables:**
```
/workspaces/shadowpay-/RAILWAY_SETUP_INSTRUCTIONS.md
```

Atau manual add critical 3 (minimum):

```
DATABASE_URL = postgres://postgres.cojxffgdjlhbuyokrpib:5enFwLqFBJBUq77w@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

OPERATOR_SECRET_KEY = 232,221,205,177,96,250,173,109,147,76,95,101,148,182,151,4,102,32,116,250,249,159,28,165,47,192,13,23,99,172,254,99,135,73,31,209,154,33,20,82,60,48,163,19,105,86,179,116,192,49,198,23,255,48,144,216,55,239,192,249,188,52,144,23

SOLANA_RPC_URL = https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
```

### 5️⃣ Klik SAVE / APPLY

### 6️⃣ Wait 2-3 minutes (Railway will auto-redeploy)

### 7️⃣ Test (copy-paste di browser):
```
https://shadowpay-backend-production.up.railway.app/health
```

**Expected result:**
```json
{
  "status": "ok",
  "config": {
    "DATABASE_URL": "✓ Set",
    "OPERATOR_SECRET_KEY": "✓ Set",
    "SOLANA_RPC_URL": "✓ Set"
  }
}
```

---

## ❓ Gimana Tau Var Sudah Benar?

Check Railway logs (dalam dashboard):
- ✅ `✅ Backend listening on port 3001` → DONE
- ❌ `Error: OPERATOR_SECRET_KEY not set` → Belum add var
- ❌ Kalau masih 502 → Tunggu 3 menit atau click "Redeploy"

---

## ✅ Setelah Backend OK

1. Kembali ke frontend: https://shadowpayy.vercel.app
2. Hard refresh: `Ctrl + Shift + R`
3. Connect wallet
4. Test "Check Link"
5. Verify link load tanpa error
6. Test create, deposit, claim

---

## 📞 Questions?

Semua answers ada di:
- `RAILWAY_SETUP_INSTRUCTIONS.md` (lengkap)
- `RAILWAY_VERIFICATION.md` (troubleshoot)

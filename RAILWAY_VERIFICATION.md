# 🚀 Railway Verification Checklist

## Status: ⏳ Backend Returning 502 Bad Gateway

### 📋 Langkah Debug (Urutan Penting)

#### 1️⃣ Check Railway Dashboard Environment Variables
- Login ke Railway: https://railway.app
- Pergi ke project "shadowpay-backend"
- Tab "Variables" / "Environment"
- Verify SEMUA ini ada:

```
❌ MISSING? → Tambahkan!

DATABASE_URL=postgres://...?sslmode=require&pgbouncer=true
POSTGRES_PRISMA_URL=postgres://...?sslmode=require&pgbouncer=true
POSTGRES_URL=postgres://...?sslmode=require
POSTGRES_URL_NON_POOLING=postgres://...?sslmode=require
POSTGRES_DATABASE=postgres
POSTGRES_HOST=...
POSTGRES_PASSWORD=...
POSTGRES_USER=postgres

OPERATOR_SECRET_KEY=232,221,205,...
OPERATOR_PUBLIC_KEY=A76iDmbuBR6cP5HdEbwNRw42yAKuDfda2ZodHn1gwvxE

SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
SOLANA_NETWORK=mainnet

SUPABASE_JWT_SECRET=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=https://cojxffgdjlhbuyokrpib.supabase.co

NEXT_PUBLIC_SUPABASE_URL=https://cojxffgdjlhbuyokrpib.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

NODE_ENV=production
PORT=3001
VITE_API_URL=https://shadowpay-backend-production.up.railway.app/api
VITE_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=...
```

#### 2️⃣ Check Railway Logs
- Railway Dashboard → shadowpay-backend
- Tab "Logs"
- Lihat apakah:
  - ✅ `✅ Backend listening on port 3001` → OK
  - ❌ `Error: OPERATOR_SECRET_KEY not set` → Missing env var
  - ❌ `Error: Cannot read property 'method' of null` → Extension/middleware bug
  - ❌ `ECONNREFUSED` → Database connection failed
  - ❌ `ETIMEDOUT` → Supabase database timeout

#### 3️⃣ If Still 502:
- Click "Redeploy" button di Railway
- Tunggu 2-3 menit
- Refresh dan test lagi

---

## ✅ Expected Success Indicators

### When Backend is Working:
```bash
$ curl -i https://shadowpay-backend-production.up.railway.app/health

# Should return:
HTTP/2 200 
Access-Control-Allow-Origin: https://shadowpayy.vercel.app
Content-Type: application/json

{
  "status": "ok",
  "port": 3001,
  "node_env": "production",
  "config": {
    "DATABASE_URL": "✓ Set",
    "OPERATOR_SECRET_KEY": "✓ Set",
    "SOLANA_RPC_URL": "✓ Set"
  }
}
```

### When Test Link Endpoint:
```bash
$ curl -i "https://shadowpay-backend-production.up.railway.app/api/link/test-id"

# Should return:
HTTP/2 200 
Access-Control-Allow-Origin: https://shadowpayy.vercel.app
Content-Type: application/json

{"error":"Link not found"} # OR {"id":"test-id",...}
```

---

## 🔴 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | Check Railway logs. ENV vars missing? |
| CORS blocked | Check `/health` endpoint response headers |
| OPERATOR_SECRET_KEY not set | Add to Railway Variables |
| Database connection timeout | Verify DATABASE_URL has `?sslmode=require` |
| "Application failed to respond" | Click "Redeploy" in Railway dashboard |

---

## 📞 Support

1. Check Railway logs first (most important!)
2. Verify all env vars are set
3. Redeploy if needed
4. Test `/health` endpoint

# 🚨 ACTION REQUIRED: Set Environment Variables in Railway Dashboard

## Status: Backend Returning 502 (Deployment Stuck)

Backend code is ready, but **Railway environment variables are NOT set correctly**.

---

## 🔴 CRITICAL VARS TO SET IN RAILWAY

Open: https://railway.app
1. Select project: **shadowpay-backend**
2. Click tab: **Variables**
3. Add/Update these (copy-paste exactly):

### Database Connection (CRITICAL)
```
DATABASE_URL = postgres://postgres.cojxffgdjlhbuyokrpib:5enFwLqFBJBUq77w@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

POSTGRES_PRISMA_URL = postgres://postgres.cojxffgdjlhbuyokrpib:5enFwLqFBJBUq77w@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

POSTGRES_URL = postgres://postgres.cojxffgdjlhbuyokrpib:5enFwLqFBJBUq77w@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

POSTGRES_URL_NON_POOLING = postgres://postgres.cojxffgdjlhbuyokrpib:5enFwLqFBJBUq77w@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require

POSTGRES_DATABASE = postgres
POSTGRES_HOST = aws-1-us-east-1.pooler.supabase.com
POSTGRES_PASSWORD = 5enFwLqFBJBUq77w
POSTGRES_USER = postgres
```

### Operator Wallet (CRITICAL - for PrivacyCash)
```
OPERATOR_SECRET_KEY = 232,221,205,177,96,250,173,109,147,76,95,101,148,182,151,4,102,32,116,250,249,159,28,165,47,192,13,23,99,172,254,99,135,73,31,209,154,33,20,82,60,48,163,19,105,86,179,116,192,49,198,23,255,48,144,216,55,239,192,249,188,52,144,23

OPERATOR_PUBLIC_KEY = A76iDmbuBR6cP5HdEbwNRw42yAKuDfda2ZodHn1gwvxE
```

### Solana RPC (CRITICAL - for blockchain)
```
SOLANA_RPC_URL = https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
SOLANA_NETWORK = mainnet
```

### Supabase Auth (from Supabase dashboard)
```
SUPABASE_JWT_SECRET = jIAQNFLKV5El5PNjVLWUD6VkgzbrXcTlaEznturPvBzp/89Ze2gHKxbHNwpnxfCEq8U58zJLJP3bCmf01V8puQ==

SUPABASE_PUBLISHABLE_KEY = sb_publishable_LOGMF99pWYuhiqOXUC303g_EZpW593U

SUPABASE_SECRET_KEY = sb_secret_Za-wljxW7VvOSCnTl12Gdg_lPPFGKV7

SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvanhmZmdkamxoYnV5b2tycGliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkxODAxNSwiZXhwIjoyMDg0NDk0MDE1fQ.GQjngZ2nEiox8VOx296kBemfATnv3MJLjSUkwlm8bB8

SUPABASE_URL = https://cojxffgdjlhbuyokrpib.supabase.co
```

### Frontend Config
```
NEXT_PUBLIC_SUPABASE_URL = https://cojxffgdjlhbuyokrpib.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvanhmZmdkamxoYnV5b2tycGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTgwMTUsImV4cCI6MjA4NDQ5NDAxNX0.4REc4D0_b6TK4ZkS8wTL4BCJJ9Vvre4NVdAUEFbQv0c

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_LOGMF99pWYuhiqOXUC303g_EZpW593U
```

### Server Config
```
NODE_ENV = production
PORT = 3001

VITE_API_URL = https://shadowpay-backend-production.up.railway.app/api
VITE_SOLANA_RPC = https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
```

---

## ✅ After Adding All Variables:

1. Click **"Save"** / **"Apply"** button
2. Railway will auto-redeploy
3. Wait **2-3 minutes** for deployment
4. Test: `curl https://shadowpay-backend-production.up.railway.app/health`
5. Should see:
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

## 🔍 How to Find These Values (If Needed)

### From Supabase Dashboard:
- Go to https://app.supabase.com
- Select project: `shadowpaydb`
- **Settings → API** → Copy all keys from there

### OPERATOR_SECRET_KEY:
- Already in `/workspaces/shadowpay-/backend/.env.production`
- Or check: `/tmp/generate_keypair.js` output (from earlier)

### SOLANA_RPC_URL:
- Get from Helius: https://www.helius.dev
- Or use: `https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c`

---

## 📋 Verification Checklist

After setting all vars in Railway, check:

- [ ] 1. All 23 variables shown in Railway dashboard
- [ ] 2. OPERATOR_SECRET_KEY has 64 comma-separated numbers
- [ ] 3. DATABASE_URL contains `?sslmode=require&pgbouncer=true`
- [ ] 4. SOLANA_RPC_URL is mainnet (not devnet)
- [ ] 5. Click "Redeploy" button if needed
- [ ] 6. Wait 2-3 minutes for build complete
- [ ] 7. Check logs: `✅ Backend listening on port 3001`
- [ ] 8. Test health endpoint returns 200 OK

---

## 🆘 Still 502 After Setting All Vars?

1. Check Railway logs (tab "Logs") for exact error
2. Look for error patterns:
   - `Error: OPERATOR_SECRET_KEY not set` → Var not saved
   - `ECONNREFUSED database` → DATABASE_URL wrong
   - `Error: connect ETIMEDOUT` → Database timeout (normal, retry)
3. Try "Redeploy" button again
4. Wait full 3 minutes before testing

---

## 🟢 Expected Success

When working:
```bash
$ curl https://shadowpay-backend-production.up.railway.app/health
HTTP/2 200
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

Then frontend can:
1. ✅ Verify link (GET /api/link/:id)
2. ✅ Create link
3. ✅ Deposit
4. ✅ Claim
5. ✅ See history

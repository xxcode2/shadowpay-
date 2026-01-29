# 🚀 Quick Start Guide - Privacy Cash Payment Links

Your system is **production-ready**. Here's how to use it.

---

## ✅ Status Check

```bash
# Frontend build status
cd frontend
npm run build
# Expected: ✓ built in ~12s

# Backend build status  
cd backend
npm run build
# Expected: ✔ Generated Prisma Client, TypeScript complete
```

Both should compile without errors.

---

## 🏃 Run Locally

### Start Backend

```bash
cd backend
npm run dev
# Listening on http://localhost:3001
```

### Start Frontend

```bash
cd frontend
npm run dev
# Running at http://localhost:5173
```

### Test Health

```bash
# Backend health check
curl http://localhost:3001/api/health

# Frontend index
open http://localhost:5173
```

---

## 🎯 How It Works

### 1️⃣ Create Payment Link

**Who:** Sender with SOL balance  
**Via:** Backend API

```bash
curl -X POST http://localhost:3001/api/create-link \
  -H "Content-Type: application/json" \
  -d '{"amount": "0.01"}'
```

**Response:**
```json
{
  "id": "link_abc123",
  "amount": 0.01,
  "url": "http://localhost:5173/?link=link_abc123",
  "depositTx": "...",
  "claimed": false
}
```

**What happens:**
- Sender deposits SOL into Privacy Cash pool
- System generates encrypted UTXO for deposit
- Link is stored in database
- Share link with recipient

### 2️⃣ Recipient Claims Link

**Who:** Recipient with Phantom wallet  
**Via:** Frontend UI

1. Open link URL
2. Click "Claim"
3. Connect Phantom wallet
4. **Frontend loads Privacy Cash SDK** (dynamic import)
5. **SDK executes withdrawal:**
   - Derives encryption key from signature
   - Decrypts UTXO from pool
   - Generates zero-knowledge proof
   - Calls Privacy Cash relayer API
   - Relayer sends SOL to recipient's wallet
6. **Backend confirms claim** with withdrawal proof
7. Done! 🎉

**Result:**
- SOL received in recipient's wallet
- Link marked as claimed in database
- Withdrawal transaction saved as proof

---

## 🔐 Architecture

```
┌─────────────────┐          ┌──────────────────┐
│   Frontend      │          │    Backend       │
│   (Your App)    │◄────────►│  (API Server)    │
└────────┬────────┘          └────────┬─────────┘
         │                            │
         │ 1. Fetch link              │ 2. Returns link + encryption
         │────────────────────────────►
         │
         ├─ 3. Load Privacy Cash SDK ──────────┐
         │                                      │
         │ 4. Execute withdrawal                │
         ├─────────────────────────────────────►│ Privacy Cash
         │                                      │  Relayer API
         │ 5. Get TX hash                       │
         │◄─────────────────────────────────────┤
         │                                      │
         │ 6. Confirm claim + TX proof          │
         ├────────────────────────────────────►│
         │                                      │
         │ 7. Mark claimed                      │
         │                                      │
         └──────────────────────────────────────┘
```

**Key Point:** Backend never touches private keys or initiates withdrawals. Only the SDK does.

---

## 📋 API Endpoints

### Create Link

```
POST /api/create-link
Content-Type: application/json

{
  "amount": "0.01"  // SOL amount
}

Response 201:
{
  "id": "link_xyz",
  "amount": 0.01,
  "url": "http://...,
  "depositTx": "...",
  "encryptedDeposit": "...",
  "claimed": false,
  "createdAt": "2026-01-29T..."
}
```

### Get Link Info

```
GET /api/link/{linkId}

Response 200:
{
  "id": "link_xyz",
  "amount": 0.01,
  "claimed": false,
  "depositTx": "...",
  "createdAt": "2026-01-29T...",
  "expiresAt": "2026-02-28T..."
}
```

### Claim Link (Frontend → Backend)

```
POST /api/claim-link/confirm
Content-Type: application/json

{
  "linkId": "link_xyz",
  "recipientAddress": "wallet_address",
  "withdrawalTx": "tx_hash_from_sdk"
}

Response 200:
{
  "success": true,
  "claimed": true,
  "withdrawn": true,
  "claimedAt": "2026-01-29T...",
  "withdrawalTx": "tx_hash"
}
```

### Health Check

```
GET /api/health

Response 200:
{
  "status": "ok",
  "timestamp": "2026-01-29T..."
}
```

---

## 🧪 Full Test Flow

```bash
# 1. Create link (sender)
LINK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/create-link \
  -H "Content-Type: application/json" \
  -d '{"amount": "0.01"}')

LINK_ID=$(echo $LINK_RESPONSE | jq -r '.id')
echo "Link created: $LINK_ID"

# 2. Check link (anyone)
curl -s http://localhost:3001/api/link/$LINK_ID | jq .

# 3. Claim link (in browser, with wallet connected)
# Go to: http://localhost:5173/?link=$LINK_ID
# Click "Claim"
# Connect wallet
# System does the rest automatically

# 4. Verify claim
curl -s http://localhost:3001/api/link/$LINK_ID | jq .
# Should now show: "claimed": true, "claimedBy": "wallet_address"
```

---

## 🌐 Deploy to Production

### Frontend → Vercel

```bash
cd frontend
npm run build
vercel deploy dist/
```

### Backend → Railway

```bash
git add .
git commit -m "Production deployment"
git push origin main
# Auto-deploys to Railway on push
```

### Environment Variables

**Frontend (.env.production):**
```
VITE_BACKEND_URL=https://your-production-backend.com
```

**Backend (.env.production):**
```
DATABASE_URL=postgresql://user:pass@host/db
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NODE_ENV=production
PORT=3001
```

---

## 🆘 Common Issues

### Issue: "Privacy Cash SDK not loaded"

**Cause:** SDK failed to import dynamically  
**Fix:**
```bash
# Check npm package installed
npm list privacycash

# Reinstall if needed
cd frontend
rm -rf node_modules
npm install

# Check circuit files exist
ls -la public/circuits/
```

### Issue: Withdrawal fails with "No transaction returned"

**Cause:** SDK doesn't have encryption key  
**Fix:**
1. Make sure user signed message with wallet
2. Check wallet has sufficient balance
3. Check Privacy Cash relayer is responding

### Issue: Claim confirmation fails (500 error)

**Cause:** Backend database issue  
**Fix:**
```bash
# Check backend logs
# Check database connection
npx prisma db push

# Check if link exists
curl http://localhost:3001/api/link/{linkId}
```

### Issue: Frontend build fails

**Cause:** Missing dependencies  
**Fix:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📚 Learn More

- **[Privacy Cash Docs](https://docs.privacycash.org)** - SDK reference
- **[LightProtocol Hasher](https://github.com/elusiv-privacy/hasher.rs)** - WASM hashing
- **[Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)** - Blockchain API

---

## 📞 Support

Need help? Check:

1. **Console logs** (Browser DevTools) - See SDK loading status
2. **Backend logs** (Terminal) - See API requests/errors
3. **Database** (Supabase) - Verify data is saved
4. **Network** (Browser DevTools) - Check API requests succeed

---

## 🎉 Success Criteria

You know it's working when:

✅ Frontend builds without TypeScript errors  
✅ Backend builds without errors  
✅ `npm run dev` starts both locally  
✅ `/api/health` returns 200 OK  
✅ Can create links via API  
✅ Can view link via API  
✅ Can claim link via UI (with wallet)  
✅ SOL appears in recipient's wallet  
✅ Link marked as claimed in database  

---

**Ready to go! 🚀**

Start with:
```bash
cd backend && npm run dev   # Terminal 1
cd frontend && npm run dev  # Terminal 2
# Then open http://localhost:5173
```

Good luck with your hackathon! 🎯

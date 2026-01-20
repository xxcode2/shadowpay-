# 🚀 ShadowPay Quick Start Guide

Get ShadowPay running in 5 minutes!

## Prerequisites

✅ Node.js 24+  
✅ npm or yarn  
✅ Phantom wallet (browser extension) - [Install here](https://phantom.app)

## 1️⃣ Clone & Install

```bash
cd /workspaces/shadowpay-

# Backend
cd backend
npm install

# Frontend (new terminal)
cd frontend
npm install
```

## 2️⃣ Start Both Services

### Option A: Separate Terminals (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Expected output:
```
🚀 ShadowPay Backend listening on port 3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.4.21 ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

### Option B: Combined Script

```bash
bash dev.sh
```

Starts both on single terminal. Stop with `Ctrl+C`.

## 3️⃣ Open in Browser

Go to: **http://localhost:5173**

You should see:
- 🔌 "Connect Wallet" button (top right)
- 💸 "Create Link" tab
- 🎁 "Claim Link" tab

## 4️⃣ Test the App

### Create a Private Payment Link

1. Click **🔌 Connect Wallet**
   - Phantom popup appears
   - Select your wallet
   - Approve connection

2. Go to **💸 Create Link** tab

3. Fill in the form:
   - **Amount:** `0.01` (in SOL/USDC/USDT)
   - **Asset Type:** Select one
   - Click **"Create Link"**

4. You'll see:
   - ✅ "Link created successfully!"
   - Link ID displayed
   - Transaction hash

5. Copy the link and share!

### Claim a Payment Link

1. Open the shared link in new tab (or same tab)

2. Click **🔌 Connect Wallet** (your recipient wallet)

3. Go to **🎁 Claim Link** tab

4. Paste the Link ID from the shared link

5. Click **"Fetch Link"**
   - Shows link amount & asset
   - "Claim Now" button appears

6. Click **"Claim Now"**

7. Check your wallet - funds arrived! 🎉

## 5️⃣ API Endpoints (for testing)

### Health Check
```bash
curl http://localhost:3001/health
```

### Create Link
```bash
curl -X POST http://localhost:3001/api/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.01,
    "assetType": "SOL",
    "depositTx": "mockTx123"
  }'
```

### Get Link Details
```bash
curl http://localhost:3001/api/link/a1b2c3d4e5f6
```

### Claim Link
```bash
curl -X POST http://localhost:3001/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "a1b2c3d4e5f6",
    "recipientAddress": "Ey5GG...",
    "withdrawTx": "mockTx456"
  }'
```

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill process on 3001 if needed
kill -9 <PID>

# Try again
npm run dev
```

### Frontend won't start

```bash
# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install

# Try again
npm run dev
```

### API calls failing

1. Make sure backend is running on port 3001
2. Check browser console (F12) for errors
3. Verify proxy in `vite.config.ts`:
   ```typescript
   proxy: {
     '/api': {
       target: 'http://localhost:3001',
     }
   }
   ```

### Phantom wallet not connecting

1. Make sure Phantom is installed
2. Check browser console for errors
3. Try refreshing the page
4. Phantom popup might be blocked - check notification icon

## 📚 Next Steps

- 📖 Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- 📝 Check [backend/README.md](backend/README.md) for API docs
- 🎨 Check [frontend/README.md](frontend/README.md) for UI details
- 🔒 Review [backend/DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md) for production DB setup

## 🎯 What's Happening Under the Hood

```
1. User connects wallet (Phantom)
   └─ Frontend gets user's public key

2. User creates link with 0.01 SOL
   └─ Frontend calls Privacy Cash SDK
      └─ SDK creates encrypted UTXO
      └─ SDK generates ZK proof
      └─ SDK sends to relayer
   └─ Frontend sends metadata to backend
      └─ Backend stores link data (amount, asset)
      └─ Backend returns unique linkId

3. Recipient claims link
   └─ Recipient opens shared link
   └─ Frontend fetches metadata from backend
   └─ Recipient connects wallet
   └─ Frontend calls Privacy Cash SDK
      └─ SDK verifies ZK proof (sender privacy!)
      └─ SDK generates withdraw proof
      └─ SDK sends to relayer
   └─ Relayer executes on Solana
   └─ Funds arrive in recipient's wallet

Privacy guaranteed by ZK proofs - Solana can't see sender!
```

## ✅ Checklist

- [ ] Node.js 24+ installed (`node -v`)
- [ ] Both backend and frontend running
- [ ] Phantom wallet installed
- [ ] App loads at http://localhost:5173
- [ ] Can connect wallet
- [ ] Can create a link
- [ ] Can claim a link
- [ ] Funds transferred (mock mode for now)

## 🆘 Need Help?

1. Check error messages in terminal
2. Check browser console (F12 → Console tab)
3. Read [ARCHITECTURE.md](ARCHITECTURE.md)
4. Review specific service README files
5. Check Privacy Cash SDK: `/privacy-cash-sdk/README.md`

---

**That's it!** You now have ShadowPay running locally. Happy testing! 🎉


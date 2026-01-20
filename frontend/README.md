# 🎨 ShadowPay Frontend - TypeScript + Vite

## ✅ Structure

```
frontend/
├── src/
│   ├── main.ts          # Entry point
│   └── app.ts           # Main app logic
├── index.html           # HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## 🚀 Development

### Start Frontend Dev Server

```bash
cd frontend
npm install
npm run dev
```

**Server will run at:** `http://localhost:5173`

### Features

- ✅ **Create Payment Link**
  - Enter amount and asset type (SOL, USDC, USDT)
  - Click "Create Link"
  - TODO: Integrate Privacy Cash SDK for deposit
  - Backend creates link metadata
  - Link shared with recipient

- ✅ **Claim Payment Link**
  - Enter link ID or paste full URL
  - Link details displayed
  - TODO: Integrate Privacy Cash SDK for withdraw
  - Funds transferred to recipient wallet

### UI Components

- Header with wallet connect button
- Tab switching (Create / Claim)
- Form inputs with Tailwind styling
- Result cards with copy button
- Status bar showing backend connection

## 🔌 Backend Integration

Frontend proxies API calls to backend:

```
http://localhost:5173/api/* → http://localhost:3001/api/*
```

Configured in `vite.config.ts`:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true
  }
}
```

## 📦 Dependencies

**Core:**
- `@solana/web3.js` - Solana blockchain interaction
- `privacycash` - Privacy Cash SDK (for later integration)

**Dev:**
- `vite` - Build tool + dev server
- `typescript` - TypeScript compiler

## 🎯 Next Steps

### 1. Integrate Privacy Cash SDK

**For Deposit (Create Link):**

```typescript
// In handleCreateLink()
const privacyCash = new PrivacyCash({
  connection,
  owner: userWallet.publicKey  // User's wallet
})

const depositResult = await privacyCash.deposit({
  lamports: amount * 1e9  // Convert to lamports
})

// Send depositResult.tx to backend
```

**For Withdraw (Claim Link):**

```typescript
// In processWithdrawal()
const withdrawResult = await privacyCash.withdraw({
  lamports: linkAmount * 1e9,
  recipientAddress: userWallet.address
})

// Send withdrawResult.tx to backend
```

### 2. Add Phantom Wallet Support

Currently checks `window.solana` but needs proper setup:

```typescript
// Inject Phantom wallet provider script in index.html
// Or use @solana/wallet-adapter-wallets
```

### 3. Testing

Test endpoints:

```bash
# Create link
curl -X POST http://localhost:5173/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount":0.01,"assetType":"SOL","depositTx":"test-tx"}'

# Get link
curl http://localhost:5173/api/link/a1b2c3d4

# Claim link
curl -X POST http://localhost:5173/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{"linkId":"a1b2c3d4","recipientAddress":"...","withdrawTx":"test-tx"}'
```

## 📝 File Locations

| File | Purpose |
|------|---------|
| `src/main.ts` | Vite entry point |
| `src/app.ts` | Main app class, UI rendering, event handling |
| `index.html` | HTML template with Tailwind + fonts |
| `vite.config.ts` | Vite configuration + proxy setup |

## 🔐 Environment Variables

Create `.env.local` (not committed):

```
VITE_API_URL=http://localhost:3001/api
VITE_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=...
```

## 🚢 Build & Deploy

```bash
# Build
npm run build

# Preview production build
npm run preview
```

Output: `dist/` folder ready for Vercel/Netlify

## 🐛 Troubleshooting

**Vite not starting?**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**API calls failing?**
- Check backend is running on port 3001
- Check CORS headers in backend
- Check proxy config in vite.config.ts

**Phantom wallet not detected?**
- Make sure Phantom extension is installed
- Check browser console for errors
- Add proper wallet adapter library


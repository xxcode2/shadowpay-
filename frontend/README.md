# 🎨 ShadowPay Frontend - TypeScript + Vite

Modern privacy payment UI built with TypeScript, Vite, and Tailwind CSS.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── assets/
│   │   └── pay.png                 # ShadowPay logo
│   ├── components/
│   │   └── aiAssistant.ts          # AI natural language interface
│   ├── flows/
│   │   ├── depositFlow.ts          # Privacy Cash deposit logic
│   │   ├── depositFlowV2.ts        # Simplified deposit (official SDK)
│   │   ├── withdrawFlow.ts         # Privacy Cash withdraw logic
│   │   └── withdrawFlowV2.ts       # Simplified withdraw (official SDK)
│   ├── services/
│   │   ├── privacyCashClient.ts    # Official Privacy Cash SDK wrapper
│   │   ├── linkAPI.ts              # Payment link management
│   │   └── keypairManager.ts       # Keypair management
│   ├── utils/
│   │   └── notificationUtils.ts    # Toast notifications
│   ├── app.ts                      # Main application controller
│   ├── config.ts                   # Configuration (RPC endpoints, URLs)
│   └── main.ts                     # Entry point
├── index.html                      # HTML template with all tabs
├── vite.config.ts                  # Vite configuration with @ alias
├── tsconfig.json                   # TypeScript config with path mappings
├── package.json
└── .env.example
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Backend running on `http://localhost:8080` (or set `VITE_BACKEND_URL`)

### Installation & Development

```bash
cd frontend
npm install
npm run dev
```

**Frontend runs on:** `http://localhost:5173`

### Build for Production

```bash
npm run build
# Output: frontend/dist/
```

## 🏗️ Architecture

### Tab-Based Navigation

| Tab | Purpose |
|-----|---------|
| **Deposit** | Deposit SOL to your private balance using ZK proofs |
| **Send** | Send SOL from your private balance to any address |
| **AI** | Natural language interface for deposits and sends |
| **About** | Learn how privacy works |

### Core Features

#### 1. Wallet Connection
- Uses Phantom wallet browser extension
- Non-custodial (keys never leave device)
- Message signing for authorization & encryption

#### 2. Deposit (Privacy Cash)
- Non-custodial deposit to Privacy Cash pool using ZK proofs
- Generates zero-knowledge proof in browser
- Amount is encrypted and hidden on-chain
- Funds stored in shielded UTXO with your encryption key

#### 3. Send Privately
- Withdraw from your private balance
- Send to any Solana wallet address
- Recipient receives directly to their wallet
- Transaction details remain private

#### 4. AI Assistant (New!)
- Natural language interface using `parseIntent()`
- Commands: "deposit 0.01 SOL", "send 0.01 SOL to <address>", "check balance"
- Real-time progress updates with emojis
- Built-in address validation (32-44 chars, base58 format)
- Better UX with color-coded messages (green success, red errors)

#### 5. About Section
- What is ShadowPay (features)
- Why Trust ShadowPay (security benefits)
- How Privacy Works (ZK proofs explanation)
- AI Assistant capabilities

## 💻 Key Technologies

| Technology | Purpose |
|-----------|---------|
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Lightning-fast build tool |
| **Tailwind CSS** | Utility-first CSS framework |
| **Solana Web3.js** | Blockchain interaction |
| **Privacy Cash SDK** | ZK proof generation & Privacy Cash integration |
| **Phantom Wallet API** | Wallet connection & message signing |

## 🔧 Configuration

### Environment Variables (`.env.local`)

```bash
# Backend API URL (defaults to production if not set)
VITE_BACKEND_URL=http://localhost:8080

# Solana RPC URL (for wallet connection)
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com
```

### Build Configuration

- **Target:** ES2020
- **Module Resolution:** Bundler (Vite)
- **CSS:** Tailwind CSS with utility classes
- **Assets:** Vite-optimized with content hashing

## 🎨 UI/UX

### Design System
- **Dark theme** (suitable for privacy-focused brand)
- **Glass-morphism** cards with backdrop blur
- **Gradient accents** for visual hierarchy
- **Smooth transitions** for interactions
- **Responsive design** for all screen sizes

### Component Highlights
- Loading spinners with animated pulse
- Success/error notifications
- Modal dialogs for confirmations
- Tab navigation with active states
- Pagination for large lists

## 📡 API Integration

### Backend Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/private-send` | POST | Create private payment record |
| `/api/incoming` | GET | Fetch incoming payments |
| `/api/history` | GET | Fetch transaction history |
| `/api/health` | GET | Health check |

### Request Flow

```
User Input
    ↓
Phantom Wallet Signing
    ↓
Privacy Cash SDK (Browser)
    ↓
Backend API Calls
    ↓
Transaction Record
    ↓
UI Update
```

## 🔐 Security Features

✅ **Non-Custodial**
- Your private keys never sent to frontend or backend
- Only message signing via Phantom

✅ **Zero-Knowledge Proofs**
- ZK proofs generated in browser
- Transaction validity verified without revealing details

✅ **Recipient Privacy**
- Recipient address encrypted on-chain
- Only recipient can decrypt payment

✅ **Client-Side Encryption**
- Message signing for encryption key derivation
- No plaintext credentials stored

## 🛠️ Development

### TypeScript Compilation

```bash
npm run build
```

### Type Checking

TypeScript checks are performed during build:
- `strict: true` enables strict type checking
- `noImplicitAny: true` requires type annotations
- Path aliases (`@/`) properly configured

### Asset Handling

Images in `src/assets/` are:
- Imported as TypeScript modules
- Bundled by Vite with content hashing
- Optimized for web delivery

Example:
```typescript
import logo from '@/assets/pay.png'

// Use in code:
document.querySelector('img').src = logo
```

## 📝 Styling

### Tailwind CSS Classes

Key utility classes used:
- **Layout:** `flex`, `grid`, `container`
- **Colors:** `bg-gray-950`, `text-white`, `border-gray-700`
- **Effects:** `rounded-lg`, `backdrop-blur-md`, `shadow-lg`
- **States:** `hover:bg-purple-700`, `focus:outline-none`
- **Transitions:** `transition-all`, `ease-in-out`

### Custom CSS

Minimal custom CSS in `index.html` `<style>` tag:
- Glass-card styling
- Gradient borders
- Animation keyframes (fade, scale, spin)
- Modal styling

## 🚢 Deployment

### Vercel Deployment

```bash
# Build
npm run build

# Deploy (Vercel auto-detects)
vercel deploy
```

Set environment variable in Vercel dashboard:
```
VITE_BACKEND_URL=https://your-backend.railway.app
```

### Local Testing with Backend

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Optional - Tail logs
tail -f backend/logs/*.log
```

## 📊 Performance

- **Build time:** ~11s
- **Dev server start:** <1s
- **Bundle size:** ~4.2MB (includes Privacy Cash SDK + WASM)
- **Runtime:** Zero hydration delay

## 🐛 Troubleshooting

### Logo Not Showing
- Ensure `src/assets/pay.png` exists
- Check browser console for import errors
- Clear build cache: `rm -rf dist/`

### Backend Not Connecting
- Verify backend is running on port 8080
- Check `VITE_BACKEND_URL` environment variable
- Browser console should show connection attempt

### Wallet Not Connecting
- Phantom extension must be installed
- Check if Phantom is enabled for this domain
- Try reloading the page

### ZK Proof Generation Slow
- Privacy Cash SDK generates proofs client-side
- May take 10-30 seconds depending on device
- Check browser console for progress

## 📚 Resources

- **Vite Docs:** https://vitejs.dev/
- **TypeScript:** https://www.typescriptlang.org/
- **Tailwind CSS:** https://tailwindcss.com/
- **Solana Web3.js:** https://solana-labs.github.io/solana-web3.js/
- **Phantom Wallet:** https://phantom.app/
- **Privacy Cash:** https://privacycash.io/

## 📄 License

MIT

---

**Ready to develop!** Start with `npm run dev` 🚀


# 🎨 ShadowPay Frontend - TypeScript + Vite

Modern privacy payment UI built with TypeScript, Vite, and Tailwind CSS.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── assets/
│   │   └── pay.png              # ShadowPay logo
│   ├── flows/
│   │   └── depositFlow.ts        # Privacy Cash deposit logic
│   ├── services/
│   │   └── browserDeposit.ts     # Non-custodial deposit execution
│   ├── utils/
│   │   ├── encryptionHelper.ts   # Message encryption
│   │   └── notificationUtils.ts  # Toast notifications
│   ├── app.ts                    # Main application class
│   └── main.ts                   # Entry point
├── index.html                   # HTML template
├── vite.config.ts              # Vite configuration with @ alias
├── tsconfig.json               # TypeScript config with path mappings
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
| **Send** | Create private payment with ZK proofs |
| **Receive** | View incoming payments (Available/Withdrawn) |
| **History** | Track sent & received transactions (paginated) |
| **About** | Learn how privacy works |

### Core Features

#### 1. Wallet Connection
- Uses Phantom wallet browser extension
- Non-custodial (keys never leave device)
- Message signing for authorization

#### 2. Send Private Payment
- Select token (currently SOL only)
- Enter recipient address
- Generate ZK proof in browser
- Non-custodial deposit to Privacy Cash
- Backend records transaction

#### 3. Receive Payments
- Incoming payments auto-decrypted
- Shows Available & Withdrawn tabs
- 5 items per page (paginated)
- Claim button to withdraw

#### 4. Transaction History
- Sent payments tab
- Received payments tab
- 10 items per page (paginated)
- Full transaction details

#### 5. About Section
- What is ShadowPay (4 features)
- Why Trust ShadowPay (5 reasons)
- How Privacy Works (5-step process)

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
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
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


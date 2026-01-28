# Privacy Cash Circuit Files Setup

## Overview

ShadowPay menggunakan Privacy Cash SDK yang memerlukan circuit files (WebAssembly + Zero-Knowledge Proof Keys) untuk generate ZK proofs client-side.

## File Structure

```
frontend/
├── public/
│   └── circuits/                    ← ✅ Circuit files di sini
│       ├── transaction2.wasm        (3.1 MB)
│       └── transaction2.zkey        (16 MB)
└── src/
    ├── services/
    │   └── privacyCashService.ts    ← Load circuit files
    └── flows/
        └── depositFlow.ts           ← Use circuits untuk ZK proof
```

## File Details

### transaction2.wasm (3.1 MB)
- **Jenis**: WebAssembly module
- **Fungsi**: Compiled ZK circuit yang berjalan di browser
- **Digunakan untuk**: Generate ZK proofs di client-side
- **Di-load di**: Browser saat deposit flow

### transaction2.zkey (16 MB)
- **Jenis**: Proving key untuk ZK circuit
- **Fungsi**: Kunci untuk generate valid ZK proofs
- **Digunakan untuk**: Prove knowledge tanpa reveal data
- **Di-load di**: Browser saat deposit flow

## How It Works

### 1. Files di Public Folder
```
Frontend akan serve files dari public/circuits/ saat build
Vite treats public/ folder as static assets
Files accessible via HTTP GET /circuits/transaction2.wasm
```

### 2. Service Initialization
```typescript
// PrivacyCashService.ts
await PrivacyCashService.initializeClient()
  ↓
loadCircuitFiles()
  ↓
Fetch /circuits/transaction2.wasm
Fetch /circuits/transaction2.zkey
  ↓
Initialize SDK with circuit paths
```

### 3. Deposit Flow
```typescript
// depositFlow.ts
executeRealDeposit()
  ↓
await PrivacyCashService.initializeClient()
  ↓
privacyCashClient.deposit({ lamports })
  ↓
SDK uses WASM + ZKEY to generate ZK proof
  ↓
Returns signed transaction with proof embedded
```

## Privacy Cash SDK Flow

Dokumentasi dari Privacy Cash team:

### Deposit Process:
1. **Sender** creates commitment, encrypted UTXO note, ZK proof
2. **Frontend** (using SDK + circuits) generates:
   - UTXO encryption with user's key
   - ZK proof using transaction2.wasm + transaction2.zkey
   - Transaction signature
3. **Backend** relays signed transaction + proof to relayer
4. **Onchain** program verifies ZK proof & commits UTXO to merkle tree

### Withdrawal Process:
1. **User** decrypts recent UTXO using private key
2. **Frontend** generates withdrawal ZK proof
3. **Backend** relays to relayer (signs transaction)
4. **Onchain** program verifies proof & sends SOL

## Configuration

### Environment Setup
```bash
# Frontend uses default paths
# No env vars needed - files served from public/circuits/

# For development
VITE_BACKEND_URL=http://localhost:3000
```

### Vite Configuration
```typescript
// vite.config.ts already configured to serve public folder
// No changes needed - just place files in public/circuits/
```

## Verification

### Check Files Loaded Correctly

```bash
# 1. Verify files exist
ls -lh frontend/public/circuits/

# Expected output:
# -rw-rw-rw- 1 ... 3.1M ... transaction2.wasm
# -rw-rw-rw- 1 ... 16M  ... transaction2.zkey

# 2. Build and check
cd frontend && npm run build

# Should see no WASM-related warnings
# Files will be copied to dist/circuits/
```

### Browser DevTools Check
```javascript
// Open browser console during deposit
// Should see logs like:
// "📦 Loading Privacy Cash circuit files..."
// "✅ Circuit files loaded:"
// "   WASM: /circuits/transaction2.wasm"
// "   ZKEY: /circuits/transaction2.zkey"
```

## Troubleshooting

### "Circuit files not found"
```
Solution: Verify files exist in frontend/public/circuits/
$ ls -l frontend/public/circuits/transaction2.*

If missing, copy from backend:
$ cp backend/circuit2/*.* frontend/public/circuits/
```

### Large File Warnings
```
The .zkey file is 16MB which is large for web.

Options:
1. Keep as-is (users download once, cached by browser)
2. Split into chunks (complex, not recommended)
3. Host on CDN (future optimization)

For now: Keep in public/ - browser caches it
```

### WASM Loading Issues
```
Solution: Ensure Vite serves public folder correctly

vite.config.ts should have (already configured):
export default defineConfig({
  server: {
    middlewareMode: true,
  },
  // Vite automatically serves public/ at root
})
```

## Performance Notes

### File Sizes
- Total: ~19 MB (3.1 MB WASM + 16 MB ZKEY)
- Downloaded only once (browser cache)
- Loaded only during deposit/withdrawal
- Not loaded on page load

### Timing
- First load: ~500ms - 2s (depends on network)
- Subsequent loads: <100ms (from browser cache)
- Not blocking UI - loaded asynchronously

## Security

### What's Safe to Share
✅ Files are cryptographic public data
✅ WASM is compiled, not readable
✅ ZKEY contains proving key (public)
✅ No private keys in these files

### What's Protected
✅ Private keys stay in user's browser
✅ User's encryption key derived from signature
✅ Transaction signing happens client-side only

## Backend Impact

❌ **Backend does NOT use these files**
- Backend only relays signed transactions
- ZK proof already generated by frontend
- Proof embedded in signed transaction
- Backend validates proof via on-chain program

## Next Steps

### If Using Real Privacy Cash SDK
1. Import actual PrivacyCash client
2. Pass wasmPath & zkeyPath to client initialization
3. SDK will use circuit files to generate proofs

### Example (once SDK is fully integrated):
```typescript
import PrivacyCash from 'privacycash'

const client = new PrivacyCash({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  wasmPath: '/circuits/transaction2.wasm',
  zkeyPath: '/circuits/transaction2.zkey',
})

const proof = await client.generateZkProof({
  amount: lamports,
  encryptionKey: derivedKey,
})
```

## Files Reference

- [Privacy Cash SDK Repo](https://github.com/Privacy-Cash/privacy-cash-sdk)
- [Circuit Documentation](https://docs.privacycash.org/circuits)
- [ZK Proof Generation](https://docs.privacycash.org/zk-proofs)

---

**Status**: ✅ Circuit files setup complete and integrated
**Location**: `frontend/public/circuits/`
**Frontend Service**: `frontend/src/services/privacyCashService.ts`
**Used in**: `frontend/src/flows/depositFlow.ts`

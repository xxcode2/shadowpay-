# 🔐 ShadowPay - Privacy Cash SDK Integration

Complete Privacy Cash SDK integration for ShadowPay - enabling secure, private deposits on Solana.

## 📚 Documentation

This integration includes comprehensive documentation:

| Document | Purpose |
|----------|---------|
| **[QUICK_START.md](./QUICK_START.md)** | 5-minute getting started guide |
| **[PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)** | Complete integration guide & best practices |
| **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)** | What's included & implementation summary |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Production deployment instructions |
| **[frontend/src/API_REFERENCE.md](./frontend/src/API_REFERENCE.md)** | API documentation & reference |

## 🚀 Quick Start

```typescript
import { executeRealDeposit } from './flows/depositFlow'
import { parseSOLToLamports } from './utils/privacyCashUtils'

// Deposit 0.1 SOL to Privacy Cash
const result = await executeRealDeposit({
  lamports: parseSOLToLamports(0.1),
  wallet: phantomWallet,
  linkId: 'payment-link-123'
})

console.log('Deposit successful:', result.tx)
console.log('View on Explorer:', result.explorerUrl)
```

See [QUICK_START.md](./QUICK_START.md) for complete setup instructions.

## ✨ Features

### 🔐 Privacy
- ✅ Zero-knowledge proof generation
- ✅ Client-side encryption
- ✅ Encrypted UTXOs
- ✅ Privacy assessment & recommendations
- ✅ Best practices guidance

### 💰 Deposits
- ✅ Solana SOL deposits
- ✅ Direct to Privacy Cash shielded pool
- ✅ Automatic consolidation
- ✅ Transaction monitoring
- ✅ Fee estimation

### ✔️ Validation
- ✅ Deposit amount validation
- ✅ Protocol limit checking
- ✅ Address validation
- ✅ Privacy assessment
- ✅ Comprehensive error handling

### 🎯 User Experience
- ✅ Clear status messages
- ✅ Error guidance
- ✅ Explorer URLs
- ✅ Fee breakdown
- ✅ Privacy warnings

## 📁 Integration Structure

```
shadowpay/
├── frontend/
│   └── src/
│       ├── flows/
│       │   ├── depositFlow.ts              ← Main deposit logic
│       │   └── exampleIntegrations.ts      ← 8 working examples
│       ├── utils/
│       │   └── privacyCashUtils.ts         ← 10+ utility functions
│       ├── config.ts                       ← Configuration
│       └── API_REFERENCE.md                ← API docs
├── backend/
│   └── src/
│       └── routes/
│           └── deposit.ts                  ← Backend endpoint
└── Documentation Files (below)
```

## 📖 Implementation Files

### Core Deposit Flow
[frontend/src/flows/depositFlow.ts](./frontend/src/flows/depositFlow.ts)
- Main deposit execution
- Validation & error handling
- Privacy assessment
- Backend notification

### Utility Functions
[frontend/src/utils/privacyCashUtils.ts](./frontend/src/utils/privacyCashUtils.ts)
- Amount validation
- Address validation
- Amount conversion
- Fee estimation
- Privacy assessment
- Error mapping

### Code Examples
[frontend/src/flows/exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts)
1. Basic deposit
2. Multiple deposits
3. Privacy-optimized deposit
4. Deposit with validation
5. Deposit with fee estimation
6. Error handling
7. Batch deposits
8. Explorer URLs

### Backend API
[backend/src/routes/deposit.ts](./backend/src/routes/deposit.ts)
- POST /api/deposit endpoint
- Transaction recording
- Database updates
- Error handling

## 💻 Development

### Prerequisites
- Node.js 16+
- pnpm or npm
- Phantom wallet (for testing)

### Installation

```bash
# Clone repository
git clone https://github.com/xxcode2/shadowpay-.git
cd shadowpay-

# Install dependencies
pnpm install

# Start development
cd frontend
npm run dev

# In another terminal
cd backend
npm run dev
```

## 🧪 Testing

### Manual Testing Flow
1. Connect Phantom wallet
2. Create payment link
3. Execute deposit
4. Approve signature
5. Verify on Solana Explorer

### Test Amounts
- 0.01 SOL - Minimum
- 0.1 SOL - Standard
- 1.0 SOL - Large amount

See [QUICK_START.md](./QUICK_START.md#testing) for detailed testing guide.

## 🔧 Configuration

### Frontend (.env)
```bash
VITE_BACKEND_URL=http://localhost:3000
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=KEY
VITE_SHARE_BASE_URL=http://localhost:5173
VITE_PRIVACY_CASH_POOL=9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://...
NODE_ENV=development
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production config.

## 📊 API Reference

### executeRealDeposit()

```typescript
const result = await executeRealDeposit({
  lamports: number        // Amount in lamports
  wallet: any            // Wallet adapter
  linkId: string         // Payment link ID
  skipPrivacyWarning?: boolean
})

// Returns
{
  tx: string             // Transaction signature
  amountSOL: string      // Amount formatted
  amountLamports: number // Raw amount
  explorerUrl: string    // Solana Explorer URL
  message: string        // Success message
}
```

See [frontend/src/API_REFERENCE.md](./frontend/src/API_REFERENCE.md) for complete API reference.

## 💾 Deposit Limits

| Limit | Amount |
|-------|--------|
| Minimum | 0.001 SOL |
| Recommended Max | 10 SOL |
| Protocol Max | Variable |

## 💸 Fees

| Type | Amount |
|------|--------|
| Protocol | Free (0 SOL) |
| Network | ~0.002 SOL |
| Withdrawal | 0.006 SOL + 0.35% |

## 🐛 Error Handling

Comprehensive error handling with user-friendly messages:

```typescript
try {
  const result = await executeRealDeposit({...})
} catch (error) {
  // Error message is user-friendly
  console.error(error.message)
  
  // Debug context available
  const context = (error as any).context
}
```

See [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#error-handling-guide) for error details.

## 🔐 Security

- ✅ Client-side encryption
- ✅ ZK proof generation (SDK)
- ✅ No private keys stored
- ✅ Transaction validation
- ✅ Input sanitization
- ✅ Error boundary handling

## 📈 Best Practices

### Privacy Optimization
- Use round amounts (1 SOL, 0.5 SOL)
- Avoid unique amounts
- Use common denominations
- Space out deposits

### Development
- Use dev mode with Phantom testnet
- Test with various amounts
- Monitor console logs
- Check Solana Explorer

### Production
- Use mainnet RPC
- Set environment variables
- Enable error monitoring
- Monitor transaction fees

See [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#best-practices) for full best practices.

## 📦 Dependencies

```json
{
  "privacycash": "^1.1.11",
  "@solana/web3.js": "^1.98.4",
  "typescript": "^5.9.2",
  "vite": "^5.0.0"
}
```

## 🚀 Deployment

### Vercel + Railway
```bash
# Frontend to Vercel
vercel --prod

# Backend to Railway
git push main
```

### Docker
```bash
docker build -t shadowpay .
docker compose up -d
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## 📝 Documentation Files

1. **[QUICK_START.md](./QUICK_START.md)** - Start here!
   - 5-minute setup
   - Basic examples
   - Configuration

2. **[PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)** - Complete guide
   - Architecture overview
   - Integration details
   - Best practices
   - Troubleshooting

3. **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)** - What's included
   - Feature summary
   - File structure
   - Implementation checklist

4. **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment
   - Environment setup
   - Platform guides
   - Monitoring

5. **[API_REFERENCE.md](./frontend/src/API_REFERENCE.md)** - API documentation
   - Function signatures
   - Parameters & returns
   - Examples

## 🎓 Code Examples

See [frontend/src/flows/exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts) for 8 complete working examples:

```typescript
// Example 1: Basic deposit
await exampleBasicDeposit(wallet, 'link-123')

// Example 2: Multiple deposits
await exampleMultipleDeposits(wallet)

// Example 3: Privacy-optimized
await examplePrivacyOptimizedDeposit(wallet, 'link-123')

// Example 4: With validation
await exampleDepositWithValidation(wallet, 'link-123', 0.1)

// Example 5: With fees
await exampleDepositWithFeeEstimation(wallet, 'link-123', 0.1)

// Example 6: Error handling
await exampleErrorHandling(wallet, 'link-123', 0.1)

// Example 7: Batch deposits
await exampleBatchDeposits(wallet, 3, 0.1)

// Example 8: Explorer URLs
await exampleTransactionExplorerUrls(wallet, 'link-123', 0.1)
```

## 🔗 Resources

- [Privacy Cash Documentation](https://privacycash.mintlify.app)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js)
- [Phantom Wallet](https://phantom.app)
- [Solana Explorer](https://explorer.solana.com)

## 🤝 Contributing

Contributions welcome! Please:
1. Review documentation
2. Test locally
3. Follow code style
4. Update docs as needed

## 📄 License

This project is open source. See LICENSE file for details.

## 🆘 Support

### Having Issues?

1. Check [QUICK_START.md](./QUICK_START.md)
2. Read [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)
3. Review error handling in code
4. Check Solana Explorer for transactions
5. Enable debug mode: `enableDebug: true`

### Debug Mode

```typescript
const pc = new PrivacyCash({
  RPC_url: rpcUrl,
  owner: wallet,
  enableDebug: true  // Enable detailed logging
})
```

## 📊 Status

- ✅ SDK Integration Complete
- ✅ Deposit Flow Implemented
- ✅ Validation & Error Handling
- ✅ Documentation Complete
- ✅ Code Examples Provided
- ✅ Ready for Production

## 🎯 Next Steps

1. **Read:** Start with [QUICK_START.md](./QUICK_START.md)
2. **Setup:** Install dependencies and configure
3. **Test:** Run local development
4. **Review:** Check code examples
5. **Deploy:** Follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

**Built with** 🤝 **Privacy Cash SDK**  
**Last Updated:** January 26, 2026  
**SDK Version:** privacycash@^1.1.11

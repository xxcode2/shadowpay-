# 📚 ShadowPay Documentation Index

## 🎯 Start Here

**New to ShadowPay & Privacy Cash SDK?**  
→ Read [QUICK_START.md](./QUICK_START.md) (5 minutes)

**Want to understand the integration?**  
→ Read [SDK_INTEGRATION_README.md](./SDK_INTEGRATION_README.md) (10 minutes)

**Ready to implement?**  
→ Check [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md) (detailed guide)

---

## 📖 Documentation Files

### 1. **[QUICK_START.md](./QUICK_START.md)** - START HERE ⭐
- 5-minute setup guide
- Prerequisites and installation
- Basic usage examples
- Common tasks
- Troubleshooting

### 2. **[SDK_INTEGRATION_README.md](./SDK_INTEGRATION_README.md)** - OVERVIEW
- Feature summary
- Integration structure
- Code examples
- Quick reference
- Resources

### 3. **[PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)** - COMPLETE GUIDE
- Architecture overview
- Frontend integration (detailed)
- Backend API documentation
- Zero-knowledge proof explanation
- Deposit consolidation details
- Fee structure
- Best practices (6 sections)
- Error handling guide
- Configuration instructions
- Testing procedures
- Troubleshooting (common issues)

### 4. **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)** - WHAT'S INCLUDED
- Complete file listing
- Feature checklist
- Quick reference
- File structure
- Implementation status
- Configuration guide
- TypeScript types

### 5. **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - PRODUCTION
- Pre-deployment checklist
- Environment variables
- Database setup
- Platform-specific guides:
  - Vercel (frontend)
  - Railway (backend)
  - Docker
- Deployment steps
- Monitoring & maintenance
- Scaling & optimization
- Troubleshooting
- Disaster recovery

### 6. **[frontend/src/API_REFERENCE.md](./frontend/src/API_REFERENCE.md)** - API DOCS
- Complete function signatures
- Parameter descriptions
- Return types
- Usage examples
- Error codes
- Backend endpoints
- Configuration reference
- TypeScript types

---

## 💻 Code Files

### Main Implementation
- [frontend/src/flows/depositFlow.ts](./frontend/src/flows/depositFlow.ts)
  - `executeRealDeposit()` - Execute deposits
  - `validateDepositRequest()` - Validate requests
  - Comprehensive error handling

### Utilities
- [frontend/src/utils/privacyCashUtils.ts](./frontend/src/utils/privacyCashUtils.ts)
  - `validateDepositAmount()` - Validate amounts
  - `validateSolanaAddress()` - Validate addresses
  - `formatLamportsToSOL()` - Format amounts
  - `parseSOLToLamports()` - Convert amounts
  - `initializePrivacyCashClient()` - Initialize SDK
  - `mapPrivacyCashError()` - Error mapping
  - `assessDepositPrivacy()` - Privacy assessment
  - `estimateTransactionFees()` - Fee estimation
  - `getExplorerUrl()` - Generate explorer URLs
  - And 3 more utility functions

### Examples
- [frontend/src/flows/exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts)
  1. `exampleBasicDeposit()` - Simple deposit
  2. `exampleMultipleDeposits()` - Multiple deposits
  3. `examplePrivacyOptimizedDeposit()` - Privacy best practices
  4. `exampleDepositWithValidation()` - Input validation
  5. `exampleDepositWithFeeEstimation()` - Fee breakdown
  6. `exampleErrorHandling()` - Error handling patterns
  7. `exampleBatchDeposits()` - Batch processing
  8. `exampleTransactionExplorerUrls()` - Explorer integration

### Backend
- [backend/src/routes/deposit.ts](./backend/src/routes/deposit.ts)
  - `POST /api/deposit` endpoint
  - Transaction recording
  - Database updates
  - Complete error handling

---

## 🗺️ Navigation Guide

### By User Type

#### 👨‍💻 **Developers**
1. [QUICK_START.md](./QUICK_START.md) - Setup & basics
2. [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md) - Implementation details
3. [frontend/src/API_REFERENCE.md](./frontend/src/API_REFERENCE.md) - API reference
4. [frontend/src/flows/exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts) - Code examples

#### 🚀 **DevOps/Deployment**
1. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Production guide
2. [QUICK_START.md](./QUICK_START.md) - Prerequisites section

#### 📊 **Project Managers**
1. [SDK_INTEGRATION_README.md](./SDK_INTEGRATION_README.md) - Overview
2. [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md) - Status & checklist

#### 🎓 **Learners**
1. [QUICK_START.md](./QUICK_START.md) - Start here
2. [SDK_INTEGRATION_README.md](./SDK_INTEGRATION_README.md) - Understand overview
3. [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md) - Deep dive

---

## 🎯 By Task

### I want to...

#### **Get started quickly**
→ [QUICK_START.md](./QUICK_START.md#installation)

#### **Understand the architecture**
→ [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#architecture)

#### **See code examples**
→ [frontend/src/flows/exampleIntegrations.ts](./frontend/src/flows/exampleIntegrations.ts)

#### **Find API reference**
→ [frontend/src/API_REFERENCE.md](./frontend/src/API_REFERENCE.md)

#### **Deploy to production**
→ [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

#### **Handle errors properly**
→ [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#error-handling-guide)

#### **Optimize for privacy**
→ [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#best-practices)

#### **Troubleshoot issues**
→ [QUICK_START.md](./QUICK_START.md#troubleshooting) or [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#troubleshooting)

#### **Estimate costs**
→ [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md#fees)

#### **Test the integration**
→ [QUICK_START.md](./QUICK_START.md#testing)

---

## 📋 Quick Reference

### Installation
```bash
pnpm install
cd frontend && npm run dev
cd backend && npm run dev
```
*See [QUICK_START.md](./QUICK_START.md) for details*

### Basic Usage
```typescript
const result = await executeRealDeposit({
  lamports: 100_000_000,
  wallet: phantomWallet,
  linkId: 'link-123'
})
```
*See [QUICK_START.md](./QUICK_START.md#basic-deposit-flow) for details*

### Deposit Limits
- Minimum: 0.001 SOL
- Recommended Max: 10 SOL
*See [QUICK_START.md](./QUICK_START.md#deposit-limits) for details*

### Fees
- Protocol: Free (0 SOL)
- Network: ~0.002 SOL
- Withdrawal: 0.006 SOL + 0.35%
*See [QUICK_START.md](./QUICK_START.md#common-tasks) for details*

### Environment Variables
```bash
VITE_BACKEND_URL=http://localhost:3000
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=KEY
```
*See [QUICK_START.md](./QUICK_START.md#configuration) for details*

---

## 🔍 Search by Topic

| Topic | Document | Section |
|-------|----------|---------|
| Getting Started | QUICK_START.md | Top |
| Architecture | PRIVACY_CASH_INTEGRATION.md | Architecture |
| Frontend Code | PRIVACY_CASH_INTEGRATION.md | Frontend Integration |
| Backend API | PRIVACY_CASH_INTEGRATION.md | Backend Integration |
| API Functions | API_REFERENCE.md | Deposit Functions |
| Error Handling | PRIVACY_CASH_INTEGRATION.md | Error Handling Guide |
| Best Practices | PRIVACY_CASH_INTEGRATION.md | Best Practices |
| Deposit Limits | QUICK_START.md | Deposit Limits |
| Fees | QUICK_START.md | Common Tasks |
| Privacy | PRIVACY_CASH_INTEGRATION.md | Zero-Knowledge Proof |
| Testing | QUICK_START.md | Testing |
| Troubleshooting | PRIVACY_CASH_INTEGRATION.md | Troubleshooting |
| Deployment | DEPLOYMENT_GUIDE.md | Top |
| Docker | DEPLOYMENT_GUIDE.md | Docker Deployment |
| Monitoring | DEPLOYMENT_GUIDE.md | Monitoring & Maintenance |
| Configuration | INTEGRATION_SUMMARY.md | Configuration |
| Database | DEPLOYMENT_GUIDE.md | Database Setup |

---

## 📊 Document Matrix

| Document | Length | Level | Purpose |
|----------|--------|-------|---------|
| QUICK_START.md | ~3KB | Beginner | Get up & running |
| SDK_INTEGRATION_README.md | ~4KB | Intermediate | Overview |
| PRIVACY_CASH_INTEGRATION.md | ~12KB | Advanced | Complete guide |
| INTEGRATION_SUMMARY.md | ~8KB | Intermediate | What's included |
| DEPLOYMENT_GUIDE.md | ~10KB | Advanced | Production |
| API_REFERENCE.md | ~6KB | Intermediate | API docs |

---

## 🎓 Learning Path

### Path 1: Quick Implementation (30 minutes)
1. [QUICK_START.md](./QUICK_START.md) - 5 min
2. Basic example - 10 min
3. Test locally - 15 min

### Path 2: Comprehensive Understanding (2 hours)
1. [SDK_INTEGRATION_README.md](./SDK_INTEGRATION_README.md) - 10 min
2. [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md) - 45 min
3. Code review - 30 min
4. Examples - 35 min

### Path 3: Full Implementation & Deployment (4 hours)
1. All above (2 hours)
2. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 60 min
3. Setup production environment - 60 min

---

## ✅ Checklist

### Before Starting
- [ ] Read QUICK_START.md
- [ ] Install dependencies
- [ ] Have wallet for testing

### Implementation
- [ ] Review API_REFERENCE.md
- [ ] Study code examples
- [ ] Implement deposit flow
- [ ] Test locally
- [ ] Handle errors properly

### Before Deployment
- [ ] Read DEPLOYMENT_GUIDE.md
- [ ] Set environment variables
- [ ] Configure database
- [ ] Run migrations
- [ ] Test on testnet
- [ ] Security review
- [ ] Performance check

---

## 🔗 External Resources

- [Privacy Cash SDK Docs](https://privacycash.mintlify.app)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js)
- [Phantom Wallet](https://phantom.app)
- [Solana Explorer](https://explorer.solana.com)
- [Helius RPC](https://www.helius.xyz)

---

## 📞 Support

**Questions? Try these resources:**

1. Check the relevant documentation file
2. Search for your topic in the matrix above
3. Review code examples
4. Check Solana Explorer for transactions
5. Enable debug mode in SDK

---

## 📝 File Sizes & Readability

| Document | Time to Read | Best For |
|----------|-------------|----------|
| QUICK_START.md | 10 min | First-time setup |
| SDK_INTEGRATION_README.md | 15 min | Understanding overview |
| PRIVACY_CASH_INTEGRATION.md | 30 min | Deep implementation |
| INTEGRATION_SUMMARY.md | 15 min | Status checks |
| DEPLOYMENT_GUIDE.md | 30 min | Production setup |
| API_REFERENCE.md | 20 min | Coding reference |

---

**Status**: ✅ Complete  
**Last Updated**: January 26, 2026  
**Total Documentation**: 6 guides + Code examples

Start with [QUICK_START.md](./QUICK_START.md) → Ready to build! 🚀

# ShadowPay Savings App - Quick Start (5 Minutes)

## What It Does

User bisa **tabung SOL/token di Privacy Cash** tanpa orang tahu mereka nabung.

```
User deposits 1 SOL
    ↓
Privacy Cash pool (encrypted, hanya user bisa decrypt)
    ↓
User bisa lihat "Private Balance: ≈ 1 SOL"
    ↓
User bisa send ke orang lain atau withdraw kapan saja
```

---

## Installation

Semua sudah built-in, cukup import SDK:

```typescript
import { depositToSavings, sendFromSavings } from '@/services/savingsSDK'
```

---

## 3 Main Features

### 1️⃣ **SAVE** - Deposit to Privacy Cash
```typescript
import { depositToSavings } from '@/services/savingsSDK'
import { useWallet } from '@solana/wallet-adapter-react'

export function SaveButton() {
  const wallet = useWallet()

  const handleSave = async () => {
    const result = await depositToSavings({
      amount: 0.01,          // 0.01 SOL
      assetType: 'SOL',
      wallet: {
        publicKey: wallet.publicKey!,
        signTransaction: wallet.signTransaction!,
        signAllTransactions: wallet.signAllTransactions!,
      },
    })

    console.log(`✅ Saved! TX: ${result.transactionHash}`)
    // Backend automatically records this
  }

  return <button onClick={handleSave}>💾 Save 0.01 SOL</button>
}
```

### 2️⃣ **SEND** - Send to Other Address (Private)
```typescript
import { sendFromSavings } from '@/services/savingsSDK'

export function SendButton() {
  const wallet = useWallet()

  const handleSend = async () => {
    const result = await sendFromSavings({
      amount: 0.01,
      assetType: 'SOL',
      recipientAddress: '9B5X...',
      wallet: {
        publicKey: wallet.publicKey!,
        signTransaction: wallet.signTransaction!,
        signAllTransactions: wallet.signAllTransactions!,
      },
      memo: 'Send to friend',
    })

    console.log(`✅ Sent! Recipient: ${result.recipient}`)
    // Recipient gets money, no one knows it came from your savings
  }

  return <button onClick={handleSend}>📤 Send 0.01 SOL</button>
}
```

### 3️⃣ **PROFILE** - See Dashboard
```typescript
import { getSavingsProfile } from '@/services/savingsSDK'

export function Dashboard() {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    getSavingsProfile(walletAddress).then(setProfile)
  }, [walletAddress])

  return (
    <div>
      <h2>💰 Your Savings</h2>
      <p>Total Saved: {(profile.totalDeposited / 1e9).toFixed(4)} SOL</p>
      <p>Current Balance: {(profile.currentBalance / 1e9).toFixed(4)} SOL</p>
      
      <h3>Recent Transactions</h3>
      {profile.transactions.map(tx => (
        <div key={tx.id}>
          {tx.type === 'deposit' ? '📥' : '📤'} {(tx.amount / 1e9).toFixed(4)} SOL
        </div>
      ))}
    </div>
  )
}
```

---

## Multi-Currency

Supported tokens (automatically):

```typescript
await depositToSavings({ amount: 0.01, assetType: 'SOL' })      // 0.01 SOL
await depositToSavings({ amount: 2, assetType: 'USDC' })        // 2 USDC
await depositToSavings({ amount: 2, assetType: 'USDT' })        // 2 USDT
await depositToSavings({ amount: 0.5, assetType: 'ZEC' })       // 0.5 ZEC
await depositToSavings({ amount: 100, assetType: 'ORE' })       // 100 ORE
await depositToSavings({ amount: 100, assetType: 'STORE' })     // 100 STORE
```

---

## Advanced: Auto-Deposit + Goals

### Auto-Deposit (Weekly)
```typescript
import { createAutoDeposit } from '@/services/savingsSDK'

await createAutoDeposit({
  walletAddress: userAddress,
  frequency: 'weekly',       // or 'daily', 'monthly'
  amount: 0.05,             // 0.05 SOL per week
  assetType: 'SOL',
})

// ⚠️ Wallet must have SOL for network fees
// If fails, user must manually retry
```

### Savings Goal
```typescript
import { createGoal } from '@/services/savingsSDK'

await createGoal({
  walletAddress: userAddress,
  name: 'Liburan ke Bali',
  targetAmount: 5,          // 5 SOL
  deadline: '2026-06-30',
  emoji: '🏖️',
  color: 'blue',
})

// Backend tracks progress automatically
```

---

## API Endpoints (If Calling Directly)

### Init Account
```
POST /api/savings/init
{ walletAddress, assetType }
```

### Get Profile
```
GET /api/savings/:walletAddress
```

### Record Deposit
```
POST /api/savings/:walletAddress/deposit
{ amount, assetType, transactionHash, memo }
```

### Record Send
```
POST /api/savings/:walletAddress/send
{ toAddress, amount, assetType, transactionHash, memo }
```

### Create Auto-Deposit
```
POST /api/savings/:walletAddress/auto-deposit
{ frequency, amount, assetType, enabled }
```

### Create Goal
```
POST /api/savings/:walletAddress/goals
{ name, targetAmount, deadline, emoji, color }
```

---

## Privacy Guarantee

What happens when user deposits 1 SOL:

```
1. User calls depositToSavings()
2. Frontend initializes Privacy Cash with user's wallet
3. Privacy Cash creates encrypted UTXO (only user can decrypt)
4. UTXO stored on-chain in Privacy Cash pool
5. Withdrawal TX hash sent to backend
6. Backend records TX hash + amount (for UX only)
7. Database has zero connection between user ↔ savings
```

Result:
- ✅ On-chain: No one sees user's wallet owns savings
- ✅ Backend: Only has TX hash, no keypair/encryption keys
- ✅ Frontend: User sees "≈ 1 SOL" (calculated locally)
- ✅ Privacy: Sender ↔ Recipient completely separate

---

## Error Handling

```typescript
try {
  await depositToSavings({...})
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    alert('Add more SOL to your wallet')
  } else if (error.message.includes('Invalid wallet')) {
    alert('Connect your wallet first')
  } else {
    alert('Failed: ' + error.message)
  }
}
```

---

## Testing Checklist

- [ ] User can deposit 0.01 SOL
- [ ] Backend records deposit transaction
- [ ] User can see profile with transaction history
- [ ] User can send 0.01 SOL to another address
- [ ] Recipient receives SOL (check balance)
- [ ] User can set up auto-deposit
- [ ] User can create savings goal
- [ ] Private balance shown correctly
- [ ] Multi-currency works (USDC, USDT, etc)
- [ ] Error handling works properly

---

## File Structure

```
/frontend
  /src
    /services
      savingsSDK.ts          ← Main SDK
      linkAPI.ts             ← Legacy (still works)
      privacyCashSDK.ts      ← Legacy (still works)

/backend
  /src
    /routes
      savings.ts             ← New savings endpoints
      link.ts                ← Legacy endpoints
  /prisma
    schema.prisma            ← Updated with Saving, SavingTransaction, etc
    /migrations
      999_add_savings_schema ← New migration
```

---

## Deploy

```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npm run build

# Frontend
cd frontend
npm install
npm run build

# Push to production
git push origin main
```

---

## Troubleshooting

### "Deposit failed: Need at least 1 unspent UTXO"
```
Solution: Wait a bit, deposit may still be processing
Or: Try smaller amount
```

### "No savings account found"
```
Solution: Call depositToSavings first (auto-initializes)
Or: Manually call POST /api/savings/init
```

### "Send failed: Invalid recipient address"
```
Solution: Check recipient address format
Must be valid Solana address (44 characters, base58)
```

### "Auto-deposit failed"
```
Solution: Add more SOL to wallet for network fees
Auto-deposits need ~0.002 SOL minimum
```

---

## Next Improvements

- [ ] UI components (ready to use)
- [ ] Monthly analytics
- [ ] Spending recommendations
- [ ] Mobile app
- [ ] Browser extension
- [ ] Yield generation
- [ ] Multi-wallet support

---

## Questions?

- Check SHADOWPAY_SAVINGS_GUIDE.md for full API docs
- Check backend/src/routes/savings.ts for implementation
- Check frontend/src/services/savingsSDK.ts for SDK source

**Summary:** ShadowPay Savings is ready to use. Just import `depositToSavings`, `sendFromSavings`, and you're good to go! 🚀

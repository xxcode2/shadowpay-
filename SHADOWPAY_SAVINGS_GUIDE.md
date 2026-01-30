# 💰 ShadowPay Savings App - Complete Implementation Guide

## Overview

ShadowPay adalah **Private Savings App** untuk Solana - user bisa menyimpan SOL & token lain di Privacy Cash pool tanpa orang bisa tahu:
- Berapa banyak dia nabung
- Dari mana uangnya berasal
- Kemana uangnya pergi

## Architecture

### Frontend Flow
```
User Action → SavingsSDK (frontend) → Privacy Cash pool
                     ↓
            Backend (record only) → Database
```

### Key Points
- **Frontend** = User menjalankan SDK deposit/withdraw dengan wallet mereka
- **Backend** = Hanya record transaksi di database, tidak pernah touch user's wallet
- **Privacy Cash Pool** = Encrypted UTXO hanya user bisa decrypt
- **Database** = Track history, balance, goals, auto-deposit settings

---

## Backend API Endpoints

### 1. Initialize Savings Account
```typescript
POST /api/savings/init
Body: {
  walletAddress: "Eys...",
  assetType: "SOL" // or "USDC", "USDT", etc
}

Response: {
  id: "savings_123",
  walletAddress: "Eys...",
  assetType: "SOL",
  totalDeposited: "0",
  totalWithdrawn: "0",
  currentBalance: "0"
}
```

### 2. Get Savings Profile
```typescript
GET /api/savings/:walletAddress

Response: {
  id: "savings_123",
  walletAddress: "Eys...",
  assetType: "SOL",
  totalDeposited: "1500000000",  // in lamports
  totalWithdrawn: "500000000",
  currentBalance: "1000000000",
  lastSyncedAt: "2026-01-30T10:00:00Z",
  transactions: [
    {
      id: "tx_1",
      type: "deposit",
      status: "confirmed",
      amount: "1000000000",
      assetType: "SOL",
      fromAddress: "Eys...",
      toAddress: null,
      transactionHash: "3Kb...",
      memo: "ShadowPay saving",
      createdAt: "2026-01-30T09:00:00Z"
    }
  ],
  autoDeposits: [
    {
      id: "auto_1",
      frequency: "weekly",
      amount: "100000000",
      assetType: "SOL",
      enabled: true,
      nextScheduledAt: "2026-02-06T00:00:00Z"
    }
  ],
  goals: [
    {
      id: "goal_1",
      name: "Liburan",
      targetAmount: "5000000000",
      currentAmount: "2500000000",
      deadline: "2026-06-30T00:00:00Z",
      progress: 50,
      status: "active",
      emoji: "🏖️",
      color: "blue"
    }
  ]
}
```

### 3. Record Deposit
```typescript
POST /api/savings/:walletAddress/deposit
Body: {
  amount: 1000000000,           // in lamports/base units
  assetType: "SOL",
  transactionHash: "3Kb...",
  memo: "ShadowPay saving"
}

Response: {
  transactionId: "tx_1",
  status: "recorded",
  amount: "1000000000",
  assetType: "SOL"
}
```

### 4. Record Send (Withdraw to Other Address)
```typescript
POST /api/savings/:walletAddress/send
Body: {
  toAddress: "9B5X...",          // recipient
  amount: 500000000,
  assetType: "SOL",
  transactionHash: "5Kc...",
  memo: "Send to friend"
}

Response: {
  transactionId: "tx_2",
  status: "recorded",
  to: "9B5X...",
  amount: "500000000",
  assetType: "SOL"
}
```

### 5. Record Withdraw (Unshield to Own Wallet)
```typescript
POST /api/savings/:walletAddress/withdraw
Body: {
  amount: 250000000,
  assetType: "SOL",
  transactionHash: "7Jf...",
  memo: "Unshield"
}

Response: {
  transactionId: "tx_3",
  status: "recorded",
  amount: "250000000",
  assetType: "SOL"
}
```

### 6. Create Auto-Deposit
```typescript
POST /api/savings/:walletAddress/auto-deposit
Body: {
  frequency: "weekly",    // "daily", "weekly", "monthly"
  amount: 100000000,
  assetType: "SOL",
  enabled: true
}

Response: {
  id: "auto_1",
  frequency: "weekly",
  amount: "100000000",
  assetType: "SOL",
  enabled: true,
  nextScheduledAt: "2026-02-06T00:00:00Z"
}
```

### 7. Create Savings Goal
```typescript
POST /api/savings/:walletAddress/goals
Body: {
  name: "Liburan",
  targetAmount: 5000000000,
  deadline: "2026-06-30",
  emoji: "🏖️",
  color: "blue"
}

Response: {
  id: "goal_1",
  name: "Liburan",
  targetAmount: "5000000000",
  deadline: "2026-06-30T00:00:00Z",
  emoji: "🏖️",
  color: "blue"
}
```

---

## Frontend SDK Usage

### Import
```typescript
import {
  depositToSavings,
  sendFromSavings,
  withdrawFromSavings,
  getPrivateBalance,
  getSavingsProfile,
  createAutoDeposit,
  createGoal,
  SUPPORTED_TOKENS,
} from '@/services/savingsSDK'
```

### 1. Deposit (Saving)
```typescript
const result = await depositToSavings({
  amount: 0.01,  // 0.01 SOL
  assetType: 'SOL',
  wallet: {
    publicKey: userWalletAddress,
    signTransaction: async (tx) => walletAdapter.signTransaction(tx),
    signAllTransactions: async (txs) => walletAdapter.signAllTransactions(txs),
  },
})

console.log(`✅ Saved! TX: ${result.transactionHash}`)
// Backend automatically records this
```

### 2. Send to Other Address
```typescript
const result = await sendFromSavings({
  amount: 0.005,  // Send 0.005 SOL
  assetType: 'SOL',
  recipientAddress: '9B5X...',
  wallet: userWalletAdapter,
  memo: 'Bayar utang',
})

console.log(`✅ Sent to ${result.recipient}`)
// Recipient doesn't know money came from your private savings!
```

### 3. Withdraw to Own Wallet
```typescript
const result = await withdrawFromSavings({
  amount: 0.002,
  assetType: 'SOL',
  wallet: userWalletAdapter,
  memo: 'Unshield',
})

console.log(`✅ Withdrawn! TX: ${result.transactionHash}`)
```

### 4. Check Private Balance
```typescript
const balance = await getPrivateBalance({
  assetType: 'SOL',
  wallet: userWalletAdapter,
})

console.log(`💰 Balance: ${balance.displayBalance}`)
// Output: "≈ 0.5234 SOL"
```

### 5. Get Savings Profile
```typescript
const profile = await getSavingsProfile(walletAddress)

console.log(`Total saved: ${profile.totalDeposited / 1e9} SOL`)
console.log(`Current balance: ${profile.currentBalance / 1e9} SOL`)
console.log(`Goals: ${profile.goals.length}`)
console.log(`Last transaction: ${profile.transactions[0]?.type}`)
```

### 6. Setup Auto-Deposit
```typescript
await createAutoDeposit({
  walletAddress: userWalletAddress,
  frequency: 'weekly',      // or 'daily', 'monthly'
  amount: 0.05,            // 0.05 SOL per week
  assetType: 'SOL',
})

console.log('✅ Auto-deposit setup! Will save every week.')
// ⚠️ If wallet empty, will fail & need manual retry
```

### 7. Create Savings Goal
```typescript
await createGoal({
  walletAddress: userWalletAddress,
  name: 'Liburan ke Bali',
  targetAmount: 5,        // 5 SOL
  deadline: '2026-06-30',
  emoji: '🏖️',
  color: 'blue',
})

console.log('✅ Goal created!')
```

---

## Supported Tokens

| Token | Decimals | Mint Address | Example |
|-------|----------|---|---|
| SOL | 9 | Native | `depositToSavings({ amount: 0.01, assetType: 'SOL' })` |
| USDC | 6 | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `depositToSavings({ amount: 2, assetType: 'USDC' })` |
| USDT | 6 | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | `depositToSavings({ amount: 2, assetType: 'USDT' })` |
| ZEC | 8 | `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS` | `depositToSavings({ amount: 0.5, assetType: 'ZEC' })` |
| ORE | 11 | `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp` | `depositToSavings({ amount: 100, assetType: 'ORE' })` |
| STORE | 11 | `sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH` | `depositToSavings({ amount: 100, assetType: 'STORE' })` |

---

## React Component Example

### Profile Dashboard
```typescript
import { useEffect, useState } from 'react'
import { getSavingsProfile, getPrivateBalance } from '@/services/savingsSDK'
import { useWallet } from '@solana/wallet-adapter-react'

export function SavingsDashboard() {
  const { publicKey } = useWallet()
  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!publicKey) return

    const load = async () => {
      try {
        const [prof, bal] = await Promise.all([
          getSavingsProfile(publicKey.toString()),
          getPrivateBalance({ assetType: 'SOL', wallet: {} as any }),
        ])
        setProfile(prof)
        setBalance(bal)
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [publicKey])

  if (loading) return <div>Loading...</div>
  if (!profile) return <div>No savings account</div>

  return (
    <div className="savings-dashboard">
      <div className="card">
        <h2>🔒 Private Balance</h2>
        <p className="balance">{balance?.displayBalance}</p>
      </div>

      <div className="stats">
        <div className="stat">
          <label>Total Saved</label>
          <value>{(profile.totalDeposited / 1e9).toFixed(4)} SOL</value>
        </div>
        <div className="stat">
          <label>Total Withdrawn</label>
          <value>{(profile.totalWithdrawn / 1e9).toFixed(4)} SOL</value>
        </div>
        <div className="stat">
          <label>Current Balance</label>
          <value>{(profile.currentBalance / 1e9).toFixed(4)} SOL</value>
        </div>
      </div>

      <div className="goals">
        <h3>🎯 Savings Goals</h3>
        {profile.goals.map(goal => (
          <div key={goal.id} className="goal">
            <div className="goal-header">
              <span>{goal.emoji} {goal.name}</span>
              <span>{goal.progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress" style={{ width: `${goal.progress}%` }}></div>
            </div>
            <p>{(Number(goal.currentAmount) / 1e9).toFixed(4)} / {(Number(goal.targetAmount) / 1e9).toFixed(4)} SOL</p>
          </div>
        ))}
      </div>

      <div className="transactions">
        <h3>📝 Recent Transactions</h3>
        {profile.transactions.slice(0, 5).map(tx => (
          <div key={tx.id} className={`tx tx-${tx.type}`}>
            <span>{tx.type === 'deposit' ? '📥' : tx.type === 'send' ? '📤' : '⬆️'}</span>
            <span>{tx.type}</span>
            <span>{(Number(tx.amount) / 1e9).toFixed(4)} {tx.assetType}</span>
            <span className="date">{new Date(tx.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Save Flow Component
```typescript
import { useState } from 'react'
import { depositToSavings, getPrivateBalance } from '@/services/savingsSDK'
import { useWallet } from '@solana/wallet-adapter-react'

export function SaveFlow() {
  const wallet = useWallet()
  const [amount, setAmount] = useState('0.01')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await depositToSavings({
        amount: parseFloat(amount),
        assetType: 'SOL',
        wallet: {
          publicKey: wallet.publicKey!,
          signTransaction: wallet.signTransaction!,
          signAllTransactions: wallet.signAllTransactions!,
        },
      })

      console.log(`✅ Saved! TX: ${result.transactionHash}`)
      setSuccess(true)
      setAmount('0.01')

      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Save failed:', error)
      alert('Failed to save: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="save-form">
      <h2>💰 Save to ShadowPay</h2>

      <div className="input-group">
        <label>Amount (SOL)</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
        />
      </div>

      <button onClick={handleSave} disabled={loading || !wallet.connected}>
        {loading ? 'Saving...' : '💾 Save to Private Pool'}
      </button>

      {success && <p className="success">✅ Saved successfully!</p>}
    </div>
  )
}
```

### Send Flow Component
```typescript
import { useState } from 'react'
import { sendFromSavings } from '@/services/savingsSDK'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'

export function SendFlow() {
  const wallet = useWallet()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('0.01')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSend = async () => {
    try {
      new PublicKey(recipient)
    } catch {
      alert('Invalid recipient address')
      return
    }

    setLoading(true)
    try {
      const result = await sendFromSavings({
        amount: parseFloat(amount),
        assetType: 'SOL',
        recipientAddress: recipient,
        wallet: {
          publicKey: wallet.publicKey!,
          signTransaction: wallet.signTransaction!,
          signAllTransactions: wallet.signAllTransactions!,
        },
        memo: 'Send from savings',
      })

      console.log(`✅ Sent to ${result.recipient}`)
      console.log(`TX: ${result.transactionHash}`)
      setSuccess(true)

      setTimeout(() => setSuccess(false), 3000)
      setRecipient('')
      setAmount('0.01')
    } catch (error) {
      console.error('Send failed:', error)
      alert('Failed to send: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="send-form">
      <h2>📤 Send from Savings</h2>

      <div className="input-group">
        <label>Recipient Address</label>
        <input
          type="text"
          placeholder="Enter wallet address..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="input-group">
        <label>Amount (SOL)</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
        />
      </div>

      <button onClick={handleSend} disabled={loading || !wallet.connected}>
        {loading ? 'Sending...' : '📤 Send'}
      </button>

      {success && <p className="success">✅ Sent successfully!</p>}
    </div>
  )
}
```

---

## Database Models

### Saving
```sql
CREATE TABLE "savings" (
  "id" TEXT PRIMARY KEY,
  "walletAddress" TEXT UNIQUE NOT NULL,
  "totalDeposited" BIGINT,          -- Total ever deposited
  "totalWithdrawn" BIGINT,          -- Total ever withdrawn
  "currentBalance" BIGINT,          -- Current private balance
  "assetType" TEXT,                 -- "SOL", "USDC", "USDT", etc
  "lastSyncedAt" TIMESTAMP,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
)
```

### SavingTransaction
```sql
CREATE TABLE "saving_transactions" (
  "id" TEXT PRIMARY KEY,
  "savingId" TEXT,                  -- Foreign key
  "type" TEXT,                      -- "deposit", "withdraw", "send"
  "status" TEXT,                    -- "pending", "confirmed", "failed"
  "amount" BIGINT,
  "assetType" TEXT,
  "fromAddress" TEXT,
  "toAddress" TEXT,
  "transactionHash" TEXT,
  "memo" TEXT,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
)
```

### AutoDeposit
```sql
CREATE TABLE "auto_deposits" (
  "id" TEXT PRIMARY KEY,
  "savingId" TEXT,                  -- Foreign key
  "frequency" TEXT,                 -- "daily", "weekly", "monthly"
  "amount" BIGINT,
  "assetType" TEXT,
  "enabled" BOOLEAN,
  "lastExecutedAt" TIMESTAMP,
  "nextScheduledAt" TIMESTAMP,
  "failureCount" INT,
  "lastFailureMsg" TEXT,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
}
```

### SavingGoal
```sql
CREATE TABLE "saving_goals" (
  "id" TEXT PRIMARY KEY,
  "savingId" TEXT,                  -- Foreign key
  "name" TEXT,                      -- "Liburan", "Laptop", etc
  "description" TEXT,
  "targetAmount" BIGINT,
  "currentAmount" BIGINT,
  "deadline" TIMESTAMP,
  "status" TEXT,                    -- "active", "completed", "abandoned"
  "emoji" TEXT,
  "color" TEXT,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
}
```

---

## Privacy Features

✅ **What's Hidden:**
- Deposit amounts (Privacy Cash encrypted UTXOs)
- Withdrawal amounts (ZK proofs)
- Wallet ↔ savings connection (no on-chain link)
- Transaction history (only in encrypted local storage)
- Balance (only user can decrypt)

✅ **What Backend Never Sees:**
- Actual UTXO details
- Encryption keys
- Private balance (calculated locally)
- User's private keypair

⚠️ **What Backend Records:**
- Transaction hashes (on-chain)
- Amounts (for UX only, not financial truth)
- Timestamps
- User's wallet address

---

## Limitations & Notes

1. **Auto-Deposit Requires Wallet Balance**
   - If wallet empty, auto-deposit fails
   - User must manually retry or add SOL to wallet

2. **Balance Sync**
   - Private balance calculated locally from encrypted UTXOs
   - Backend balance is estimate, not source of truth
   - Use `getPrivateBalance()` for accurate balance

3. **Fee Structure**
   - Privacy Cash has ~0.35% withdrawal fee
   - Add ~0.002 SOL for network fees
   - Calculate: `actualReceived = amount - (amount * 0.0035) - 0.002`

4. **Multi-Currency**
   - Each asset type is separate pool
   - Can't swap within app (use DEX first)
   - Goals can only track one asset type

---

## Troubleshooting

### Deposit fails: "Transaction version not supported"
```
Solution: Ensure RPC supports maxSupportedTransactionVersion: 0
```

### "No balance" error on withdraw
```
Solution: Must deposit first - there's nothing in pool to withdraw
```

### Auto-deposit fails repeatedly
```
Solution: Check wallet balance, needs enough SOL for network fees
```

### Can't find savings account
```
Solution: Call POST /api/savings/init first to create account
```

---

## Next Steps (v2)

- [ ] Monthly reports & analytics
- [ ] Spending recommendations
- [ ] Privacy score visualization
- [ ] Multi-goal dashboard
- [ ] Savings insurance/yield
- [ ] Mobile app
- [ ] Browser extension
- [ ] Recurring auto-withdraw


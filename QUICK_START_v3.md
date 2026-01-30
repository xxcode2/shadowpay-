# 🚀 QUICK START - ShadowPay v3.0

## For React Components

### Import the API
```typescript
import { 
  createPaymentLink, 
  getPaymentLink, 
  claimPaymentLink 
} from '@/services/linkAPI'
```

---

## CREATE LINK COMPONENT

```typescript
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { createPaymentLink } from '@/services/linkAPI'

export function CreateLink() {
  const wallet = useWallet()
  const [amount, setAmount] = useState('0.01')
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState<any>(null)

  const handleCreate = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert('Connect wallet first')
      return
    }

    setLoading(true)
    try {
      const result = await createPaymentLink({
        amount: parseFloat(amount),
        wallet: {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions || wallet.signTransaction,
        },
        memo: 'Payment via ShadowPay',
      })
      
      setLink(result)
      console.log(`Share: ${result.shareUrl}`)
    } catch (error) {
      console.error('Failed:', error)
      alert('Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input 
        type="number" 
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (SOL)"
      />
      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Create Link'}
      </button>
      
      {link && (
        <div>
          <p>Link created!</p>
          <input value={link.shareUrl} readOnly />
          <button onClick={() => navigator.clipboard.writeText(link.shareUrl)}>
            Copy Link
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## CLAIM LINK COMPONENT

```typescript
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useParams } from 'react-router-dom'
import { getPaymentLink, claimPaymentLink } from '@/services/linkAPI'

export function ClaimLink() {
  const wallet = useWallet()
  const { linkId } = useParams<{ linkId: string }>()
  const [link, setLink] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Load link on mount
  useEffect(() => {
    loadLink()
  }, [linkId])

  const loadLink = async () => {
    try {
      const linkData = await getPaymentLink(linkId!)
      setLink(linkData)
    } catch (error) {
      console.error('Link not found:', error)
      alert('Link not found')
    }
  }

  const handleClaim = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert('Connect wallet first')
      return
    }

    if (link.claimed) {
      alert('Link already claimed')
      return
    }

    setLoading(true)
    try {
      const result = await claimPaymentLink({
        linkId: linkId!,
        recipientWallet: {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions || wallet.signTransaction,
        },
      })
      
      setSuccess(true)
      console.log(`Received! TX: ${result.withdrawTx}`)
    } catch (error) {
      console.error('Failed:', error)
      alert('Failed to claim link')
    } finally {
      setLoading(false)
    }
  }

  if (!link) {
    return <div>Loading...</div>
  }

  if (link.claimed) {
    return <div>This link has already been claimed</div>
  }

  if (success) {
    return (
      <div>
        <h2>✅ Payment Received!</h2>
        <p>Amount: {link.amount} SOL</p>
        <p>Check your wallet for the funds</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Incoming Payment</h2>
      <p>Amount: <strong>{link.amount} SOL</strong></p>
      <p>From: Unknown user</p>
      
      {!wallet.connected ? (
        <p>Connect wallet to claim</p>
      ) : (
        <button onClick={handleClaim} disabled={loading}>
          {loading ? 'Claiming...' : 'Claim Payment'}
        </button>
      )}
    </div>
  )
}
```

---

## KEY POINTS

✅ **User connects their own wallet** - both creator and recipient
✅ **SDK runs in browser** - not on backend
✅ **Users pay their own fees** - no operator overhead
✅ **True non-custodial** - no middleman holding funds

---

## API RESPONSE FORMATS

### Create Link Response
```json
{
  "success": true,
  "linkId": "a1b2c3d4e5f6...",
  "amount": 0.01,
  "status": "active",
  "depositTx": "5Tx1234...",
  "shareUrl": "https://shadowpay.app/claim/a1b2c3d4e5f6..."
}
```

### Get Link Response
```json
{
  "linkId": "a1b2c3d4e5f6...",
  "amount": 0.01,
  "assetType": "SOL",
  "status": "active",
  "claimed": false,
  "claimedBy": null,
  "createdAt": "2025-02-27T10:00:00Z",
  "expiryAt": "2025-03-06T10:00:00Z"
}
```

### Claim Link Response
```json
{
  "success": true,
  "linkId": "a1b2c3d4e5f6...",
  "withdrawTx": "5Tx5678...",
  "recipient": "ABC123xyz...",
  "amount": 0.01,
  "status": "claimed"
}
```

---

## ERROR HANDLING

```typescript
try {
  await createPaymentLink({...})
} catch (error) {
  // Common errors:
  // - "Failed to load circuits" - circuits not found
  // - "Insufficient balance" - not enough SOL in wallet
  // - "Deposit failed" - Privacy Cash SDK error
  // - "Backend error: ..." - API returned error
  
  console.error(error.message)
}
```

---

## ENVIRONMENT VARIABLES

```bash
# Frontend (.env)
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_API_URL=http://localhost:5000
```

```bash
# Backend (.env)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
DATABASE_URL=postgresql://...
```

---

## 🎉 You're Ready!

The system is now:
- ✅ Non-custodial (users control wallets)
- ✅ Simple (SDK in browser, DB on backend)
- ✅ Secure (no operator key in frontend)
- ✅ Production-ready

Start building! 🚀

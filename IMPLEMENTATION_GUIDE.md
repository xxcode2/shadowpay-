# ShadowPay - Privacy Cash SDK Implementation Guide

## Overview

ShadowPay now uses the **official Privacy Cash SDK** for proper deposit and withdrawal handling. This guide explains the implementation and how to use it.

## Architecture

### Layer 1: Privacy Cash SDK Client Wrapper
**File**: `frontend/src/services/privacyCashClient.ts`

This is the thin wrapper around the official Privacy Cash SDK. It provides three main functions:

```typescript
// Deposit to Privacy Cash
async function depositToPrivacyCash(options: {
  lamports: number
  connection: Connection
  wallet: WalletAdapter
  onProgress?: (message: string) => void
}): Promise<{ tx: string, lamports: number }>

// Withdraw from Privacy Cash
async function withdrawFromPrivacyCash(options: {
  lamports: number
  recipientAddress?: string
  connection: Connection
  wallet: WalletAdapter
  onProgress?: (message: string) => void
}): Promise<{ tx: string, recipient: string, amount_in_lamports: number, fee_in_lamports: number, isPartial: boolean }>

// Get private balance
async function getPrivateBalance(
  connection: Connection,
  wallet: WalletAdapter
): Promise<number>  // Returns lamports
```

### Layer 2: Application Flows
These handle the application-specific logic on top of the Privacy Cash SDK:

#### Deposit Flow V2
**File**: `frontend/src/flows/depositFlowV2.ts`

Handles the complete deposit process:
1. Creates a link on the backend (for tracking)
2. Deposits to Privacy Cash using the official SDK
3. Records the deposit in the backend database

```typescript
async function executeDeposit(request: {
  linkId: string
  amount: string  // SOL amount
  publicKey: string
  recipientAddress?: string  // For send-to-user flows
  token?: string
}, wallet: any): Promise<string>  // Returns transaction signature
```

#### Withdrawal Flow V2
**File**: `frontend/src/flows/withdrawFlowV2.ts`

Handles the complete withdrawal process:
1. Checks private balance
2. Withdraws from Privacy Cash using the official SDK
3. Handles fee deduction automatically

```typescript
async function executeWithdraw(request: {
  walletAddress: string
  recipientAddress?: string  // Optional: withdraw to different address
  amount?: string  // Optional: specific amount to withdraw
}, wallet: any): Promise<WithdrawResult>
```

### Layer 3: UI Integration
**File**: `frontend/src/app.ts`

The main application class calls the flows:

```typescript
// For deposit
const depositTx = await executeDeposit({
  linkId,
  amount: amount.toString(),
  publicKey: walletAddress,
  recipientAddress: recipientAddress,  // For send-to-user
  token: 'SOL'
}, window.solana)

// For withdrawal
const result = await executeWithdraw({
  walletAddress: userWallet,
  recipientAddress: cleanWallet  // Optional
}, window.solana)
```

## Deposit Flow

### User deposits to themselves ("Create Link" tab)

```
1. User enters amount and clicks "Deposit"
2. Frontend creates link on backend
   POST /api/create-link -> { linkId }
3. Frontend calls Privacy Cash SDK to deposit
   - SDK generates ZK proof (30-60 sec)
   - User signs transaction
   - Relayer submits to Solana
4. Frontend records deposit in backend
   POST /api/deposit/record -> { success }
5. Funds are now in Privacy Cash pool
```

### User sends to another wallet ("Send to User" tab)

```
1. User enters recipient address and amount
2. Frontend creates link on backend
   POST /api/create-link -> { linkId }
3. Frontend deposits to recipient's encryption key
   - Recipient address passed to SDK
   - UTXO encrypted with recipient's key
   - Only recipient can decrypt and withdraw
4. Frontend records deposit with recipient tracking
   POST /api/deposit/record -> { success, toAddress: recipient }
5. Recipient's incoming payments list updated
```

## Withdrawal Flow

### Recipient withdraws from incoming payment

```
1. Recipient clicks "Withdraw" on incoming payment
2. Frontend checks private balance
   - Uses Privacy Cash SDK to decrypt UTXOs
   - Sums up unspent UTXO amounts
3. Frontend calls withdraw to recipient's wallet
   - SDK finds UTXOs encrypted with their key
   - Generates ZK proof
   - Applies withdrawal fees
   - User signs transaction
4. Funds transferred to recipient's wallet
   - Direct transfer, no backend involvement
5. Backend marks link as withdrawn
```

## Key Files Modified

### New Files
- `frontend/src/services/privacyCashClient.ts` - Official SDK wrapper
- `frontend/src/flows/depositFlowV2.ts` - Deposit logic
- `frontend/src/flows/withdrawFlowV2.ts` - Withdrawal logic

### Modified Files
- `frontend/src/app.ts` - Updated to use V2 flows
  - `handleSend()` - Calls executeDeposit
  - `handleSendToUser()` - Calls executeDeposit with recipient
  - `withdrawPayment()` - Calls executeWithdraw
- `backend/src/routes/deposit.ts` - Now accepts `recipientAddress` and stores as `toAddress`
- `frontend/src/flows/depositFlow.ts` - Now passes `recipientAddress` to backend

## Important Concepts

### Non-Custodial Deposits
The deposit happens **entirely on-chain**:
- ZK proof generated in browser
- User signs transaction in wallet
- Relayer submits directly to Solana
- Backend never sees private keys
- Backend only records for tracking

### Recipient-Bound UTXOs
When sending to a user:
```typescript
// Deposit is made with RECIPIENT's encryption key
await depositToPrivacyCash({
  lamports,
  connection,
  wallet: {
    publicKey: SENDER,  // Sender signs
    ...
  },
  recipientAddress: RECIPIENT  // But UTXO encrypted for recipient
})

// Only recipient can decrypt and withdraw
// Recipient must use their own wallet to decrypt
```

### Fee Handling
Withdrawal fees are automatic:
```typescript
const result = await withdrawFromPrivacyCash({
  lamports: 100_000_000,  // Requested amount
  // ...
})

console.log(result.amount_in_lamports)  // Amount AFTER fees
console.log(result.fee_in_lamports)     // Fee paid (base + protocol)
```

## Backend Integration

### Deposit Recording
When a deposit succeeds on-chain, the frontend records it:

```typescript
POST /api/deposit/record
{
  linkId: string
  amount: string
  lamports: number
  publicKey: string
  recipientAddress?: string  // NEW: For incoming payment tracking
  transactionHash: string
}
```

### Incoming Payments
Recipients can see incoming payments:

```typescript
GET /api/incoming/:walletAddress
// Returns transactions where toAddress = walletAddress
// Filtered by status='confirmed'
```

The `toAddress` field is now populated from `recipientAddress` during deposit.

## Testing

### Test Deposit
```
1. Open ShadowPay and connect wallet
2. Go to "Deposit" tab
3. Enter 0.01 SOL and click "Deposit"
4. Approve message signature
5. Approve transaction in Phantom
6. Wait for ZK proof (30-60 sec)
7. See success modal with transaction hash
```

### Test Send to User
```
1. Enter recipient wallet address
2. Enter 0.01 SOL
3. Click "Send to User"
4. Follow deposit process
5. Recipient connects their wallet
6. Recipient should see payment in "Receive" tab
7. Recipient clicks "Withdraw"
8. Funds appear in recipient's wallet
```

### Common Issues

**0 UTXOs Found During Withdrawal**
- Deposit was successful but UTXOs not yet indexed
- Wait 1-2 minutes and try again
- Check transaction on Solscan to confirm it executed

**"Link not found" Error**
- Fixed: Now create link on backend before depositing
- Deposit recording should succeed

**Missing Received Payments**
- Fixed: Now recording recipient address as `toAddress`
- Recipient's wallet should appear in incoming payments list

## Privacy Best Practices

### When Depositing
- Use round amounts (1 SOL, not 1.234567 SOL)
- Deposit amounts others also use (good anonymity set)

### When Withdrawing
- Always withdraw to a fresh, never-used wallet
- Wait at least 1 day between deposit and withdrawal
- Split large amounts into multiple withdrawals
- Don't withdraw the exact amount you deposited

## Error Handling

All flows have proper error handling:

```typescript
try {
  const result = await executeDeposit({ ... }, wallet)
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    // User doesn't have enough SOL
  } else if (error.message.includes('Deposit exceeds limit')) {
    // Deposit too large
  } else if (error.message.includes('Network error')) {
    // RPC connection issue
  }
}
```

## Next Steps

1. **Test locally** - Run deposit and withdrawal flows
2. **Monitor logs** - Check console for Privacy Cash SDK messages
3. **Deploy** - Update both frontend and backend
4. **Monitor balances** - Verify deposits appear in Privacy Cash
5. **User feedback** - Gather feedback on withdrawal experience

## Troubleshooting

If deposits work but withdrawals find 0 UTXOs:
1. Check Privacy Cash pool for deposited UTXOs
2. Verify encryption key derivation is consistent
3. Wait for Privacy Cash indexer to sync
4. Check transaction on Solscan to confirm execution

If "Link not found" appears:
1. Backend `/api/create-link` is being called
2. Link is created before deposit
3. Deposit recording should now succeed

## Documentation

- Official Privacy Cash SDK: https://docs.privacycash.org/sdk
- Solana Web3.js: https://solana-labs.github.io/solana-web3.js/
- ShadowPay Architecture: See ARCHITECTURE_CORRECTED.md and FLOW_CORRECTED.md

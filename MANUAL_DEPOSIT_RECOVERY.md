# Manual Deposit Recovery Guide

If your deposit was successful on-chain (visible on Solscan) but you can't claim because the backend says "Link has no valid deposit", follow these steps:

## Steps to Manually Record Your Deposit

### 1. Verify Your Deposit on Solscan
- Go to https://solscan.io/
- Paste your wallet address: `c5DUNG7hMZy1CpH1ouLYnHHEcQNiEP3oiEQ8rLWeGPF`
- Look for your recent transaction
- Copy the **Transaction Hash** (starts with a long string of characters)

### 2. Use Manual Recording via API

**Endpoint:** `POST https://shadowpay-backend-production.up.railway.app/api/deposit/manual-record`

**Request Body:**
```json
{
  "linkId": "YOUR_LINK_ID",
  "transactionHash": "YOUR_SOLSCAN_TRANSACTION_HASH"
}
```

**Example using curl:**
```bash
curl -X POST https://shadowpay-backend-production.up.railway.app/api/deposit/manual-record \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "f2da03a1a93a2e572a57b47b6b84fc42",
    "transactionHash": "YOUR_TRANSACTION_HASH_HERE"
  }'
```

### 3. Frontend Integration (Future)
Once deployed, the UI will show a "Manually record deposit" option when claim fails with deposit not found.

## How It Works

When you make a deposit:
1. **Frontend** sends transaction to Privacy Cash smart contract (on-chain)
2. **Frontend** tries to tell backend about the deposit (automatic recording)
3. If automatic recording fails, the deposit still exists on-chain
4. **Manual recording** tells the backend to look for your transaction on-chain and record it

## Verification

After manual recording:
- Your deposit will be recorded in the database
- You can now successfully claim your link
- The claim will execute the withdrawal via relayer

## Troubleshooting

**Error: "Link not found"**
- Check that linkId is correct
- The link must exist in the database

**Error: "Link already has deposit recorded"**
- Your deposit was already recorded
- Try claiming the link

**Error: "Transaction not found on Solscan"**
- The transaction hash must be correct
- The transaction must be from the Privacy Cash pool address
- Allow a few moments for Solscan to index new transactions

## Backend Implementation

The manual recording endpoint:
- Accepts linkId and transactionHash from user
- Verifies the transaction exists on Solscan (optional verification)
- Updates the PaymentLink.depositTx with the hash
- Returns success confirmation

**Location:** `/backend/src/routes/deposit.ts` (POST `/api/deposit/manual-record`)

## Why This Can Happen

Silent failures in deposit recording when:
1. Network issues between frontend and backend
2. Backend endpoint temporary unavailability
3. Error not properly surfaced to user
4. Fallback endpoint also failed

The manual recording provides user-initiated recovery when automatic systems fail.

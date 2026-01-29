# Operator Balance Issue

## Problem
Claim fails with error: "No enough balance to withdraw"

## Root Cause
The Privacy Cash SDK (relayer) needs SOL in the operator wallet to pay for:
1. Network transaction fees (rent, compute units, etc.)
2. Protocol fees deducted from the withdrawal amount

Current operator wallet balance: **0 SOL** (empty)

Operator address: `DRSt8H5t7zEy1znKYv3aWt88NDAAXvLicFvCHSZ1sKj3`

## Solution
Top-up the operator wallet with SOL:

```bash
# Send at least 0.1 SOL to operator wallet
solana transfer DRSt8H5t7zEy1znKYv3aWt88NDAAXvLicFvCHSZ1sKj3 0.1 --allow-unfunded-recipient
```

Or via web wallet:
1. Open Phantom or any Solana wallet
2. Send at least 0.1 SOL to: `DRSt8H5t7zEy1znKYv3aWt88NDAAXvLicFvCHSZ1sKj3`
3. Wait for confirmation
4. Retry claim

## How It Works

**Current Deposits:** 2 links with 0.01 SOL each = 0.02 SOL in Privacy Cash pool

**Withdrawal Process:**
1. User claims link
2. Relayer (operator) executes withdrawal transaction
3. Relayer extracts SOL from Privacy Cash pool
4. Relayer pays network fees (estimated 0.005 SOL per tx)
5. Relayer deducts protocol fee from amount
6. Recipient gets remainder

**Why Operator Needs Balance:**
- Privacy Cash SDK requires operator wallet to have balance
- Even though SOL comes from the pool, SDK checks operator balance as safety mechanism
- This is standard for any relayer-based withdrawal system

## Buffer Calculation

Required balance = withdrawal amount + network fees + safety buffer

For 0.01 SOL withdrawal:
- Withdrawal: 0.01 SOL
- Network fee: ~0.002 SOL
- Safety buffer: 0.02 SOL (production)
- **Total needed: ~0.032 SOL minimum**

Recommended: 0.1+ SOL to support multiple concurrent withdrawals

## Status Check

After topping up, verify balance:
```bash
curl -s https://api.mainnet-beta.solana.com -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["DRSt8H5t7zEy1znKYv3aWt88NDAAXvLicFvCHSZ1sKj3"]}' | \
  jq '.result.value / 1e9' # shows balance in SOL
```

Should show > 0.1

## After Top-up

1. Deposits are already recorded in backend
2. Links have valid depositTx
3. Just retry claim after operator wallet has funds

No code changes needed - this is an operational issue.

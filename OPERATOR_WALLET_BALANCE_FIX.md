# 🔧 Operator Wallet Balance Fix

## The Problem

When trying to create a deposit, you get this error:

```
500 Internal Server Error
Transfer: insufficient lamports 8634600, need 10000000
```

**Translation**: The operator wallet only has ~0.0086 SOL, but needs at least 0.01 SOL to generate the deposit proof.

## Why Does Operator Need SOL?

The Privacy Cash SDK requires the operator wallet to have a balance because:
1. **Proof Generation**: The SDK uses the operator's keypair to generate zero-knowledge proofs
2. **SDK Requirement**: This is a limitation of the Privacy Cash SDK itself, not our design
3. **Network Fees**: There are Solana network fees for the cryptographic operations

## The Solution: Fund the Operator Wallet

The operator wallet address is shown in the error response:

```json
{
  "error": "Operator wallet has insufficient SOL to process deposit",
  "operatorWallet": "9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX",
  "requiredAmount": "At least 0.01 SOL"
}
```

### Step 1: Get the Operator Wallet Address

```bash
# From the error message above, the operator wallet is:
9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX

# Or from your backend logs, look for:
# "📍 Operator wallet: <ADDRESS>"
```

### Step 2: Fund the Operator Wallet

**Option A: Using Solana CLI**
```bash
solana transfer 9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX 1 \
  --keypair ~/.config/solana/id.json
# This transfers 1 SOL to the operator wallet
```

**Option B: Using Web Wallet (Phantom)**
1. Open Phantom wallet
2. Click "Send"
3. Paste operator wallet address: `9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX`
4. Send 1 SOL (or more for multiple deposits)

**Option C: Using Solana Explorer**
1. Go to https://solscan.io/
2. Search for the operator wallet address
3. Use the "Send SOL" feature (if you're the owner)

### Step 3: Verify the Transfer

```bash
# Check the operator wallet balance:
solana balance 9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX
# Should show at least 1 SOL
```

### Step 4: Try the Deposit Again

After funding the operator wallet with SOL, the deposit should work:

1. Go back to ShadowPay frontend
2. Create a new payment link
3. Try the deposit again
4. Should work! ✅

## How Much SOL Does Operator Need?

For reference, here are approximate costs:

| Operation | SOL Needed |
|-----------|-----------|
| 1 deposit proof | 0.01 - 0.02 SOL |
| 100 deposits | 1 - 2 SOL |
| 1,000 deposits | 10 - 20 SOL |

**Recommendation**: Keep operator wallet funded with **at least 5-10 SOL** to handle multiple deposits without running out.

## Monitoring Operator Wallet Balance

### Check in Backend Logs

Look for lines like:
```
📍 Operator wallet: 9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX
```

Then check the balance on Solscan or with CLI:
```bash
solana balance 9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX
```

### Automated Monitoring

Consider adding a cron job to alert when balance is low:

```bash
#!/bin/bash
# check-operator-balance.sh

OPERATOR_WALLET="9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX"
MIN_BALANCE=1  # Alert if less than 1 SOL

BALANCE=$(solana balance "$OPERATOR_WALLET" | awk '{print $1}')

if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
  echo "⚠️  WARNING: Operator wallet balance is low: $BALANCE SOL"
  echo "Please fund operator wallet: $OPERATOR_WALLET"
  # Send alert email, Slack message, etc.
fi
```

## Important Notes

### User Still Pays Fees

Even though the **operator wallet needs SOL to generate the proof**, the **user still pays for their deposit**:

```
Flow:
1. User initiates 0.01 SOL deposit
2. Backend uses operator wallet to generate proof (~0.002 SOL cost)
3. User approves in Phantom
4. User's wallet pays the deposit (0.01 SOL) + network fees
5. Backend doesn't charge user extra for operator SOL
```

So the operator SOL is **only** for the proof generation, not for the user's deposit amount.

### On Mainnet vs Testnet

**Testnet (devnet)**: 
- SOL is free via faucet
- Operator can request free SOL: `solana airdrop 2 <OPERATOR_WALLET> --url devnet`

**Mainnet**:
- SOL costs real money
- Need to buy SOL or transfer from another wallet
- Consider the cost of deposits in your pricing model

## Troubleshooting

### Still Getting "Insufficient Balance" Error?

1. **Verify transfer went through**:
   ```bash
   solana balance 9CdPAz7MaQfryVvthB9dHX4ttcFtAAKeckMD5J7S3crX
   ```

2. **Check if transaction confirmed**:
   - Go to https://solscan.io/
   - Search for your transfer transaction
   - Look for "✅ Confirmed" status

3. **Wait for indexer to sync**:
   - Sometimes Solana RPC takes a minute to sync
   - Wait 1-2 minutes and try again

4. **Check RPC endpoint**:
   - Make sure you're using a reliable RPC endpoint
   - Helius, QuickNode, or Alchemy are good options
   - Check if RPC endpoint is rate limited

### Operator Wallet Shows in Error But I Don't Know the Private Key?

If you don't have the operator's private key and can't fund it:

1. **Check environment variable**:
   ```bash
   echo $OPERATOR_SECRET_KEY
   ```
   This should show the operator keypair (secret key)

2. **On Railway**:
   - Go to Railway dashboard
   - Find your backend service
   - Click "Variables"
   - Look for `OPERATOR_SECRET_KEY`
   - The public key is derived from this

3. **Generate new operator if needed**:
   ```bash
   node generate-operator-wallet.js
   # This will create a new operator keypair
   # Update OPERATOR_SECRET_KEY on Railway
   ```

## Cost Analysis

If running on mainnet, consider:

```
Monthly cost estimate for 1,000 deposits:
- Operator wallet fees: ~10-20 SOL
- User deposits: User pays their own fees
- Total backend cost: 10-20 SOL/month
```

Factor this into your pricing model or service costs.

## Resources

- [Solana Balance Command](https://docs.solana.com/cli/transfer-tokens)
- [Solscan Block Explorer](https://solscan.io/)
- [Phantom Wallet](https://phantom.app/)
- [Solana Web3.js Transfer](https://solana-labs.github.io/solana-web3.js/classes/SystemProgram.html#transfer)

## Summary

✅ **What to do**:
1. Get operator wallet address from error message
2. Fund it with at least 1 SOL
3. Retry the deposit
4. Monitor balance to prevent future issues

✅ **Remember**:
- Operator needs SOL for proof generation (SDK requirement)
- User still pays their own deposit amount + fees
- Keep operator wallet topped up
- Monitor balance regularly

---

**Status**: ✅ Fixed with better error messages
**Next Step**: Fund operator wallet and try deposit again
**Questions**: Check the logs for operator wallet address

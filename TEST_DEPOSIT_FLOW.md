## 🧪 Testing the Fixed Deposit Flow

### Prerequisites
- Phantom wallet installed with some SOL (minimum 0.02 SOL per test)
- Backend deployed and running
- Frontend deployed and running

### Test Flow

#### 1. Check Operator Wallet Balance (Should NOT decrease)
```bash
# Check before deposit
solana balance <OPERATOR_WALLET_ADDRESS>

# Should be: 0.00379164 SOL (or whatever it is)
```

#### 2. Check Your User Wallet Balance
In Phantom: Click wallet address, note your SOL balance
Example: 1.5 SOL

#### 3. Execute Deposit
1. Open ShadowPay frontend
2. Create or use a payment link
3. Click "Deposit 0.01 SOL"
4. Select Phantom wallet
5. **Phantom pops up asking you to sign**
6. Review transaction details
7. Click "Approve" to sign with your wallet
8. Frontend shows "Deposit successful"

#### 4. Verify Results

**Check 1: Your wallet SOL decreased**
- Open Phantom wallet
- Check balance - should be ~0.01 SOL less
- Example: 1.5 SOL → 1.49 SOL (approximately, accounting for fees)

**Check 2: Operator wallet unchanged**
```bash
solana balance <OPERATOR_WALLET_ADDRESS>
# Should still be: 0.00379164 SOL (UNCHANGED)
```

**Check 3: Transaction in database**
```bash
# SSH to backend
sqlite3 backend/prisma/dev.db

# Check transaction recorded
SELECT * FROM "Transaction" ORDER BY createdAt DESC LIMIT 1;

# Should show:
# - linkId: (your link)
# - type: deposit
# - publicKey: (your wallet address)
# - lamports: 10000000 (0.01 SOL)
# - status: confirmed
```

**Check 4: Link marked as deposited**
```bash
SELECT * FROM "PaymentLink" WHERE id = '<your_link_id>';

# Should show:
# - depositTx: (transaction signature from SDK)
```

### Expected Behavior Changes

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Operator wallet | Depletes | **Unchanged** |
| User wallet | Unchanged | **Decreases by deposit amount** |
| Who signs TX | Backend (operator) | **User (Phantom)** |
| Who pays | Operator | **User** |
| Phantom popup | Never appears | **Appears to sign** |
| Backend endpoint | Executes SDK | **Only relays** |

### Troubleshooting

**Error: "signedTransaction required"**
- Frontend didn't get signed transaction from SDK
- Check: Is Privacy Cash SDK imported correctly?
- Check: Does Phantom popup appear?

**Error: "Invalid publicKey format"**
- User address not formatted correctly
- Check: Copy-paste from Phantom (should start with "So...")

**Backend shows 502 but no error details**
- Check backend logs for "DEPOSIT FAILED"
- Ensure signedTransaction format is correct

**Operator wallet still decreasing**
- Old code still running - rebuild and redeploy
- Check: Is backend showing "📤 Relaying signed transaction" in logs?

### Success Indicators
✅ User's wallet SOL decreases
✅ Operator wallet unchanged
✅ Phantom signature popup appears
✅ Transaction recorded in database
✅ No errors in backend logs about operator balance
✅ Link marked as "depositTx" in database

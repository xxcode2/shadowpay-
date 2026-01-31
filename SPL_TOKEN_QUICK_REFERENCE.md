# ShadowPay SPL Token Support - Quick Reference 🚀

## What Changed?

✅ **You can now send USDC, USDT, and 4 other tokens privately!**

Previous: Only SOL
Now: SOL + USDC + USDT + ZEC + ORE + STORE

---

## For Users 👥

### How to Send a Different Token

1. Go to **"Send Private Payment"** tab
2. **New:** Click token dropdown (says "SOL" by default)
3. Select **USDC**, **USDT**, **ZEC**, **ORE**, or **STORE**
4. Enter amount (e.g., 10 for 10 USDC)
5. Enter recipient wallet address
6. Click "Send Private Payment"
7. ✅ Done! Recipient gets tokens privately

### Receive Any Token

- No changes needed!
- Receive tab automatically shows incoming tokens
- Withdraw button works for any token
- Privacy is maintained regardless of token

---

## For Developers 💻

### New Backend Endpoints

#### Deposit SPL Token
```bash
POST /api/deposit-spl

Request:
{
  "linkId": "payment-link-id",
  "amount": 10,  // Human-readable amount (10 USDC)
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // USDC
  "senderAddress": "wallet...",
  "recipientAddress": "wallet..."
}

Response:
{
  "success": true,
  "tx": "transaction_hash",
  "amount": 10,
  "token": "USDC"
}
```

#### Withdraw SPL Token
```bash
POST /api/withdraw-spl

Request:
{
  "linkId": "payment-link-id",
  "recipientAddress": "wallet...",
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  // USDC
}

Response:
{
  "success": true,
  "claimed": true,
  "withdrawn": true,
  "token": "USDC",
  "amount": 10,
  "withdrawalTx": "tx_hash"
}
```

### Token Mints (Copy-Paste Ready)

| Token | Mint Address |
|-------|-------------|
| **USDC** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| **USDT** | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| **ZEC** | `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS` |
| **ORE** | `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp` |
| **STORE** | `sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH` |

### Add a New Token

1. Open `backend/src/routes/depositSPL.ts`
2. Find `SUPPORTED_TOKENS` object
3. Add:
   ```typescript
   'MINT_ADDRESS': { name: 'TOKEN_NAME', decimals: 6 }
   ```
4. Repeat in `backend/src/routes/withdrawSPL.ts`
5. Update frontend dropdown in `frontend/index.html`

Example:
```typescript
'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { name: 'USDC', decimals: 6 },
'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { name: 'USDT', decimals: 6 },
```

---

## Technical Details 🔧

### What Stays the Same?

- ✅ All payments are non-custodial (Privacy Cash SDK handles)
- ✅ ZK proofs still generated for every transaction
- ✅ Recipient's wallet can't be linked to sender
- ✅ No intermediary access to funds
- ✅ SOL send/receive works exactly as before
- ✅ Pagination, history, everything else unchanged

### What's New?

- 📱 Token selector in Send tab (defaults to SOL)
- 🔄 Backend handles SPL token conversion (amount × 10^decimals)
- 📊 Database tracks tokenMint + tokenName
- 🚀 2 new API endpoints: /api/deposit-spl, /api/withdraw-spl

### Backward Compatibility

- All existing SOL payments continue working
- Database fields are nullable (no impact on old records)
- Frontend defaults to SOL
- No breaking changes to existing code

---

## Quick Tests 🧪

### Test USDC Send
```bash
curl -X POST http://localhost:3000/api/deposit-spl \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "test-123",
    "amount": 5,
    "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "senderAddress": "SENDER_WALLET",
    "recipientAddress": "RECIPIENT_WALLET"
  }'
```

### Test USDC Withdraw
```bash
curl -X POST http://localhost:3000/api/withdraw-spl \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "test-123",
    "recipientAddress": "RECIPIENT_WALLET",
    "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }'
```

---

## Decimal Handling ⚠️

**Important:** Each token has different decimals!

| Token | Decimals | Formula |
|-------|----------|---------|
| SOL | 9 | amount × 10^9 |
| USDC | 6 | amount × 10^6 |
| USDT | 6 | amount × 10^6 |
| ZEC | 8 | amount × 10^8 |
| ORE | 11 | amount × 10^11 |
| STORE | 11 | amount × 10^11 |

**Backend handles this automatically** - just send human-readable amounts!

---

## FAQ ❓

**Q: Can I send a token mix (e.g., send 1 SOL and 10 USDC)?**
A: Not yet. One payment = one token type. Create separate links for different tokens.

**Q: Do fees differ by token?**
A: Privacy Cash SDK calculates fees per token. Check SDK docs for fee structure.

**Q: What if I select wrong token?**
A: Double-check the dropdown - it shows which token is selected in the amount field.

**Q: Can I undo a send?**
A: No. Check recipient wallet address carefully before confirming!

**Q: Is this as private as SOL?**
A: Yes! All tokens use same Privacy Cash SDK and ZK proofs.

---

## Files Changed 📁

**Backend:**
- `backend/src/routes/depositSPL.ts` ✨ NEW
- `backend/src/routes/withdrawSPL.ts` ✨ NEW
- `backend/src/server.ts` (routes registered)
- `backend/prisma/schema.prisma` (tokenMint, tokenName fields)

**Frontend:**
- `frontend/index.html` (token selector)
- `frontend/src/app.ts` (token handling)

**Database:**
- `backend/prisma/migrations/add_spl_token_support/migration.sql` ✨ NEW

---

## Support 🆘

Issues or questions?
1. Check `/api/deposit-spl` response for error messages
2. Verify token mint address is correct
3. Ensure recipient wallet is valid Solana address
4. See SPL_TOKEN_SUPPORT.md for detailed docs

---

**🎉 Multi-token private payments are now live!** 🎉

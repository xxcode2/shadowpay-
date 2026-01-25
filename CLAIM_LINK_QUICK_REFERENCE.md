# Quick Reference: Claim Link Error Fixes

## Claim Flow - Now Fixed ✅

```
User has payment link → User clicks "Claim" → 
Backend validates everything → PrivacyCash executes → 
User gets funds ✅
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Deposit still processing" | `depositTx` is empty | Wait 1-2 minutes for deposit to confirm |
| "Already been claimed" | Link already claimed | Each link can only be claimed once |
| "Invalid wallet address" | Bad Solana address | Check wallet address format |
| "Link not found" | Wrong link ID | Double-check link ID |

## Testing Quick Commands

### Check Link Status
```bash
# Get full link status with deposit/claim info
curl https://api.shadowpay.app/api/link/YOUR_LINK_ID/status
```

### Response Shows:
```json
{
  "amount": 0.017,
  "amountReceived": 0.01093,
  "hasValidDeposit": true,
  "claimed": false,
  "feeBreakdown": {
    "baseFee": 0.006,
    "protocolFee": "0.00005950",
    "totalFees": "0.00605950"
  }
}
```

## Frontend Changes

✅ **Error handling now**:
1. Parses JSON error response
2. Maps to user-friendly message  
3. Falls back to text if not JSON

**Example**:
```
Backend: { error: "Link has no valid deposit" }
↓
Frontend shows: "Deposit still processing. Wait 1-2 minutes..."
```

## Backend Changes

✅ **Validation order**:
1. Check linkId format
2. Check recipientAddress format
3. Validate PublicKey format
4. Check link exists
5. Check depositTx exists
6. Check not already claimed
7. Execute PrivacyCash

## Testing Checklist

- [ ] Create link with 0.017 SOL
- [ ] Wait for deposit to confirm (check /status)
- [ ] Claim with valid wallet
- [ ] See withdrawal tx hash
- [ ] Try claiming again - should see "already been claimed"
- [ ] Try invalid address - should see "Invalid wallet address"

## Files Updated

| File | What Changed |
|------|--------------|
| `backend/src/routes/claimLink.ts` | Added comprehensive validation |
| `frontend/src/flows/claimLinkFlow.ts` | Added error response parsing |
| `backend/src/routes/link.ts` | Added `/status` endpoint |

---

✅ **Build**: SUCCESS  
✅ **Deployed**: YES  
✅ **Ready to Test**: YES

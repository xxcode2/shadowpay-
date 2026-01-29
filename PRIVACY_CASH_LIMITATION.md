# Privacy Cash SDK Limitation: Multi-Wallet Claiming

## The Problem

The current implementation hits a fundamental limitation of the Privacy Cash SDK regarding non-custodial encryption.

### What Happens Currently

1. **User A** creates a payment link and deposits SOL
   - Deposit uses **User A's wallet** via Phantom
   - SOL is transferred to Privacy Cash shielded pool
   - **Encryption keys are derived from User A's keypair** (stored in browser)
   - Backend records transaction but doesn't have User A's private key

2. **User B** tries to claim the link
   - Submits request to backend with their wallet address
   - Backend calls Privacy Cash SDK `withdraw()` function
   - SDK tries to decrypt the UTXO using **Backend's operator keypair**
   - ❌ **Decryption fails** because UTXO was encrypted with User A's keys
   - SDK finds UTXO but can't read the amount → `amount: "0"`
   - Withdrawal fails: "No enough balance to withdraw"

## Why This Happens

Privacy Cash SDK's design assumes:
```
DEPOSIT FLOW:
User A → signs with wallet A → keys derived from A
↓
UTXOs stored with A's encryption

WITHDRAW FLOW:
User A → same wallet A → can decrypt with A's keys
↓
Withdrawal succeeds
```

But our payment link system requires:
```
DEPOSIT FLOW:
User A → signs with wallet A → keys derived from A
↓
UTXOs stored with A's encryption

CLAIM FLOW:
User B (different from A) → different wallet B
↓
Cannot decrypt because B doesn't have A's encryption keys!
```

## The SDK Code

In `withdraw.ts`:
```typescript
// Line: Derive encryption key from caller's wallet
const utxoPrivateKey = encryptionService.deriveUtxoPrivateKey();

// This fails for Payment Link scenario because:
// - encryptionService was initialized with OPERATOR keys
// - But UTXO was encrypted with DEPOSITOR's keys
// - Decryption fails → amount = "0"
```

## The Solution

Three possible approaches:

### ❌ Option 1: Not Viable
Use depositor's private key at backend
- **Problem**: Violates non-custodial principle
- **Risk**: User's private key exposed to backend
- **Security**: Terrible

### ❌ Option 2: Not Viable  
Only allow same-wallet claims
- **Problem**: Defeats the purpose of payment links
- **Use case**: Cannot send money to someone else

### ✅ Option 3: The Right Way (Future Implementation)

**Modify deposit flow to pre-generate withdrawal proofs:**

1. At deposit time (User A's browser):
   - Generate withdrawal proof for **any recipient address**
   - This proof is recipient-agnostic (no specific public key baked in)
   - Store encrypted proof at backend

2. At claim time (User B's browser):
   - Fetch stored proof
   - Send to relayer
   - Relayer verifies proof and executes withdrawal

**This requires:**
- Modifying Privacy Cash SDK's withdrawal proof generation
- OR using lower-level Privacy Cash APIs (not `withdraw()`)
- Storing encrypted proofs in database

## Current Status

**Implemented**: ✅
- Deposit system (works perfectly)
- Amount extraction from on-chain transactions
- Operator balance checks
- All infrastructure ready

**Blocked by**: ❌
- Privacy Cash SDK design limitation
- Need to use lower-level APIs or pre-generate proofs
- Requires significant SDK integration changes

## Workaround for Now

Users can:
1. **Same-wallet claim**: Claim with the same wallet that deposited
   - This WILL work because encryption keys match
   
2. **Provide withdrawal key**: (Not recommended)
   - Export private key from wallet
   - Send to recipient
   - Recipient imports key temporarily to claim
   - ⚠️ Security risk!

## Links

- [Privacy Cash SDK Documentation](https://docs.privacycash.org)
- [Solana Privacy Architecture](https://solana.com/)

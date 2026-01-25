🧭 COPILOT SYSTEM PROMPT — SOLANA + PRIVACY CASH
═════════════════════════════════════════════════════════════════════

You are working on a Solana + Privacy Cash privacy-preserving payment application.
The architecture is FINAL and TESTED. Follow these constraints STRICTLY.

═════════════════════════════════════════════════════════════════════
🔒 CRITICAL CONSTRAINTS (VIOLATING = WRONG IMPLEMENTATION)
═════════════════════════════════════════════════════════════════════

1️⃣  DEPOSIT FLOW
  ✅ MUST run on FRONTEND
  ✅ MUST use USER wallet (Phantom) as owner
  ✅ MUST execute: new PrivacyCash({ owner: wallet }).deposit({ lamports })
  ✅ MUST return tx hash to backend for RECORD ONLY
  ❌ Backend NEVER executes PrivacyCash.deposit()
  ❌ Operator NEVER pays deposit amount

2️⃣  WITHDRAW FLOW
  ✅ MUST run on BACKEND
  ✅ MUST use OPERATOR wallet as RELAYER
  ✅ MUST execute: new PrivacyCash({ owner: operator }).withdraw({ lamports, recipientAddress })
  ✅ MUST check operator balance for FEE ONLY (0.01 SOL buffer)
  ❌ Operator NEVER pays withdrawal amount (PrivacyCash circuit does)
  ❌ Frontend NEVER calls PrivacyCash.withdraw()

3️⃣  BACKEND ENDPOINTS

  POST /api/create-link
    Input: { amount (SOL), assetType }
    Output: { linkId }
    Logic: Create metadata, NO PrivacyCash involved

  POST /api/deposit
    Input: { linkId, depositTx (from frontend) }
    Output: { success: true }
    Logic: RECORD ONLY — store tx hash in database
    ❌ NEVER execute PrivacyCash here

  POST /api/claim-link
    Input: { linkId, recipientAddress }
    Output: { success: true, withdrawTx }
    Logic: Execute REAL PrivacyCash.withdraw() as RELAYER
    ✅ Check operator fee balance
    ✅ Execute withdrawal on backend

4️⃣  OPERATOR BALANCE GUARD
  ✅ Always check: operator.balance ≥ (0.01 * LAMPORTS_PER_SOL) + FEE_ALLOWANCE
  ✅ This guards FEE payment only, NOT withdrawal amount
  ✅ Never check: operator.balance ≥ withdrawal amount
    (PrivacyCash circuit handles fund transfer, operator only pays fees)

5️⃣  DATA TYPES
  ✅ Frontend lamports: number (PrivacyCash SDK requirement)
  ✅ Backend lamports: BigInt (database precision, no rounding)
  ✅ Convert: Number(BigInt) for PrivacyCash, BigInt(number) for DB

6️⃣  ERROR HANDLING
  ❌ Never introduce demo mode or simulated transactions
  ❌ Never change architecture unless explicitly asked
  ❌ Never use operator wallet for user deposits
  ❌ Never call PrivacyCash from unexpected locations

═════════════════════════════════════════════════════════════════════
📋 DECISION TREE
═════════════════════════════════════════════════════════════════════

User asks to: "Add balance check"
  → Check: Is this for operator FEE only? (0.01 SOL)
  → YES: ✅ Add assertOperatorBalance(connection, operator, 0.01 * LAMPORTS_PER_SOL)
  → NO: ❌ STOP and explain why withdrawal amount check is wrong

User asks to: "Execute PrivacyCash deposit from backend"
  → ❌ STOP. PrivacyCash.deposit() MUST run on frontend with user wallet
  → Explain: "Operator cannot be owner of user's deposit"

User asks to: "Record deposit tx from frontend"
  → ✅ Backend /api/deposit endpoint
  → Input: { linkId, depositTx }
  → Logic: Update database, store tx hash
  → No PrivacyCash execution

User asks to: "Withdraw from link"
  → ✅ Backend /api/claim-link endpoint
  → Execute: PrivacyCash.withdraw() as operator RELAYER
  → Guard: Check operator has fee buffer only
  → Return: withdrawTx hash to frontend

User asks to: "Demo mode" or "simulated transactions"
  → ❌ STOP and explain: Architecture is REAL, no simulations needed

═════════════════════════════════════════════════════════════════════
✅ IMPLEMENTATION CHECKLIST (NEW CODE)
═════════════════════════════════════════════════════════════════════

When implementing new features, verify:

□ File location: Frontend flow? Backend route? Service? Clear separation
□ PrivacyCash calls: Only in /flows/ (frontend) or /routes/claimLink.ts (backend)
□ Wallet ownership: USER for deposit, OPERATOR for withdraw only
□ Balance guards: FEE safety only, never withdrawal amount
□ Error messages: Clear and actionable (not "something went wrong")
□ Type safety: BigInt ↔ number conversion validated
□ Atomicity: Prisma.$transaction for multi-step operations
□ Logging: Console.log with 🔥 (real) vs 🟡 (important) vs ✅ (success)

═════════════════════════════════════════════════════════════════════
📊 CURRENT STATE (AS OF LATEST COMMIT)
═════════════════════════════════════════════════════════════════════

Frontend:
  ✅ depositFlow.ts - REAL deposit with user wallet
  ✅ createLink.ts - Complete flow orchestrator
  ✅ claimLinkFlow.ts - Simplified claim (no signature needed)
  ✅ app.ts - Updated to new interfaces

Backend:
  ✅ deposit.ts - Record-only, no PrivacyCash
  ✅ claimLink.ts - Real withdrawal, operator relayer
  ✅ operatorBalanceGuard.ts - Fee-only checks
  ✅ ensureSchema.ts - Runtime schema sync

Build:
  ✅ Backend: npm run build (0 TypeScript errors)
  ✅ Frontend: npm run build (5.3 MB bundle, expected warnings)

═════════════════════════════════════════════════════════════════════
🚨 ANTI-PATTERNS (DO NOT IMPLEMENT THESE)
═════════════════════════════════════════════════════════════════════

❌ Simulated deposit: const simulatedTx = `sim_${Date.now()}`
   → User must execute REAL PrivacyCash.deposit()

❌ Backend deposit: await pc.deposit({ lamports })
   → Backend NEVER touches PrivacyCash.deposit()

❌ Operator drain: Check balance ≥ withdrawal amount
   → Only check balance ≥ 0.01 SOL (fee buffer)

❌ Wrong endpoint: POST /api/withdraw with withdrawal logic
   → Correct endpoint: POST /api/claim-link

❌ Type errors: Passing BigInt to PrivacyCash SDK
   → Convert: Number(lamports) before SDK calls

❌ Race conditions: Update link then create transaction separately
   → Use: prisma.$transaction([...]) for atomicity

═════════════════════════════════════════════════════════════════════
💬 IF UNSURE, ASK
═════════════════════════════════════════════════════════════════════

Questions to ask if request is ambiguous:
  • "Should this run on frontend or backend?"
  • "Is this related to operator balance or user deposit?"
  • "Does this need real PrivacyCash or just data recording?"
  • "Should I use atomicity (prisma.$transaction)?"
  • "Are we converting BigInt or number types correctly?"

DO NOT guess or introduce "quick fixes" that violate constraints.
Better to ask and clarify than to implement wrong.

═════════════════════════════════════════════════════════════════════
✨ THIS IS THE FINAL ARCHITECTURE ✨
═════════════════════════════════════════════════════════════════════

It has been:
  ✅ Tested against Solana mainnet constraints
  ✅ Verified with Privacy Cash SDK compatibility
  ✅ Reviewed for operator wallet safety
  ✅ Audited for atomicity and race conditions

Do NOT change it unless explicitly requested and well-justified.

═════════════════════════════════════════════════════════════════════

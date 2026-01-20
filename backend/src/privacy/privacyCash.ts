/**
 * BACKEND DOES NOT USE PRIVACY CASH SDK
 * 
 * Privacy Cash SDK is FRONTEND-ONLY library.
 * Backend only manages link metadata and routing.
 * 
 * Architecture:
 * Frontend: Uses Privacy Cash SDK directly (has user's wallet)
 * Backend: Simple metadata + link manager
 * Relayer: Privacy Cash network relayer (handles ZK & Merkle)
 */

/**
 * Backend does NOT initialize PrivacyCash
 * This is kept for reference/documentation only
 */

export const PRIVACY_CASH_NOTE = `
Privacy Cash SDK is designed for frontend use.
Backend role is to:
1. Accept /deposit requests (return linkId)
2. Validate link lookup requests
3. Store & manage payment link metadata

Actual Privacy Cash operations happen:
- Frontend: deposit() and withdraw() calls
- Relayer: executes ZK proofs and transactions
- Backend: just orchestrates link metadata
`;


import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * CRITICAL: Validate operator wallet is a CLEAN SOL account
 * 
 * Privacy Cash requires:
 * - No data associated with the account
 * - Must be a standard SOL account (not token account, PDA, etc)
 * - Sufficient balance for deposits + fees
 */
export async function validateOperatorAccount(
  connection: Connection,
  publicKey: PublicKey
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Get account info
    const accountInfo = await connection.getAccountInfo(publicKey)
    
    if (!accountInfo) {
      return { isValid: false, reason: 'Operator account does not exist on-chain' }
    }

    // ✅ CRITICAL CHECK: Account must have NO data
    if (accountInfo.data.length > 0) {
      return {
        isValid: false,
        reason: `Operator account has ${accountInfo.data.length} bytes of data. ` +
                `This account was used for tokens, programs, or other purposes. ` +
                `You MUST create a NEW wallet that has never been used before. ` +
                `Run: solana-keygen new --no-passphrase -o operator-key.json`
      }
    }

    // ✅ CHECK: Account must have sufficient balance
    const minRequired = 0.025 * LAMPORTS_PER_SOL
    if (accountInfo.lamports < minRequired) {
      return {
        isValid: false,
        reason: `Operator account balance too low: ${(accountInfo.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL. ` +
                `Need at least 0.025 SOL. Top up the account.`
      }
    }

    // ✅ All checks passed
    return { isValid: true }
  } catch (err) {
    return {
      isValid: false,
      reason: `Failed to validate operator account: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

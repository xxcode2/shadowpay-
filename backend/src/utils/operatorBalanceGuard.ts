import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * Safety buffer to keep in operator wallet (0.01 SOL)
 * This prevents wallet from being completely drained
 */
const SAFETY_BUFFER_LAMPORTS = 0.01 * LAMPORTS_PER_SOL

/**
 * Asserts that operator wallet has sufficient balance for a transaction.
 * Throws an Error if balance is insufficient, including required vs available amounts.
 *
 * @param connection - Solana RPC connection
 * @param operator - Operator wallet PublicKey
 * @param requiredLamports - Number of lamports needed for the transaction
 * @throws Error if balance is insufficient
 */
export async function assertOperatorBalance(
  connection: Connection,
  operator: PublicKey,
  requiredLamports: number
): Promise<void> {
  // Fetch current operator balance
  const balanceLamports = await connection.getBalance(operator)

  // Calculate total required (transaction amount + safety buffer)
  const totalRequiredLamports = requiredLamports + SAFETY_BUFFER_LAMPORTS

  // Check if balance is sufficient
  if (balanceLamports < totalRequiredLamports) {
    const requiredSOL = totalRequiredLamports / LAMPORTS_PER_SOL
    const availableSOL = balanceLamports / LAMPORTS_PER_SOL

    throw new Error(
      `Operator balance too low. Required: ${requiredSOL.toFixed(6)} SOL, Available: ${availableSOL.toFixed(6)} SOL`
    )
  }
}

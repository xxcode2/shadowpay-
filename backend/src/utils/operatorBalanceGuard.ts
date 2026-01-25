import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * STRICT: Validate operator wallet balance BEFORE deposit
 * Privacy Cash deposits involve significant fees
 */
export async function assertOperatorBalance(
  connection: Connection,
  operator: PublicKey,
  depositAmountLamports: number
): Promise<void> {
  const balanceLamports = await connection.getBalance(operator)
  
  // Fee calculation based on Privacy Cash docs + actual Solana costs
  const PRIVACY_CASH_BASE_FEE = 0.006 * LAMPORTS_PER_SOL      // From Privacy Cash docs
  const PRIVACY_CASH_PROTOCOL_FEE = Math.round(depositAmountLamports * 0.0035) // 0.35%
  const NETWORK_TX_FEE = 0.002 * LAMPORTS_PER_SOL             // Standard Solana tx
  const SAFETY_BUFFER = 0.005 * LAMPORTS_PER_SOL              // Realistic buffer for testing
  
  const totalRequired = 
    depositAmountLamports + 
    PRIVACY_CASH_BASE_FEE + 
    PRIVACY_CASH_PROTOCOL_FEE + 
    NETWORK_TX_FEE + 
    SAFETY_BUFFER

  if (balanceLamports < totalRequired) {
    const requiredSOL = totalRequired / LAMPORTS_PER_SOL
    const availableSOL = balanceLamports / LAMPORTS_PER_SOL
    const shortfallSOL = (totalRequired - balanceLamports) / LAMPORTS_PER_SOL
    
    console.error(`\n❌ OPERATOR BALANCE INSUFFICIENT`)
    console.error(`   Operator: ${operator.toString()}`)
    console.error(`   Available: ${availableSOL.toFixed(6)} SOL`)
    console.error(`   Required: ${requiredSOL.toFixed(6)} SOL`)
    console.error(`   Shortfall: ${shortfallSOL.toFixed(6)} SOL\n`)
    console.error(`Fee Breakdown:`)
    console.error(`   - Deposit amount: ${(depositAmountLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
    console.error(`   - Privacy Cash base fee: 0.006 SOL`)
    console.error(`   - Privacy Cash protocol fee (0.35%): ${(PRIVACY_CASH_PROTOCOL_FEE / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
    console.error(`   - Network tx fee: 0.002 SOL`)
    console.error(`   - Safety buffer: 0.005 SOL\n`)

    throw new Error(
      `Operator balance insufficient. Need ${requiredSOL.toFixed(6)} SOL, have ${availableSOL.toFixed(6)} SOL. ` +
      `Top up with at least ${shortfallSOL.toFixed(6)} SOL`
    )
  }

  console.log(`✅ Operator balance check passed`)
  console.log(`   Available: ${(balanceLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
  console.log(`   Required: ${(totalRequired / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
  console.log(`   Buffer: ${((balanceLamports - totalRequired) / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
}


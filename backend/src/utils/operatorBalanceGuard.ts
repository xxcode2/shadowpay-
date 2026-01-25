import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * ✅ CORRECT BALANCE CHECK: Only verify operator has enough for WITHDRAWAL FEES
 * 
 * Business model: Operator earns commission, doesn't subsidize payments!
 * - Sender deposits their own SOL (not operator's money)
 * - Operator only needs buffer for withdrawal transaction costs
 * - Operator earns 0.006 SOL fee per successful withdrawal
 * - System is sustainable and profitable!
 */
export async function assertOperatorBalance(
  connection: Connection,
  operator: PublicKey,
  requiredFeeLamports: number  // ONLY the fee amount needed
): Promise<void> {
  const balanceLamports = await connection.getBalance(operator)
  
  // ✅ Minimum buffer for withdrawal - operator only pays fees, not the deposit
  const MIN_WITHDRAWAL_BUFFER = requiredFeeLamports
  const SAFETY_MARGIN = 0.005 * LAMPORTS_PER_SOL  // Small safety margin
  
  const totalRequired = MIN_WITHDRAWAL_BUFFER + SAFETY_MARGIN

  if (balanceLamports < totalRequired) {
    const requiredSOL = totalRequired / LAMPORTS_PER_SOL
    const availableSOL = balanceLamports / LAMPORTS_PER_SOL
    const shortfallSOL = (totalRequired - balanceLamports) / LAMPORTS_PER_SOL
    
    console.error(`\n❌ OPERATOR BALANCE INSUFFICIENT FOR WITHDRAWAL FEES`)
    console.error(`   Operator: ${operator.toString()}`)
    console.error(`   Available: ${availableSOL.toFixed(6)} SOL`)
    console.error(`   Required (fees only): ${requiredSOL.toFixed(6)} SOL`)
    console.error(`   Shortfall: ${shortfallSOL.toFixed(6)} SOL\n`)
    console.error(`⚠️  NOTE: User pays the deposit amount - operator only pays withdrawal fees!\n`)

    throw new Error(
      `Operator balance insufficient for withdrawal fees. ` +
      `Need ${requiredSOL.toFixed(6)} SOL, have ${availableSOL.toFixed(6)} SOL. ` +
      `Top up with at least ${shortfallSOL.toFixed(6)} SOL`
    )
  }

  console.log(`✅ Operator balance check passed (withdrawal fees only)`)
  console.log(`   Available: ${(balanceLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
  console.log(`   Required: ${(totalRequired / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
  console.log(`   Buffer: ${((balanceLamports - totalRequired) / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
}


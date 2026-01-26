import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

/**
 * Dynamic safety buffer based on environment
 * Development: Minimal buffer for testing
 * Production: Conservative buffer for safety
 */
function getSafetyBuffer(): number {
  if (process.env.NODE_ENV === 'development') {
    return 0.005 * LAMPORTS_PER_SOL // 0.005 SOL untuk development
  } else {
    return 0.02 * LAMPORTS_PER_SOL // 0.02 SOL untuk production
  }
}

export async function assertOperatorBalance(
  connection: Connection,
  publicKey: PublicKey,
  requiredLamports: number
): Promise<void> {
  const balance = await connection.getBalance(publicKey)
  
  // Calculate realistic required amount
  const SAFETY_BUFFER = getSafetyBuffer()
  const totalRequired = requiredLamports + SAFETY_BUFFER

  if (balance < totalRequired) {
    const requiredSOL = totalRequired / LAMPORTS_PER_SOL
    const availableSOL = balance / LAMPORTS_PER_SOL
    const shortfallSOL = requiredSOL - availableSOL
    
    // Jika di development dan shortfall kecil, berikan warning saja
    if (process.env.NODE_ENV === 'development' && shortfallSOL < 0.001) {
      console.warn(`⚠️ [DEVELOPMENT] Operator balance slightly low: ${availableSOL.toFixed(6)} SOL available, ${requiredSOL.toFixed(6)} SOL required`)
      return
    }
    
    throw new Error(
      `Operator balance insufficient!\n` +
      `Required: ${requiredSOL.toFixed(6)} SOL\n` +
      `Available: ${availableSOL.toFixed(6)} SOL\n` +
      `Shortfall: ${shortfallSOL.toFixed(6)} SOL\n` +
      `Environment: ${process.env.NODE_ENV || 'production'}`
    )
  }
}


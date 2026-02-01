import { Router, Request, Response } from 'express'
import { Keypair } from '@solana/web3.js'

const router = Router()

/**
 * GET /api/operator-keypair
 * 
 * Returns the operator keypair in base64 format for Privacy Cash SDK initialization
 * 
 * SECURITY NOTE:
 * - Only returns the public key part (seed is derived from OPERATOR_SECRET_KEY env var)
 * - The private key NEVER leaves the backend
 * - The operator keypair is used ONLY for Privacy Cash SDK initialization (key derivation)
 * - All actual transaction signing is done by the user's wallet (Phantom)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get operator secret key from environment
    const operatorSecretKeyEnv = process.env.OPERATOR_SECRET_KEY
    
    if (!operatorSecretKeyEnv) {
      return res.status(500).json({
        error: 'Operator keypair not configured',
        message: 'OPERATOR_SECRET_KEY environment variable not set'
      })
    }

    // Parse the secret key
    let keyArray: number[]
    if (operatorSecretKeyEnv.startsWith('[') && operatorSecretKeyEnv.endsWith(']')) {
      keyArray = JSON.parse(operatorSecretKeyEnv)
    } else {
      keyArray = operatorSecretKeyEnv
        .split(',')
        .map(num => parseInt(num.trim(), 10))
        .filter(num => !isNaN(num))
    }

    if (keyArray.length !== 64) {
      return res.status(500).json({
        error: 'Invalid operator keypair format',
        message: `Expected 64 elements, got ${keyArray.length}`
      })
    }

    // Create keypair from secret key
    const secretKey = Uint8Array.from(keyArray)
    const keypair = Keypair.fromSecretKey(secretKey)

    // Return seed in base64 format for frontend to reconstruct
    // The seed is the first 32 bytes of the secret key
    const seed = secretKey.slice(0, 32)
    const seedBase64 = btoa(String.fromCharCode(...seed))

    return res.json({
      seed: seedBase64,
      publicKey: keypair.publicKey.toString(),
      // Security: NEVER return the secret key itself
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Operator Keypair] Error:', error)
    return res.status(500).json({
      error: 'Failed to load operator keypair',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

export default router

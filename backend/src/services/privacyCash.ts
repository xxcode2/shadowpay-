import { Keypair } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'

/**
 * ✅ PRIVACY CASH SDK SERVICE
 * 
 * Encapsulates PrivacyCash initialization and utilities
 * Supports multiple private key formats as per official docs
 * 
 * Docs: https://docs.privacycash.org/sdk/backend-integration
 */

/**
 * Parse operator keypair from various formats
 * 
 * Supports:
 * - Comma-separated byte array: "1,2,3,...,64"
 * - Base58 string: "5Jd7..."
 * - Uint8Array (from env parsing)
 */
export function parseOperatorKeypair(secretKeyInput: string): Keypair {
  if (!secretKeyInput) {
    throw new Error('OPERATOR_SECRET_KEY environment variable is required')
  }

  try {
    // Try parsing as comma-separated byte array (most common from key export)
    if (secretKeyInput.includes(',')) {
      const arr = secretKeyInput
        .replace(/^["'[\s]|["'\]\s]$/g, '') // Remove quotes, brackets, spaces
        .split(',')
        .map(x => parseInt(x.trim(), 10))

      if (arr.length !== 64) {
        throw new Error(`Invalid key: expected 64 bytes, got ${arr.length}`)
      }

      if (!arr.every(Number.isInteger) || arr.some(n => n < 0 || n > 255)) {
        throw new Error('Invalid byte values in key array')
      }

      return Keypair.fromSecretKey(new Uint8Array(arr))
    }

    // Try parsing as Base58 string
    if (secretKeyInput.length > 0 && !secretKeyInput.includes(',')) {
      return Keypair.fromSecretKey(new Uint8Array(Buffer.from(secretKeyInput, 'base58')))
    }

    throw new Error('Unable to parse operator secret key - unsupported format')
  } catch (err: any) {
    throw new Error(`Failed to parse OPERATOR_SECRET_KEY: ${err.message}`)
  }
}

/**
 * Initialize Privacy Cash SDK client
 * 
 * @param operatorKeypair - Parsed keypair for operator/relayer
 * @param rpcUrl - Solana RPC endpoint URL
 * @param programId - Optional Privacy Cash program address override
 * @returns PrivacyCash client instance
 */
export function initializePrivacyCash(
  operatorKeypair: Keypair,
  rpcUrl: string,
  programId?: string
): PrivacyCash {
  if (!rpcUrl) {
    throw new Error('SOLANA_RPC_URL environment variable is required')
  }

  // ✅ Basic validation that RPC URL looks valid
  if (!rpcUrl.includes('http')) {
    throw new Error('Invalid RPC URL - must be HTTP/HTTPS endpoint')
  }

  const config: any = {
    RPC_url: rpcUrl,
    owner: operatorKeypair,
    enableDebug: process.env.NODE_ENV === 'development',
  }

  // ✅ Optional: Override Privacy Cash program address
  if (programId) {
    const { PublicKey } = require('@solana/web3.js')
    config.programId = new PublicKey(programId)
  }

  try {
    return new PrivacyCash(config)
  } catch (err: any) {
    throw new Error(`Failed to initialize PrivacyCash: ${err.message}`)
  }
}

/**
 * Get initialized PrivacyCash client from environment
 * 
 * Uses environment variables:
 * - SOLANA_RPC_URL: Solana RPC endpoint
 * - OPERATOR_SECRET_KEY: Operator keypair (comma-separated bytes or base58)
 * - PRIVACY_CASH_PROGRAM: Optional program address override
 */
export function getPrivacyCashClient(): PrivacyCash {
  const rpcUrl = process.env.SOLANA_RPC_URL
  const operatorSecret = process.env.OPERATOR_SECRET_KEY
  const programId = process.env.PRIVACY_CASH_PROGRAM

  if (!rpcUrl || !operatorSecret) {
    throw new Error(
      'Missing required environment variables: SOLANA_RPC_URL, OPERATOR_SECRET_KEY'
    )
  }

  const keypair = parseOperatorKeypair(operatorSecret)
  return initializePrivacyCash(keypair, rpcUrl, programId)
}

/**
 * Example usage in routes:
 * 
 * ```typescript
 * import { getPrivacyCashClient } from '../services/privacyCash.js'
 * 
 * router.post('/api/claim-link', async (req, res) => {
 *   try {
 *     const pc = getPrivacyCashClient()
 *     
 *     const result = await pc.withdraw({
 *       lamports: 100_000_000,
 *       recipientAddress: 'RECIPIENT_ADDRESS'
 *     })
 *     
 *     res.json({ success: true, tx: result.tx })
 *   } catch (err) {
 *     res.status(500).json({ error: err.message })
 *   }
 * })
 * ```
 */

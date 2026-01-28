/**
 * Keypair Management for Solana Transactions
 * Handles Ed25519 keypairs for signing Privacy Cash deposits
 */

import { Keypair } from '@solana/web3.js'

/**
 * Generate a new random keypair
 */
export function generateKeypair(): Keypair {
  return Keypair.generate()
}

/**
 * Load keypair from environment variable (OPERATOR_SECRET_KEY)
 * Expected format: JSON array of 64 bytes [1,2,3,...,64]
 */
export function loadKeypairFromEnv(secretKeyJson?: string): Keypair {
  const envSecret = secretKeyJson || process.env.OPERATOR_SECRET_KEY

  if (!envSecret) {
    console.warn('OPERATOR_SECRET_KEY not set, generating temporary keypair')
    return generateKeypair()
  }

  try {
    const secretKeyArray = JSON.parse(envSecret)
    const secretKey = new Uint8Array(secretKeyArray)
    
    if (secretKey.length !== 64) {
      throw new Error(`Invalid secret key length: ${secretKey.length}. Expected 64 bytes.`)
    }

    const keypair = Keypair.fromSecretKey(secretKey)
    return keypair
  } catch (err) {
    console.error('Failed to parse OPERATOR_SECRET_KEY:', err)
    console.error('Expected format: JSON array of 64 bytes')
    throw err
  }
}

/**
 * Load keypair from seed (deterministic - same seed = same keypair)
 */
export function loadKeypairFromSeed(seed: Uint8Array): Keypair {
  if (seed.length !== 32) {
    throw new Error(`Invalid seed length: ${seed.length}. Expected 32 bytes.`)
  }

  return Keypair.fromSecretKey(seed)
}

/**
 * Get public key as base58 string
 */
export function getPublicKeyBase58(keypair: Keypair): string {
  return keypair.publicKey.toBase58()
}

/**
 * Export keypair to JSON (for backup/export)
 * Returns: JSON string representation of secret key
 */
export function exportKeypair(keypair: Keypair): string {
  return JSON.stringify(Array.from(keypair.secretKey))
}

/**
 * Import keypair from JSON export
 */
export function importKeypair(json: string): Keypair {
  try {
    const secretKeyArray = JSON.parse(json)
    const secretKey = new Uint8Array(secretKeyArray)

    if (secretKey.length !== 64) {
      throw new Error(`Invalid secret key length: ${secretKey.length}. Expected 64 bytes.`)
    }

    return Keypair.fromSecretKey(secretKey)
  } catch (err) {
    console.error('Failed to import keypair from JSON:', err)
    throw err
  }
}

/**
 * Verify keypair is valid
 */
export function isValidKeypair(keypair: Keypair): boolean {
  try {
    const publicKeyBase58 = keypair.publicKey.toBase58()
    return publicKeyBase58.length > 0 && publicKeyBase58.startsWith('So') || publicKeyBase58[0] !== '1'
  } catch {
    return false
  }
}

/**
 * Get keypair info (for debugging)
 */
export function getKeypairInfo(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey.toBase58(),
    publicKeyHex: keypair.publicKey.toBuffer().toString('hex'),
    secretKeyLength: keypair.secretKey.length,
  }
}

/**
 * Relayer/Operator configuration
 */
export const OPERATOR_CONFIG = {
  // Minimum balance required for operator wallet (in lamports = SOL * 1e9)
  MIN_BALANCE_LAMPORTS: 10_000_000, // 0.01 SOL

  // Estimated transaction fee (in lamports)
  ESTIMATED_TX_FEE_LAMPORTS: 5_000,

  // Maximum number of concurrent transactions
  MAX_CONCURRENT_TXS: 10,

  // Transaction timeout in milliseconds
  TX_TIMEOUT_MS: 30_000,

  // Rate limit: max deposit requests per minute per IP
  RATE_LIMIT_PER_MINUTE: 20,
}

/**
 * Validate operator has sufficient balance
 * @param balanceLamports Current balance in lamports
 * @returns true if balance is sufficient
 */
export function validateOperatorBalance(balanceLamports: number): boolean {
  return balanceLamports >= OPERATOR_CONFIG.MIN_BALANCE_LAMPORTS
}

/**
 * Calculate if transaction will succeed based on balance
 * @param balanceLamports Current balance in lamports
 * @param estimatedFeeLamports Estimated fee for transaction
 * @returns true if there's enough balance for the transaction
 */
export function canAffordTransaction(
  balanceLamports: number,
  estimatedFeeLamports: number = OPERATOR_CONFIG.ESTIMATED_TX_FEE_LAMPORTS
): boolean {
  return balanceLamports >= estimatedFeeLamports + OPERATOR_CONFIG.MIN_BALANCE_LAMPORTS
}

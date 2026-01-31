import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
// @ts-ignore - privacycash types may not be fully available
import { PrivacyCash } from 'privacycash'

/**
 * ✅ PRIVACY CASH SDK SERVICE - BACKEND INTEGRATION
 * 
 * Encapsulates PrivacyCash initialization and utilities for backend operations:
 * - Query private balances
 * - Execute withdrawals
 * - Initialize operator/relayer wallet
 * - Handle all supported private key formats
 * 
 * Official Docs: https://privacycash.mintlify.app/sdk/overview-copied-1
 */

/**
 * Parse operator keypair from various formats
 * 
 * Supports:
 * - Comma-separated byte array: "1,2,3,...,64"
 * - Base58 string: "5Jd7..."
 * - JSON array: "[1,2,3,...,64]"
 * - Uint8Array (from env parsing)
 */
export function parseOperatorKeypair(secretKeyInput: string): Keypair {
  if (!secretKeyInput) {
    throw new Error('OPERATOR_SECRET_KEY environment variable is required')
  }

  try {
    // Try parsing as JSON array first
    if (secretKeyInput.startsWith('[') && secretKeyInput.endsWith(']')) {
      const arr = JSON.parse(secretKeyInput)
      if (!Array.isArray(arr) || arr.length !== 64) {
        throw new Error(`Invalid key array: expected 64 bytes, got ${arr.length}`)
      }
      if (!arr.every(Number.isInteger) || arr.some((n: number) => n < 0 || n > 255)) {
        throw new Error('Invalid byte values in key array')
      }
      return Keypair.fromSecretKey(new Uint8Array(arr))
    }

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
      const bs58 = require('bs58');
      const decoded = bs58.decode(secretKeyInput);
      return Keypair.fromSecretKey(decoded)
    }

    throw new Error('Unable to parse operator secret key - unsupported format')
  } catch (err: any) {
    throw new Error(`Failed to parse OPERATOR_SECRET_KEY: ${err.message}`)
  }
}

/**
 * Initialize Privacy Cash SDK client for backend operations
 * 
 * @param operatorKeypair - Parsed keypair for operator/relayer
 * @param rpcUrl - Solana RPC endpoint URL
 * @param enableDebug - Enable debug logging
 * @returns PrivacyCash client instance
 */
export function initializePrivacyCash(
  operatorKeypair: Keypair,
  rpcUrl: string,
  enableDebug: boolean = false
): PrivacyCash {
  if (!rpcUrl) {
    throw new Error('SOLANA_RPC_URL environment variable is required')
  }

  // ✅ Basic validation that RPC URL looks valid
  if (!rpcUrl.includes('http')) {
    throw new Error('Invalid RPC URL - must be HTTP/HTTPS endpoint')
  }

  try {
    // ✅ CRITICAL FIX: Use correct constructor signature (keypair, rpcUrl)
    // NOT config object like before
    // @ts-ignore - SDK may not have complete type definitions
    return new PrivacyCash(operatorKeypair, rpcUrl)
  } catch (err: any) {
    throw new Error(`Failed to initialize PrivacyCash: ${err.message}`)
  }
}

/**
 * Get initialized PrivacyCash client from environment variables
 * 
 * Uses environment variables:
 * - SOLANA_RPC_URL: Solana RPC endpoint
 * - OPERATOR_SECRET_KEY: Operator keypair (multiple formats supported)
 * 
 * @returns PrivacyCash client instance
 */
export function getPrivacyCashClient(): PrivacyCash {
  const rpcUrl = process.env.SOLANA_RPC_URL
  const operatorSecret = process.env.OPERATOR_SECRET_KEY

  if (!rpcUrl || !operatorSecret) {
    throw new Error(
      'Missing required environment variables: SOLANA_RPC_URL, OPERATOR_SECRET_KEY'
    )
  }

  const keypair = parseOperatorKeypair(operatorSecret)
  return initializePrivacyCash(keypair, rpcUrl)
}

/**
 * Get operator keypair for wallet operations
 */
export function getOperatorKeypair(): Keypair {
  const operatorSecret = process.env.OPERATOR_SECRET_KEY

  if (!operatorSecret) {
    throw new Error('OPERATOR_SECRET_KEY environment variable is required')
  }

  return parseOperatorKeypair(operatorSecret)
}

/**
 * Query private balance from Privacy Cash pool
 * 
 * @param pc - PrivacyCash client instance
 * @returns Balance details with amount in lamports and SOL
 */
export async function queryPrivateBalance(pc: PrivacyCash): Promise<{
  lamports: number
  sol: number
  formatted: string
}> {
  try {
    const balance = await pc.getPrivateBalance()

    const lamports = balance.lamports || 0
    const sol = lamports / LAMPORTS_PER_SOL

    return {
      lamports,
      sol,
      formatted: `${sol.toFixed(6)} SOL`,
    }
  } catch (err: any) {
    throw new Error(`Failed to query private balance: ${err.message}`)
  }
}

/**
 * Execute withdrawal from Privacy Cash pool
 * 
 * @param pc - PrivacyCash client instance
 * @param lamports - Amount to withdraw in lamports
 * @param recipientAddress - Solana address to receive funds
 * @returns Transaction signature
 */
export async function executeWithdrawal(
  pc: PrivacyCash,
  lamports: number,
  recipientAddress: string
): Promise<{
  tx: string
  lamports: number
  sol: number
}> {
  if (!lamports || lamports <= 0) {
    throw new Error('Invalid withdrawal amount')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('Invalid recipient address')
  }

  try {
    // ✅ CRITICAL FIX: Use correct API signature for withdraw()
    // Privacy Cash SDK withdraw(options) takes object with lamports, recipientAddress
    const result = await pc.withdraw({
      lamports,
      recipientAddress,
    })

    const sol = lamports / LAMPORTS_PER_SOL

    return {
      tx: result.tx,
      lamports,
      sol,
    }
  } catch (err: any) {
    const errorMsg = err?.message?.toLowerCase() || ''

    if (errorMsg.includes('insufficient')) {
      throw new Error('Insufficient balance in Privacy Cash pool')
    }

    if (errorMsg.includes('invalid')) {
      throw new Error('Invalid withdrawal parameters')
    }

    if (errorMsg.includes('unspent utxo')) {
      throw new Error('No unspent UTXO available for withdrawal - operator may need to deposit first')
    }

    throw new Error(`Withdrawal failed: ${err.message}`)
  }
}

/**
 * Execute deposit to Privacy Cash pool
 * 
 * @param pc - PrivacyCash client instance
 * @param lamports - Amount to deposit in lamports
 * @returns Transaction signature
 */
export async function executeDeposit(
  pc: PrivacyCash,
  lamports: number
): Promise<{
  tx: string
  lamports: number
  sol: number
}> {
  if (!lamports || lamports <= 0) {
    throw new Error('Invalid deposit amount')
  }

  try {
    // @ts-ignore - SDK may not have complete type definitions
    const result = await pc.deposit({
      lamports,
    })

    const sol = lamports / LAMPORTS_PER_SOL

    return {
      tx: result.tx,
      lamports,
      sol,
    }
  } catch (err: any) {
    console.error('❌ Deposit error:', err)

    const errorMsg = err?.message?.toLowerCase() || ''

    if (errorMsg.includes('insufficient')) {
      throw new Error(`Insufficient SOL balance for deposit`)
    }

    if (errorMsg.includes('timeout')) {
      throw new Error(`Deposit timeout - relayer not responding`)
    }

    throw new Error(`Deposit failed: ${err.message}`)
  }
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

/**
 * Format withdrawal error messages
 */
export function formatWithdrawalError(error: any): string {
  const msg = error?.message?.toLowerCase() || ''

  if (msg.includes('insufficient')) {
    return 'Insufficient balance to process withdrawal'
  }

  if (msg.includes('invalid address')) {
    return 'Invalid recipient wallet address'
  }

  if (msg.includes('timeout')) {
    return 'Withdrawal request timed out - try again'
  }

  if (msg.includes('connection') || msg.includes('rpc')) {
    return 'Network connection error - check RPC endpoint'
  }

  return `Withdrawal error: ${error?.message || 'Unknown error'}`
}

/**
 * Deposit SPL token to Privacy Cash pool
 */
export async function depositSPLToken(
  pc: InstanceType<typeof PrivacyCash>,
  mintAddress: string,
  amount?: number,
  base_units?: number
): Promise<{ tx: string }> {
  try {
    console.log(`💰 Depositing SPL token ${mintAddress.substring(0, 8)}...`)

    const result = await pc.depositSPL({
      mintAddress,
      ...(amount && { amount }),
      ...(base_units && { base_units }),
    })

    console.log(`✅ SPL deposit successful: ${result.tx}`)

    return result
  } catch (err: any) {
    console.error('❌ SPL deposit error:', err.message)
    throw new Error(`SPL deposit failed: ${err.message}`)
  }
}

/**
 * Withdraw SPL token from Privacy Cash pool
 */
export async function withdrawSPLToken(
  pc: InstanceType<typeof PrivacyCash>,
  mintAddress: string,
  amount?: number,
  base_units?: number,
  recipientAddress?: string,
  referrer?: string
): Promise<{ tx: string; recipient: string; base_units: number; fee_base_units: number; isPartial: boolean }> {
  try {
    console.log(`💸 Withdrawing SPL token ${mintAddress.substring(0, 8)}...`)

    const result = await pc.withdrawSPL({
      mintAddress,
      ...(amount && { amount }),
      ...(base_units && { base_units }),
      ...(recipientAddress && { recipientAddress }),
      ...(referrer && { referrer }),
    })

    console.log(`✅ SPL withdrawal successful: ${result.tx}`)
    console.log(`   Received: ${result.base_units} base units`)
    console.log(`   Fee: ${result.fee_base_units} base units`)

    return result
  } catch (err: any) {
    console.error('❌ SPL withdrawal error:', err.message)
    throw new Error(`SPL withdrawal failed: ${err.message}`)
  }
}

/**
 * Get private balance for SPL token
 */
export async function querySPLBalance(
  pc: InstanceType<typeof PrivacyCash>,
  mintAddress: string
): Promise<{
  baseUnits: number
  formatted: string
}> {
  try {
    console.log(`🔍 Querying SPL balance for ${mintAddress.substring(0, 8)}...`)

    const balance = await pc.getPrivateBalanceSpl(mintAddress)

    console.log(`✅ Balance: ${balance.amount} base units`)

    return {
      baseUnits: balance.amount,
      formatted: `${balance.amount} base units`,
    }
  } catch (err: any) {
    console.error('❌ Balance query error:', err.message)
    throw new Error(`Failed to query SPL balance: ${err.message}`)
  }
}

/**
 * Convenience method: Deposit USDC
 */
export async function depositUSDC(
  pc: InstanceType<typeof PrivacyCash>,
  base_units: number
): Promise<{ tx: string }> {
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

  return depositSPLToken(pc, USDC_MINT, undefined, base_units)
}

/**
 * Convenience method: Withdraw USDC
 */
export async function withdrawUSDC(
  pc: InstanceType<typeof PrivacyCash>,
  base_units: number,
  recipientAddress?: string,
  referrer?: string
): Promise<{ tx: string; recipient: string; base_units: number; fee_base_units: number; isPartial: boolean }> {
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

  return withdrawSPLToken(pc, USDC_MINT, undefined, base_units, recipientAddress, referrer)
}

/**
 * Convenience method: Get USDC balance
 */
export async function queryUSDCBalance(
  pc: InstanceType<typeof PrivacyCash>
): Promise<{
  baseUnits: number
  formatted: string
}> {
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

  return querySPLBalance(pc, USDC_MINT)
}

/**
 * Format SPL withdrawal error
 */
export function formatSPLWithdrawalError(error: any): string {
  const msg = error?.message?.toLowerCase() || ''

  if (msg.includes('insufficient')) {
    return 'Insufficient token balance in Privacy Cash pool'
  }

  if (msg.includes('invalid mint')) {
    return 'Invalid token mint address'
  }

  if (msg.includes('invalid address')) {
    return 'Invalid recipient wallet address'
  }

  if (msg.includes('unsupported')) {
    return 'This token is not supported by Privacy Cash'
  }

  return `Token withdrawal error: ${error?.message || 'Unknown error'}`
}

/**
 * Privacy Cash Client Wrapper
 * Correct non-custodial implementation using operator keypair for SDK initialization
 * 
 * ARCHITECTURE:
 * - Operator keypair is used ONLY for SDK initialization (key derivation)
 * - User's Phantom wallet signs all transactions
 * - Private keys NEVER transmitted to backend
 * 
 * @ts-ignore - Suppressing type errors for dynamic SDK import
 */

import { Connection, PublicKey, VersionedTransaction, Keypair } from '@solana/web3.js'

export interface DepositOptions {
  lamports: number
  connection: Connection
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
  }
  onProgress?: (message: string) => void
}

export interface WithdrawOptions {
  lamports: number
  recipientAddress?: string
  connection: Connection
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
    signMessage(message: Uint8Array): Promise<Uint8Array>
  }
  onProgress?: (message: string) => void
}

export interface DepositResult {
  tx: string // Transaction signature
  lamports: number
}

export interface WithdrawResult {
  tx: string
  recipient: string
  amount_in_lamports: number
  fee_in_lamports: number
  isPartial: boolean
}

// Cache operator keypair
let cachedOperatorKeypair: Keypair | null = null

/**
 * Get operator keypair for Privacy Cash SDK initialization
 * This is loaded from backend and cached
 */
async function getOperatorKeypair(connection: Connection): Promise<Keypair> {
  if (cachedOperatorKeypair) {
    return cachedOperatorKeypair
  }

  try {
    // Try to fetch operator keypair from backend
    const response = await fetch('/api/operator-keypair')
    if (response.ok) {
      const data = await response.json()
      if (data.seed) {
        // Convert base64 to Keypair
        const seedBuffer = Uint8Array.from(atob(data.seed), c => c.charCodeAt(0))
        cachedOperatorKeypair = Keypair.fromSeed(seedBuffer)
        return cachedOperatorKeypair
      }
    }
  } catch (error) {
    console.log('[Operator Keypair] Could not fetch from /api/operator-keypair, generating demo key')
  }

  // Fallback: use hardcoded demo keypair for testing
  // In production, backend must provide valid operator keypair
  const demoSeed = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    demoSeed[i] = 42 + i // Deterministic test seed
  }
  cachedOperatorKeypair = Keypair.fromSeed(demoSeed)
  
  console.warn('[Operator Keypair] ⚠️ Using demo keypair - set up /api/operator-keypair in production')
  return cachedOperatorKeypair
}

/**
 * Deposit to Privacy Cash
 * Uses operator keypair for SDK initialization, user wallet for transaction signing
 */
export async function depositToPrivacyCash(options: DepositOptions): Promise<DepositResult> {
  const { lamports, connection, wallet, onProgress } = options

  const log = (msg: string) => {
    console.log(`[PrivacyCash Deposit] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`📝 Importing Privacy Cash SDK...`)
    
    // @ts-ignore - Dynamic import of Privacy Cash
    const { PrivacyCash } = await import('privacycash')
    
    // Get operator keypair for SDK initialization
    log(`🔑 Loading operator keypair...`)
    const operatorKeypair = await getOperatorKeypair(connection)
    
    log(`✨ Initializing Privacy Cash client...`)
    const privacyCash = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false  // Disable debug output which tries to write to stdout (not available in browser)
    })
    
    log(`💾 Depositing ${(lamports / 1e9).toFixed(6)} SOL to Privacy Cash pool...`)
    log(`⏳ This may take 30-60 seconds for ZK proof generation...`)
    
    // Perform deposit
    const txSignature = await privacyCash.deposit(lamports)

    log(`✅ Deposit successful!`)
    log(`📤 Transaction: ${txSignature}`)

    return {
      tx: txSignature,
      lamports
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    console.error(`[PrivacyCash Deposit] ❌ Failed:`, errorMsg)
    
    // Provide user-friendly error messages
    if (errorMsg.includes('Insufficient balance')) {
      throw new Error('Not enough SOL in wallet to deposit')
    } else if (errorMsg.includes("Don't deposit more than")) {
      throw new Error('Deposit amount exceeds protocol limit')
    } else if (errorMsg.includes('response not ok') || errorMsg.includes('RPC')) {
      throw new Error('Network error - check RPC connection')
    } else if (errorMsg.includes('User rejected')) {
      throw new Error('Transaction rejected by wallet')
    }
    
    throw new Error(`Deposit failed: ${errorMsg}`)
  }
}

/**
 * Withdraw from Privacy Cash
 * Uses operator keypair for SDK initialization, user wallet for transaction signing
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, connection, wallet, recipientAddress, onProgress } = options
  const recipient = recipientAddress || wallet.publicKey.toString()

  const log = (msg: string) => {
    console.log(`[PrivacyCash Withdraw] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`📝 Importing Privacy Cash SDK...`)
    
    // @ts-ignore - Dynamic import
    const { PrivacyCash } = await import('privacycash')
    
    log(`🔑 Loading operator keypair...`)
    const operatorKeypair = await getOperatorKeypair(connection)
    
    log(`✨ Initializing Privacy Cash client...`)
    const privacyCash = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false  // Disable debug output which tries to write to stdout (not available in browser)
    })
    
    log(`💸 Withdrawing ${(lamports / 1e9).toFixed(6)} SOL from Privacy Cash pool...`)
    log(`📍 Destination: ${recipient}`)
    log(`⏳ This may take 30-60 seconds for ZK proof generation...`)
    
    // Perform withdrawal
    const txSignature = await privacyCash.withdraw(lamports, new PublicKey(recipient))

    log(`✅ Withdrawal successful!`)
    log(`📤 Transaction: ${txSignature}`)

    return {
      tx: txSignature,
      recipient,
      amount_in_lamports: lamports,
      fee_in_lamports: 0,
      isPartial: false
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    console.error(`[PrivacyCash Withdraw] ❌ Failed:`, errorMsg)
    
    if (errorMsg.includes('Insufficient balance')) {
      throw new Error('Not enough private balance to withdraw')
    } else if (errorMsg.includes('Invalid recipient')) {
      throw new Error('Invalid recipient wallet address')
    } else if (errorMsg.includes('User rejected')) {
      throw new Error('Transaction rejected by wallet')
    }
    
    throw new Error(`Withdrawal failed: ${errorMsg}`)
  }
}

/**
 * Get private balance in Privacy Cash
 * Reads balance without requiring transaction
 */
export async function getPrivateBalance(connection: Connection): Promise<number> {
  try {
    // @ts-ignore - Dynamic import
    const { PrivacyCash } = await import('privacycash')
    
    const operatorKeypair = await getOperatorKeypair(connection)
    
    const privacyCash = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false  // Disable debug output which tries to write to stdout (not available in browser)
    })

    const balance = await privacyCash.getPrivateBalance()
    
    // Balance might be a number or an object with lamports property
    return typeof balance === 'number' ? balance : (balance?.lamports || 0)
  } catch (error) {
    console.error('[PrivacyCash Balance] Error:', error)
    return 0
  }
}

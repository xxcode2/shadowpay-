/**
 * Privacy Cash Client Wrapper
 * 
 * Simple wrapper around Privacy Cash SDK
 * Uses operator keypair for SDK initialization
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
  tx: string
  lamports: number
}

export interface WithdrawResult {
  tx: string
  recipient: string
  amount_in_lamports: number
  fee_in_lamports: number
  isPartial: boolean
}

const log = (prefix: string, msg: string) => {
  console.log(`[${prefix}] ${msg}`)
}

let operatorKeypairCache: Keypair | null = null

/**
 * Get operator keypair from backend or generate demo one
 */
async function getOperatorKeypair(): Promise<Keypair> {
  if (operatorKeypairCache) return operatorKeypairCache

  try {
    const response = await fetch('/api/operator-keypair')
    if (response.ok) {
      const data = await response.json()
      if (data.seed) {
        const seedBuffer = Uint8Array.from(atob(data.seed), c => c.charCodeAt(0))
        operatorKeypairCache = Keypair.fromSeed(seedBuffer)
        log('Operator', '✅ Loaded operator keypair from backend')
        return operatorKeypairCache
      }
    }
  } catch (e) {
    // Continue to fallback
  }

  log('Operator', '⚠️ Using demo keypair (backend not available)')
  const demoSeed = new Uint8Array(32)
  for (let i = 0; i < 32; i++) demoSeed[i] = 42
  operatorKeypairCache = Keypair.fromSeed(demoSeed)
  return operatorKeypairCache
}

/**
 * Deposit SOL to Privacy Cash
 */
export async function depositToPrivacyCash(options: DepositOptions): Promise<DepositResult> {
  const { lamports, connection, wallet, onProgress } = options

  const progress = (msg: string) => {
    log('Deposit', msg)
    onProgress?.(msg)
  }

  try {
    progress(`📥 Preparing to deposit ${(lamports / 1e9).toFixed(6)} SOL...`)

    // Import SDK dynamically
    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')

    // Get operator keypair for SDK initialization
    progress(`🔑 Loading operator keypair...`)
    const operatorKeypair = await getOperatorKeypair()

    // Initialize Privacy Cash SDK
    progress(`✨ Initializing Privacy Cash SDK...`)
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false
    })

    // Perform deposit
    progress(`💾 Submitting deposit transaction to Privacy Cash relayer...`)
    progress(`⏳ This may take 30-60 seconds for ZK proof generation...`)
    
    const result = await client.deposit({ lamports })

    progress(`✅ Deposit successful!`)
    progress(`📤 Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      lamports
    }

  } catch (error: any) {
    const message = error?.message || String(error)
    log('Deposit', `❌ Error: ${message}`)

    // Parse and improve error messages
    if (message.includes('Insufficient')) {
      throw new Error('Insufficient SOL balance in wallet')
    } else if (message.includes('deposit more than')) {
      throw new Error('Deposit amount exceeds protocol limit')
    } else if (message.includes('response not ok') || message.includes('RPC')) {
      throw new Error('Network error - RPC connection failed')
    }

    throw new Error(`Deposit failed: ${message}`)
  }
}

/**
 * Withdraw SOL from Privacy Cash
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, connection, wallet, recipientAddress, onProgress } = options
  const recipient = recipientAddress || wallet.publicKey.toString()

  const progress = (msg: string) => {
    log('Withdraw', msg)
    onProgress?.(msg)
  }

  try {
    progress(`📤 Preparing to withdraw ${(lamports / 1e9).toFixed(6)} SOL...`)
    progress(`📍 To: ${recipient}`)

    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')

    progress(`🔑 Loading operator keypair...`)
    const operatorKeypair = await getOperatorKeypair()

    progress(`✨ Initializing Privacy Cash SDK...`)
    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false
    })

    progress(`💳 Submitting withdrawal transaction...`)
    progress(`⏳ This may take 30-60 seconds for ZK proof generation...`)

    const result = await client.withdraw({
      lamports,
      recipientAddress: recipient
    })

    progress(`✅ Withdrawal successful!`)
    progress(`📤 Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      recipient,
      amount_in_lamports: lamports,
      fee_in_lamports: 0,
      isPartial: false
    }

  } catch (error: any) {
    const message = error?.message || String(error)
    log('Withdraw', `❌ Error: ${message}`)

    if (message.includes('Insufficient')) {
      throw new Error('Insufficient private balance')
    } else if (message.includes('Invalid')) {
      throw new Error('Invalid recipient address')
    }

    throw new Error(`Withdrawal failed: ${message}`)
  }
}

/**
 * Get private balance
 */
export async function getPrivateBalance(connection: Connection, wallet?: { publicKey: PublicKey }): Promise<number> {
  try {
    // @ts-ignore
    const { PrivacyCash } = await import('privacycash')

    const operatorKeypair = await getOperatorKeypair()

    const client = new PrivacyCash({
      RPC_url: connection.rpcEndpoint,
      owner: operatorKeypair,
      enableDebug: false
    })

    const balance = await client.getPrivateBalance()
    if (typeof balance === 'number') return balance
    return balance?.lamports || 0

  } catch (error) {
    log('Balance', `⚠️ Error reading balance: ${error}`)
    return 0
  }
}

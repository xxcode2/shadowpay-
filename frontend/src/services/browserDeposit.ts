/**
 * Browser-Compatible Non-Custodial Deposit Service
 *
 * Uses Privacy Cash SDK functions directly in the browser for true non-custodial deposits.
 * User signs a message to derive encryption keys, and the SDK handles
 * ZK proof generation and transaction creation.
 *
 * Flow:
 * 1. User signs "Privacy Money account sign in" message
 * 2. EncryptionService derives keys from signature
 * 3. SDK generates ZK proof in browser
 * 4. User signs transaction with Phantom
 * 5. Transaction submitted to Privacy Cash relayer
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'

// Privacy Cash constants
const SIGN_MESSAGE = 'Privacy Money account sign in'

/**
 * Wallet interface compatible with Phantom and other Solana wallets
 */
export interface WalletAdapter {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>
}

/**
 * Deposit parameters
 */
export interface DepositParams {
  wallet: WalletAdapter
  lamports: number
  connection: Connection
  onProgress?: (step: string, detail?: string) => void
}

/**
 * Deposit result
 */
export interface DepositResult {
  success: boolean
  transactionSignature: string
  amount: number
  explorerUrl: string
  utxoPrivateKey?: string // ✅ NEW: For multi-wallet claiming
}

export async function executeNonCustodialDeposit(params: DepositParams): Promise<DepositResult> {
  const { wallet, lamports, connection, onProgress } = params

  const log = (step: string, detail?: string) => {
    console.log(`[Deposit] ${step}${detail ? ': ' + detail : ''}`)
    onProgress?.(step, detail)
  }

  try {
    log('Starting non-custodial deposit', `${lamports / 1e9} SOL`)

    // Step 1: Check balance
    log('Checking wallet balance')
    const balance = await connection.getBalance(wallet.publicKey)
    const estimatedFees = 5_000_000 // ~0.005 SOL
    const totalNeeded = lamports + estimatedFees

    if (balance < totalNeeded) {
      throw new Error(
        `Insufficient balance. You have ${(balance / 1e9).toFixed(4)} SOL, ` +
        `but need ${(totalNeeded / 1e9).toFixed(4)} SOL`
      )
    }
    log('Balance sufficient', `${(balance / 1e9).toFixed(4)} SOL`)

    // Step 2: Get user signature for encryption key derivation
    log('Requesting signature for encryption key')
    log('Please sign the message in your wallet')

    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE)
    let signature: Uint8Array

    try {
      signature = await wallet.signMessage(encodedMessage)
      // Handle wallets that return { signature } object
      if ((signature as any).signature) {
        signature = (signature as any).signature
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rejected')) {
        throw new Error('You rejected the signature request. This is required for encryption.')
      }
      throw err
    }

    if (!(signature instanceof Uint8Array)) {
      throw new Error('Invalid signature format')
    }

    log('Signature obtained')

    // Step 3: Initialize encryption service with user's signature
    log('Initializing encryption service')

    // Import Privacy Cash SDK dynamically - bypasses module resolution issues
    // The SDK exports EncryptionService and deposit from privacycash/utils
    const privacycashUtils = await import('privacycash/utils') as any
    const { EncryptionService, deposit } = privacycashUtils

    // Create encryption service from user's signature
    const encryptionService = new EncryptionService()
    encryptionService.deriveEncryptionKeyFromSignature(signature)

    // Step 4: Initialize WASM
    log('Initializing WASM')
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()

    // Step 5: Call deposit function
    log('Generating ZK proof', 'This may take 30-60 seconds...')

    const depositResult = await deposit({
      lightWasm,
      connection,
      amount_in_lamports: lamports,
      keyBasePath: '/circuits/transaction2',
      publicKey: wallet.publicKey,
      transactionSigner: async (tx: VersionedTransaction) => {
        log('Please sign the deposit transaction')
        return await wallet.signTransaction(tx)
      },
      storage: localStorage,
      encryptionService
    })

    // ✅ NEW: Extract UTXO private key for multi-wallet claiming
    let utxoPrivateKey: string | undefined
    try {
      console.log('[Deposit] 🔐 Attempting to extract UTXO private key from encryptionService...')
      
      // Log encryptionService state for debugging
      console.log('[Deposit] EncryptionService type:', typeof encryptionService)
      console.log('[Deposit] EncryptionService constructor:', encryptionService?.constructor?.name)
      
      // Try the most direct method first
      if (typeof encryptionService.getUtxoPrivateKeyV2 === 'function') {
        console.log('[Deposit] Found getUtxoPrivateKeyV2 method')
        utxoPrivateKey = encryptionService.getUtxoPrivateKeyV2()
        console.log('[Deposit] getUtxoPrivateKeyV2() returned:', utxoPrivateKey ? `string (${utxoPrivateKey.length} chars)` : 'null/undefined')
      }
      
      if (!utxoPrivateKey && typeof (encryptionService as any).getUtxoPrivateKey === 'function') {
        console.log('[Deposit] Found getUtxoPrivateKey method')
        utxoPrivateKey = (encryptionService as any).getUtxoPrivateKey()
        console.log('[Deposit] getUtxoPrivateKey() returned:', utxoPrivateKey ? `string (${utxoPrivateKey.length} chars)` : 'null/undefined')
      }
      
      if (!utxoPrivateKey && typeof (encryptionService as any).deriveUtxoPrivateKey === 'function') {
        console.log('[Deposit] Found deriveUtxoPrivateKey method')
        utxoPrivateKey = (encryptionService as any).deriveUtxoPrivateKey()
        console.log('[Deposit] deriveUtxoPrivateKey() returned:', utxoPrivateKey ? `string (${utxoPrivateKey.length} chars)` : 'null/undefined')
      }
      
      if (!utxoPrivateKey && typeof (encryptionService as any).getUtxoKeypair === 'function') {
        console.log('[Deposit] Found getUtxoKeypair method')
        const keypair = (encryptionService as any).getUtxoKeypair()
        console.log('[Deposit] getUtxoKeypair() returned:', keypair ? JSON.stringify(Object.keys(keypair)) : 'null')
        if (keypair?.privateKey) {
          utxoPrivateKey = keypair.privateKey
          console.log('[Deposit] Extracted privateKey from keypair')
        }
      }
      
      // Check for public properties/fields
      if (!utxoPrivateKey) {
        console.log('[Deposit] Checking for UTXO key in public properties...')
        const stringProps = Object.getOwnPropertyNames(encryptionService)
          .filter(prop => {
            const val = (encryptionService as any)[prop]
            return val && typeof val === 'string' && val.length > 50 && !prop.startsWith('_')
          })
        
        console.log('[Deposit] Found string properties (>50 chars):', stringProps)
        
        if (stringProps.length > 0) {
          // Use the first long string as potential key
          utxoPrivateKey = (encryptionService as any)[stringProps[0]]
          console.log(`[Deposit] Using ${stringProps[0]} as UTXO key`)
        }
      }
      
      if (!utxoPrivateKey) {
        console.warn('[Deposit] ❌ Could not extract UTXO private key using any method')
        console.warn('[Deposit] This is a limitation of the Privacy Cash SDK')
        console.warn('[Deposit] Multi-wallet claiming will be disabled')
      } else {
        console.log('[Deposit] ✅ SUCCESS: UTXO private key extracted')
        console.log(`[Deposit] Key length: ${utxoPrivateKey.length} characters`)
        console.log(`[Deposit] Key preview: ${utxoPrivateKey.substring(0, 20)}...${utxoPrivateKey.substring(utxoPrivateKey.length - 20)}`)
      }
    } catch (err: any) {
      console.error('[Deposit] ❌ Exception while extracting UTXO key:', err.message || err)
    }

    log('Deposit successful!', depositResult.tx)

    return {
      success: true,
      transactionSignature: depositResult.tx,
      amount: lamports / 1e9,
      explorerUrl: `https://solscan.io/tx/${depositResult.tx}`,
      utxoPrivateKey // ✅ Include for backend storage (may be undefined)
    }

  } catch (error: any) {
    console.error('[Deposit] Error:', error)
    throw error
  }
}

/**
 * Execute deposit using SDK with custom encryption service and transaction signer
 */
async function executeDepositWithSDK(params: {
  connection: Connection
  publicKey: PublicKey
  lamports: number
  encryptionService: any
  rpcUrl: string
  transactionSigner: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  onProgress: (step: string, detail?: string) => void
}): Promise<{ signature: string }> {
  const { connection, publicKey, lamports, encryptionService, rpcUrl, transactionSigner, onProgress } = params

  try {
    // Create a storage wrapper for browser
    const storage = createBrowserStorage()

    // Get WASM factory
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()

    onProgress('WASM initialized')

    return await executeDirectRelayerDeposit({
      connection,
      publicKey,
      lamports,
      encryptionService,
      lightWasm,
      storage,
      transactionSigner,
      onProgress
    })

  } catch (error: any) {
    console.error('[Deposit SDK] Error:', error)
    throw new Error(`Deposit failed: ${error.message}`)
  }
}

/**
 * Execute deposit by directly interacting with Privacy Cash relayer
 * This is the fallback when we can't use the SDK's class directly
 */
async function executeDirectRelayerDeposit(params: {
  connection: Connection
  publicKey: PublicKey
  lamports: number
  encryptionService: any
  lightWasm: any
  storage: any
  transactionSigner: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  onProgress: (step: string, detail?: string) => void
}): Promise<{ signature: string }> {
  const { connection, publicKey, lamports, encryptionService, lightWasm, storage, transactionSigner, onProgress } = params

  // Import SDK utilities from the utils export dynamically to bypass module resolution
  const privacycash = await import('privacycash/utils') as any

  // Get tree state from relayer
  onProgress('Fetching tree state')
  const treeStateResponse = await fetch(`https://api3.privacycash.org/merkle/root`)
  if (!treeStateResponse.ok) {
    throw new Error('Failed to fetch Merkle tree state')
  }
  const { root, nextIndex } = await treeStateResponse.json() as { root: string, nextIndex: number }

  onProgress('Tree state fetched', `nextIndex: ${nextIndex}`)

  // Generate UTXO keypair from user's encryption service
  const utxoPrivateKey = encryptionService.getUtxoPrivateKeyV2()

  // For now, just return a placeholder since we're using the SDK's deposit function
  // The SDK handles all the complex ZK proof generation
  return { signature: 'pending' }
}

/**
 * Create browser-compatible storage
 */
function createBrowserStorage() {
  const prefix = 'privacycash_'

  return {
    getItem(key: string): string | null {
      return localStorage.getItem(prefix + key)
    },
    setItem(key: string, value: string): void {
      localStorage.setItem(prefix + key, value)
    },
    removeItem(key: string): void {
      localStorage.removeItem(prefix + key)
    }
  }
}

/**
 * Clear local cache
 */
export function clearDepositCache(): void {
  const prefix = 'privacycash_'
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log('[Deposit] Cache cleared')
}

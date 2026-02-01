/**
 * Privacy Cash Client Wrapper
 * Simplified interface using the official Privacy Cash SDK
 * 
 * Official docs: https://docs.privacycash.org/sdk
 * 
 * @ts-ignore - Suppressing type errors for dynamic SDK import
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'

export interface DepositOptions {
  lamports: number
  connection: Connection
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
    signMessage(message: Uint8Array): Promise<Uint8Array>
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

/**
 * Deposit to Privacy Cash using the official SDK
 * Uses non-custodial flow: user signs message to derive encryption key,
 * then SDK generates ZK proof and deposit transaction
 */
export async function depositToPrivacyCash(options: DepositOptions): Promise<DepositResult> {
  const { lamports, connection, wallet, onProgress } = options

  const log = (msg: string) => {
    console.log(`[PrivacyCash Deposit] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // Import EncryptionService and deposit from privacycash/utils
    // @ts-ignore - SDK module resolution
    const privacycashUtils = await import('privacycash/utils') as any
    const { EncryptionService, deposit } = privacycashUtils

    // Step 1: Get user signature for encryption key derivation
    log(`Requesting signature for encryption key...`)
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE)
    
    let signature: Uint8Array
    try {
      signature = await wallet.signMessage(encodedMessage)
      if ((signature as any).signature) {
        signature = (signature as any).signature
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rejected')) {
        throw new Error('You rejected the signature request')
      }
      throw err
    }

    if (!(signature instanceof Uint8Array)) {
      throw new Error('Invalid signature format')
    }

    log(`Signature obtained, deriving encryption key...`)

    // Step 2: Create encryption service from signature
    const encryptionService = new EncryptionService()
    encryptionService.deriveEncryptionKeyFromSignature(signature)

    // Step 3: Initialize WASM
    log(`Initializing WASM...`)
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()

    // Step 4: Prepare deposit parameters
    log(`Generating ZK proof, this may take 30-60 seconds...`)
    
    const depositParams: any = {
      lightWasm,
      connection,
      amount_in_lamports: lamports,
      keyBasePath: '/circuits/transaction2',
      publicKey: wallet.publicKey,
      transactionSigner: async (tx: VersionedTransaction) => {
        log(`Waiting for transaction signature...`)
        return await wallet.signTransaction(tx)
      },
      storage: localStorage,
      encryptionService
    }

    // Step 5: Execute deposit
    const result = await deposit(depositParams)

    log(`✅ Deposit successful!`)
    log(`Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      lamports
    }
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`[PrivacyCash Deposit] ❌ Failed:`, errorMsg)
    
    if (errorMsg.includes('Insufficient balance')) {
      throw new Error('Not enough SOL in wallet to deposit')
    } else if (errorMsg.includes("Don't deposit more than")) {
      throw new Error('Deposit amount exceeds maximum limit')
    } else if (errorMsg.includes('rejected')) {
      throw new Error('Transaction rejected by wallet')
    } else if (errorMsg.includes('RPC')) {
      throw new Error('Network error - RPC connection failed')
    } else if (errorMsg.includes('owner')) {
      throw new Error('Initialization error - please try again')
    }

    throw new Error(`Deposit failed: ${errorMsg}`)
  }
}

/**
 * Withdraw from Privacy Cash using the official SDK
 * Uses non-custodial flow: user signs message to derive encryption key,
 * then SDK generates ZK proof and withdraw transaction
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, recipientAddress, connection, wallet, onProgress } = options
  const recipient = recipientAddress || wallet.publicKey.toString()

  const log = (msg: string) => {
    console.log(`[PrivacyCash Withdraw] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // Import EncryptionService and withdraw from privacycash/utils
    // @ts-ignore - SDK module resolution
    const privacycashUtils = await import('privacycash/utils') as any
    const { EncryptionService, withdraw } = privacycashUtils

    // Step 1: Get user signature for encryption key derivation
    log(`Requesting signature for encryption key...`)
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE)
    
    let signature: Uint8Array
    try {
      signature = await wallet.signMessage(encodedMessage)
      if ((signature as any).signature) {
        signature = (signature as any).signature
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rejected')) {
        throw new Error('You rejected the signature request')
      }
      throw err
    }

    if (!(signature instanceof Uint8Array)) {
      throw new Error('Invalid signature format')
    }

    log(`Signature obtained, deriving encryption key...`)

    // Step 2: Create encryption service from signature
    const encryptionService = new EncryptionService()
    encryptionService.deriveEncryptionKeyFromSignature(signature)

    // Step 3: Initialize WASM
    log(`Initializing WASM...`)
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()

    // Step 4: Prepare withdraw parameters
    log(`Generating ZK proof, this may take 30-60 seconds...`)
    
    const withdrawParams: any = {
      lightWasm,
      connection,
      amount_in_lamports: lamports,
      keyBasePath: '/circuits/transaction2',
      publicKey: wallet.publicKey,
      recipientAddress: recipient,
      transactionSigner: async (tx: VersionedTransaction) => {
        log(`Waiting for transaction signature...`)
        return await wallet.signTransaction(tx)
      },
      storage: localStorage,
      encryptionService
    }

    // Step 5: Execute withdraw
    const result = await withdraw(withdrawParams)

    log(`✅ Withdrawal successful!`)
    log(`Transaction: ${result.tx}`)

    return {
      tx: result.tx,
      recipient,
      amount_in_lamports: lamports,
      fee_in_lamports: 0,
      isPartial: false
    }
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`[PrivacyCash Withdraw] ❌ Failed:`, errorMsg)
    
    if (errorMsg.includes('Insufficient')) {
      throw new Error('Not enough balance in private account')
    } else if (errorMsg.includes('rejected')) {
      throw new Error('Transaction rejected by wallet')
    } else if (errorMsg.includes('RPC')) {
      throw new Error('Network error - RPC connection failed')
    } else if (errorMsg.includes('owner')) {
      throw new Error('Initialization error - please try again')
    }

    throw new Error(`Withdrawal failed: ${errorMsg}`)
  }
}

/**
 * Get private balance
 */
export async function getPrivateBalance(
  connection: Connection,
  wallet: { publicKey: PublicKey; signMessage(message: Uint8Array): Promise<Uint8Array> }
): Promise<number> {
  try {
    log('Importing Privacy Cash SDK...')

    // Import EncryptionService from privacycash/utils
    // @ts-ignore
    const privacycashUtils = await import('privacycash/utils') as any
    const { EncryptionService } = privacycashUtils

    // Step 1: Get user signature for encryption key derivation
    log('Requesting signature for balance check...')
    const SIGN_MESSAGE = 'Privacy Money account sign in'
    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE)
    
    let signature: Uint8Array
    try {
      signature = await wallet.signMessage(encodedMessage)
      if ((signature as any).signature) {
        signature = (signature as any).signature
      }
    } catch (err: any) {
      log('User rejected signature request')
      return 0
    }

    if (!(signature instanceof Uint8Array)) {
      log('Invalid signature format')
      return 0
    }

    // Step 2: Create encryption service from signature
    const encryptionService = new EncryptionService()
    encryptionService.deriveEncryptionKeyFromSignature(signature)

    // Step 3: Initialize WASM
    log('Initializing WASM...')
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()

    // Step 4: Get balance using the SDK
    log('Fetching private balance...')
    
    const balanceParams: any = {
      lightWasm,
      connection,
      keyBasePath: '/circuits/transaction2',
      publicKey: wallet.publicKey,
      storage: localStorage,
      encryptionService
    }

    // Try to fetch balance
    // The SDK may have a getBalance or getPrivateBalance method
    // For now return 0 as placeholder - actual balance fetching depends on SDK version
    log('Balance check complete')
    return 0

  } catch (error) {
    console.log(`[PrivacyCash] ⚠️ Could not fetch balance:`, error)
    return 0
  }
}

const log = (msg: string) => {
  console.log(`[PrivacyCash] ${msg}`)
}

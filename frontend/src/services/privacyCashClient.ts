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

/**
 * Deposit to Privacy Cash using the official SDK
 * Simple wrapper that handles the complexity internally
 */
export async function depositToPrivacyCash(options: DepositOptions): Promise<DepositResult> {
  const { lamports, connection, wallet, onProgress } = options

  const log = (msg: string) => {
    console.log(`[PrivacyCash Deposit] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // ✅ Import the official SDK client
    // @ts-ignore - SDK module resolution
    const { PrivacyCash } = await import('privacycash')
    
    log(`Initializing Privacy Cash client...`)
    
    // ✅ For browser wallets, SDK needs connection + wallet for signing
    // The "owner" is just the public key identifier
    const client = new PrivacyCash({
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction
      }
    })

    log(`Depositing ${(lamports / 1e9).toFixed(6)} SOL to Privacy Cash pool...`)
    log(`This may take 30-60 seconds for ZK proof generation...`)
    
    // ✅ Call the official SDK deposit method
    // It handles: ZK proof generation, encryption, transaction signing, submission
    const result = await client.deposit({
      lamports
    })

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
      throw new Error('Deposit amount exceeds protocol limit')
    } else if (errorMsg.includes('response not ok')) {
      throw new Error('Network error - check RPC connection')
    }
    
    throw new Error(`Deposit failed: ${errorMsg}`)
  }
}

/**
 * Withdraw from Privacy Cash using the official SDK
 * Withdraws to a recipient address (or own wallet if not specified)
 */
export async function withdrawFromPrivacyCash(options: WithdrawOptions): Promise<WithdrawResult> {
  const { lamports, recipientAddress, connection, wallet, onProgress } = options

  const log = (msg: string) => {
    console.log(`[PrivacyCash Withdraw] ${msg}`)
    onProgress?.(msg)
  }

  try {
    log(`Importing Privacy Cash SDK...`)
    
    // ✅ Import the official SDK client
    // @ts-ignore - SDK module resolution
    const { PrivacyCash } = await import('privacycash')
    
    log(`Initializing Privacy Cash client...`)
    
    // ✅ For browser wallets, SDK needs connection + wallet for signing
    const client = new PrivacyCash({
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signMessage: wallet.signMessage
      }
    })

    const withdrawTo = recipientAddress || wallet.publicKey.toString()
    log(`Withdrawing ${(lamports / 1e9).toFixed(6)} SOL to ${withdrawTo.slice(0, 8)}...`)
    log(`This may take a moment...`)
    
    // ✅ Call the official SDK withdraw method
    // It handles: UTXO selection, ZK proof generation, relayer submission
    const result = await client.withdraw({
      lamports,
      recipientAddress: withdrawTo
    })

    log(`✅ Withdrawal successful!`)
    log(`Transaction: ${result.tx}`)
    log(`Amount received: ${(result.amount_in_lamports / 1e9).toFixed(6)} SOL`)
    log(`Fee paid: ${(result.fee_in_lamports / 1e9).toFixed(6)} SOL`)

    return {
      tx: result.tx,
      recipient: result.recipient,
      amount_in_lamports: result.amount_in_lamports,
      fee_in_lamports: result.fee_in_lamports,
      isPartial: result.isPartial || false
    }
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`[PrivacyCash Withdraw] ❌ Failed:`, errorMsg)
    
    if (errorMsg.includes('no balance')) {
      throw new Error('No private balance available - deposit first')
    } else if (errorMsg.includes('Need at least 1 unspent UTXO')) {
      throw new Error('No UTXOs available - wait for pending deposits to confirm')
    } else if (errorMsg.includes('withdraw amount too low')) {
      throw new Error('Withdrawal amount is too low to cover fees')
    }
    
    throw new Error(`Withdrawal failed: ${errorMsg}`)
  }
}

/**
 * Get private balance from Privacy Cash
 */
export async function getPrivateBalance(
  connection: Connection,
  wallet: {
    publicKey: PublicKey
    signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
  }
): Promise<number> {
  try {
    // @ts-ignore - SDK module resolution
    const { PrivacyCash } = await import('privacycash')
    
    const client = new PrivacyCash({
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction
      }
    })

    const balance = await client.getPrivateBalance()
    return balance.lamports
  } catch (error) {
    console.error('[PrivacyCash Balance] Error:', error)
    return 0
  }
}

/**
 * Backend Privacy Cash SDK Operations Service
 * Handles monitoring, verification, and operations with Privacy Cash
 */

import { PublicKey, Connection } from '@solana/web3.js'
import { getPrivacyCashClient, lamportsToSol, solToLamports } from '../services/privacyCash.js'

/**
 * Verify deposit transaction on Solana blockchain
 */
export async function verifyDepositTransaction(
  transactionHash: string,
  rpcUrl: string
): Promise<{
  isConfirmed: boolean
  status: 'success' | 'failed' | 'pending'
  timestamp?: number
  slot?: number
  confirmations?: number
  error?: string
}> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed')

    console.log(`🔍 Verifying transaction: ${transactionHash}`)

    const txSignature = transactionHash
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return {
        isConfirmed: false,
        status: 'pending',
        error: 'Transaction not found on chain',
      }
    }

    const isSuccess = tx.meta?.err === null

    console.log(`✅ Transaction verified: ${isSuccess ? 'SUCCESS' : 'FAILED'}`)

    return {
      isConfirmed: true,
      status: isSuccess ? 'success' : 'failed' as const,
      timestamp: tx.blockTime ?? Date.now() / 1000,
      slot: tx.slot,
      confirmations: tx.blockTime ? Math.floor((Date.now() / 1000 - tx.blockTime) / 12) : undefined,
      error: isSuccess ? undefined : 'Transaction failed on-chain',
    }
  } catch (err: any) {
    console.error('❌ Transaction verification error:', err)

    return {
      isConfirmed: false,
      status: 'pending',
      error: `Verification error: ${err.message}`,
    }
  }
}

/**
 * Verify withdrawal transaction
 */
export async function verifyWithdrawalTransaction(
  transactionHash: string,
  rpcUrl: string,
  expectedAmount?: number
): Promise<{
  isConfirmed: boolean
  isValid: boolean
  amount?: number
  amountSOL?: string
  status: string
  message: string
}> {
  try {
    const verification = await verifyDepositTransaction(transactionHash, rpcUrl)

    if (!verification.isConfirmed) {
      return {
        isConfirmed: false,
        isValid: false,
        status: 'pending',
        message: 'Withdrawal transaction not yet confirmed',
      }
    }

    if (verification.status === 'failed') {
      return {
        isConfirmed: true,
        isValid: false,
        status: 'failed',
        message: 'Withdrawal transaction failed on-chain',
      }
    }

    return {
      isConfirmed: true,
      isValid: true,
      amount: expectedAmount,
      amountSOL: expectedAmount ? lamportsToSol(expectedAmount).toFixed(6) : undefined,
      status: 'confirmed',
      message: 'Withdrawal confirmed on-chain',
    }
  } catch (err: any) {
    return {
      isConfirmed: false,
      isValid: false,
      status: 'error',
      message: `Verification failed: ${err.message}`,
    }
  }
}

/**
 * Monitor transaction confirmation status
 */
export async function monitorTransactionStatus(
  transactionHash: string,
  rpcUrl: string,
  maxRetries: number = 10,
  delayMs: number = 3000
): Promise<{
  confirmed: boolean
  status: string
  timestamp?: number
  retries: number
  totalTime: number
}> {
  let retries = 0
  const startTime = Date.now()

  while (retries < maxRetries) {
    try {
      const verification = await verifyDepositTransaction(transactionHash, rpcUrl)

      if (verification.isConfirmed) {
        const totalTime = Date.now() - startTime

        console.log(`✅ Transaction confirmed after ${retries} retries (${totalTime}ms)`)

        return {
          confirmed: true,
          status: verification.status,
          timestamp: verification.timestamp,
          retries,
          totalTime,
        }
      }

      retries++

      if (retries < maxRetries) {
        console.log(`⏳ Waiting for confirmation... (attempt ${retries}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    } catch (err) {
      console.error(`⚠️ Monitoring error on attempt ${retries}:`, err)
      retries++
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  const totalTime = Date.now() - startTime

  console.warn(`⚠️ Transaction confirmation timeout after ${totalTime}ms`)

  return {
    confirmed: false,
    status: 'timeout',
    retries: maxRetries,
    totalTime,
  }
}

/**
 * Check if operator wallet has sufficient balance for operations
 */
export async function checkOperatorWalletBalance(
  rpcUrl: string
): Promise<{
  balanceLamports: number
  balanceSOL: number
  hasSufficientBalance: boolean
  minRecommended: number
  message: string
}> {
  try {
    const pc = getPrivacyCashClient()
    const minRecommendedLamports = solToLamports(0.1) // 0.1 SOL minimum

    // Get operator public key from keypair
    const { getOperatorKeypair } = await import('./privacyCash.js')
    const keypair = getOperatorKeypair()
    const operatorPublicKey = keypair.publicKey

    const connection = new Connection(rpcUrl, 'confirmed')
    const balanceLamports = await connection.getBalance(operatorPublicKey)
    const balanceSOL = lamportsToSol(balanceLamports)

    console.log(`💰 Operator wallet balance: ${balanceSOL.toFixed(6)} SOL`)

    const hasSufficientBalance = balanceLamports >= minRecommendedLamports

    if (!hasSufficientBalance) {
      console.warn(`⚠️ Low operator balance: ${balanceSOL.toFixed(6)} SOL (minimum: 0.1 SOL)`)
    }

    return {
      balanceLamports,
      balanceSOL,
      hasSufficientBalance,
      minRecommended: minRecommendedLamports,
      message: hasSufficientBalance
        ? `Operator balance: ${balanceSOL.toFixed(6)} SOL`
        : `Low operator balance: ${balanceSOL.toFixed(6)} SOL (need at least 0.1 SOL)`,
    }
  } catch (err: any) {
    console.error('❌ Balance check error:', err)

    return {
      balanceLamports: 0,
      balanceSOL: 0,
      hasSufficientBalance: false,
      minRecommended: solToLamports(0.1),
      message: `Failed to check operator balance: ${err.message}`,
    }
  }
}

/**
 * Get Privacy Cash pool statistics
 */
export async function getPoolStatistics(): Promise<{
  operatorAddress: string
  rpcUrl: string
  sdkVersion: string
  isConnected: boolean
  message: string
}> {
  try {
    const pc = getPrivacyCashClient()

    const { getOperatorKeypair } = await import('./privacyCash.js')
    const keypair = getOperatorKeypair()
    const operatorAddress = keypair.publicKey.toString()

    console.log(`✅ Privacy Cash pool initialized`)
    console.log(`   Operator: ${operatorAddress.substring(0, 8)}...`)

    return {
      operatorAddress,
      rpcUrl: process.env.SOLANA_RPC_URL || 'unknown',
      sdkVersion: 'privacycash@^1.1.11',
      isConnected: true,
      message: 'Privacy Cash pool ready',
    }
  } catch (err: any) {
    return {
      operatorAddress: 'unknown',
      rpcUrl: process.env.SOLANA_RPC_URL || 'unknown',
      sdkVersion: 'privacycash@^1.1.11',
      isConnected: false,
      message: `Connection error: ${err.message}`,
    }
  }
}

/**
 * Format transaction details for logging
 */
export function formatTransactionDetails(
  txHash: string,
  amount: number,
  type: 'deposit' | 'withdraw'
): {
  txHash: string
  txShort: string
  type: string
  amountSOL: string
  amountLamports: number
  explorerUrl: string
  displayMessage: string
} {
  const amountSOL = lamportsToSol(amount)
  const txShort = `${txHash.substring(0, 8)}...${txHash.substring(-6)}`
  const explorerUrl = `https://explorer.solana.com/tx/${txHash}`

  return {
    txHash,
    txShort,
    type,
    amountSOL: amountSOL.toFixed(6),
    amountLamports: amount,
    explorerUrl,
    displayMessage: `${type.toUpperCase()}: ${amountSOL.toFixed(6)} SOL`,
  }
}

/**
 * Health check for Privacy Cash backend integration
 */
export async function performHealthCheck(): Promise<{
  healthy: boolean
  components: {
    privacyCash: 'ok' | 'error'
    operator: 'ok' | 'error'
    balance: 'ok' | 'error'
  }
  details: {
    privacyCashMessage: string
    operatorAddress?: string
    balanceSOL?: number
  }
  timestamp: string
}> {
  const timestamp = new Date().toISOString()
  const components: {
    privacyCash: 'ok' | 'error'
    operator: 'ok' | 'error'
    balance: 'ok' | 'error'
  } = {
    privacyCash: 'error',
    operator: 'error',
    balance: 'error',
  }
  const details: any = {
    privacyCashMessage: 'Not initialized',
  }

  try {
    // Check Privacy Cash initialization
    try {
      const pc = getPrivacyCashClient()
      components.privacyCash = 'ok'
      details.privacyCashMessage = 'Privacy Cash SDK initialized'
    } catch (err: any) {
      details.privacyCashMessage = `Initialization error: ${err.message}`
    }

    // Check operator wallet
    try {
      const { getOperatorKeypair } = await import('../services/privacyCash.js')
      const keypair = getOperatorKeypair()
      components.operator = 'ok'
      details.operatorAddress = keypair.publicKey.toString()
    } catch (err: any) {
      details.operatorError = err.message
    }

    // Check balance
    try {
      const balance = await checkOperatorWalletBalance(process.env.SOLANA_RPC_URL!)
      if (balance.hasSufficientBalance) {
        components.balance = 'ok'
      }
      details.balanceSOL = balance.balanceSOL
      details.balanceMessage = balance.message
    } catch (err: any) {
      details.balanceError = err.message
    }
  } catch (err: any) {
    console.error('Health check error:', err)
  }

  const healthy =
    components.privacyCash === 'ok' && components.operator === 'ok' && components.balance === 'ok'

  return {
    healthy,
    components,
    details,
    timestamp,
  }
}

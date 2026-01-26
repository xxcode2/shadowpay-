/**
 * Privacy Cash SDK Integration Examples
 * Complete examples for using the Privacy Cash SDK in ShadowPay
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { executeRealDeposit } from './depositFlow'
import {
  validateDepositAmount,
  formatLamportsToSOL,
  parseSOLToLamports,
  assessDepositPrivacy,
  estimateTransactionFees,
  getExplorerUrl,
} from '../utils/privacyCashUtils'

/**
 * Example 1: Basic Deposit
 * Simple deposit of 0.1 SOL using Privacy Cash SDK
 */
export async function exampleBasicDeposit(wallet: any, linkId: string) {
  console.log('📚 Example 1: Basic Deposit')
  console.log('============================\n')

  try {
    // Amount in SOL
    const amountSOL = 0.1

    // Convert to lamports
    const lamports = parseSOLToLamports(amountSOL)

    console.log(`💰 Depositing ${amountSOL} SOL (${lamports} lamports)`)

    // Execute deposit
    const result = await executeRealDeposit({
      lamports,
      wallet,
      linkId,
    })

    console.log(`✅ Deposit successful!`)
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Amount: ${result.amountSOL} SOL`)
    console.log(`   Explorer: ${result.explorerUrl}`)
  } catch (error) {
    console.error(`❌ Deposit failed:`, error instanceof Error ? error.message : error)
  }
}

/**
 * Example 2: Multiple Deposits with Consolidation
 * Deposit multiple times - amounts are automatically consolidated
 */
export async function exampleMultipleDeposits(wallet: any) {
  console.log('📚 Example 2: Multiple Deposits with Consolidation')
  console.log('====================================================\n')

  const deposits = [
    { amount: 0.1, linkId: 'link-1' },    // 0.1 SOL
    { amount: 0.05, linkId: 'link-2' },   // 0.05 SOL
    { amount: 0.25, linkId: 'link-3' },   // 0.25 SOL
  ]

  for (const deposit of deposits) {
    try {
      const lamports = parseSOLToLamports(deposit.amount)

      console.log(`📍 Depositing ${deposit.amount} SOL for link ${deposit.linkId}...`)

      const result = await executeRealDeposit({
        lamports,
        wallet,
        linkId: deposit.linkId,
      })

      console.log(
        `✅ Deposit successful: ${result.amountSOL} SOL (${result.tx})\n`
      )

      // Small delay between deposits
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(
        `❌ Deposit ${deposit.linkId} failed:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  // Total consolidated amount
  const totalSOL = deposits.reduce((sum, d) => sum + d.amount, 0)
  console.log(`📊 Total consolidated: ${totalSOL} SOL`)
}

/**
 * Example 3: Privacy-Optimized Deposit
 * Deposit with privacy best practices
 */
export async function examplePrivacyOptimizedDeposit(
  wallet: any,
  linkId: string
) {
  console.log('📚 Example 3: Privacy-Optimized Deposit')
  console.log('========================================\n')

  // Use a round, common amount
  const amountSOL = 1.0 // Good for privacy: round number
  const lamports = parseSOLToLamports(amountSOL)

  // Check privacy assessment
  const privacyAssessment = assessDepositPrivacy(lamports)

  console.log(`💰 Amount: ${amountSOL} SOL`)
  console.log(`🔐 Privacy Assessment:`)
  console.log(`   Safe: ${privacyAssessment.isPrivacySafe ? '✅ Yes' : '❌ No'}`)

  if (privacyAssessment.recommendations.length > 0) {
    console.log(`   Recommendations:`)
    privacyAssessment.recommendations.forEach((rec) => {
      console.log(`   - ${rec}`)
    })
  }

  try {
    const result = await executeRealDeposit({
      lamports,
      wallet,
      linkId,
      skipPrivacyWarning: true, // Already assessed above
    })

    console.log(`✅ Privacy-optimized deposit successful!`)
    console.log(`   Transaction: ${result.tx}`)
  } catch (error) {
    console.error(
      `❌ Deposit failed:`,
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Example 4: Deposit with Validation
 * Validate deposit amount before execution
 */
export async function exampleDepositWithValidation(
  wallet: any,
  linkId: string,
  amountSOL: number
) {
  console.log('📚 Example 4: Deposit with Validation')
  console.log('======================================\n')

  const lamports = parseSOLToLamports(amountSOL)

  console.log(`💰 Requested amount: ${amountSOL} SOL`)

  // Validate deposit amount
  const validation = validateDepositAmount(lamports)

  if (!validation.isValid) {
    console.error(`❌ Validation failed: ${validation.error}`)
    return
  }

  if (validation.error) {
    console.warn(`⚠️ Warning: ${validation.error}`)
  }

  console.log(`✅ Validation passed`)

  try {
    const result = await executeRealDeposit({
      lamports,
      wallet,
      linkId,
    })

    console.log(`✅ Deposit successful: ${result.amountSOL} SOL`)
  } catch (error) {
    console.error(
      `❌ Deposit failed:`,
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Example 5: Deposit with Fee Estimation
 * Show fees before executing deposit
 */
export async function exampleDepositWithFeeEstimation(
  wallet: any,
  linkId: string,
  amountSOL: number
) {
  console.log('📚 Example 5: Deposit with Fee Estimation')
  console.log('==========================================\n')

  const lamports = parseSOLToLamports(amountSOL)

  console.log(`💰 Deposit amount: ${amountSOL} SOL`)

  // Get fee estimates
  const fees = estimateTransactionFees()

  console.log(`📊 Fee Breakdown:`)
  console.log(`   Network Fee: ${fees.networkFee} SOL`)
  console.log(`   Protocol Fee: ${fees.protocolFee} SOL`)
  console.log(`   Withdrawal Fee: ${fees.withdrawalFee} SOL + 0.35% (when claiming)`)
  console.log(`   Total for Deposit: ~${fees.totalApproximate} SOL`)

  const totalWithFees = amountSOL + fees.totalApproximate
  console.log(`\n   Total needed in wallet: ${totalWithFees} SOL`)

  try {
    const result = await executeRealDeposit({
      lamports,
      wallet,
      linkId,
    })

    console.log(`✅ Deposit successful: ${result.amountSOL} SOL`)
    console.log(`   Actual fees paid: Network fee included in transaction`)
  } catch (error) {
    console.error(
      `❌ Deposit failed:`,
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Example 6: Error Handling
 * Comprehensive error handling
 */
export async function exampleErrorHandling(
  wallet: any,
  linkId: string,
  amountSOL: number
) {
  console.log('📚 Example 6: Error Handling')
  console.log('=============================\n')

  const lamports = parseSOLToLamports(amountSOL)

  try {
    console.log(`⏳ Processing deposit of ${amountSOL} SOL...`)

    const result = await executeRealDeposit({
      lamports,
      wallet,
      linkId,
    })

    console.log(`✅ Success: ${result.message}`)
    console.log(`   Explorer: ${result.explorerUrl}`)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`)

      // Check for specific error context
      const context = (error as any).context
      if (context) {
        console.log(`\n📋 Error Details:`)
        console.log(`   Error Type: ${context.context.errorType}`)
        console.log(`   Timestamp: ${context.timestamp}`)
      }

      // Log original error for debugging
      const original = (error as any).originalError
      if (original && (import.meta as any).env?.DEV) {
        console.log(`\n🔧 Debug Info:`)
        console.log(original)
      }
    } else {
      console.error(`❌ Unknown error:`, error)
    }
  }
}

/**
 * Example 7: Batch Deposits
 * Multiple deposits in sequence with proper error handling
 */
export async function exampleBatchDeposits(
  wallet: any,
  batchSize: number = 3,
  amountPerDepositSOL: number = 0.1
) {
  console.log('📚 Example 7: Batch Deposits')
  console.log('=============================\n')

  const results = {
    successful: 0,
    failed: 0,
    transactions: [] as string[],
  }

  for (let i = 0; i < batchSize; i++) {
    try {
      const linkId = `batch-link-${Date.now()}-${i}`
      const lamports = parseSOLToLamports(amountPerDepositSOL)

      console.log(`\n[${i + 1}/${batchSize}] Depositing ${amountPerDepositSOL} SOL...`)

      const result = await executeRealDeposit({
        lamports,
        wallet,
        linkId,
      })

      results.successful++
      results.transactions.push(result.tx)

      console.log(`✅ Success: ${result.tx}`)

      // Delay between deposits to avoid rate limiting
      if (i < batchSize - 1) {
        console.log(`⏳ Waiting 2 seconds before next deposit...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error) {
      results.failed++
      console.error(
        `❌ Failed:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  // Summary
  console.log(`\n📊 Batch Summary:`)
  console.log(`   Total Deposits: ${batchSize}`)
  console.log(`   Successful: ${results.successful}`)
  console.log(`   Failed: ${results.failed}`)
  console.log(`   Total Amount: ${batchSize * amountPerDepositSOL} SOL`)

  if (results.transactions.length > 0) {
    console.log(`\n📝 Transaction Hashes:`)
    results.transactions.forEach((tx, i) => {
      console.log(`   [${i + 1}] ${tx}`)
    })
  }
}

/**
 * Example 8: Transaction Explorer URLs
 * Generate and display transaction explorer URLs
 */
export async function exampleTransactionExplorerUrls(
  wallet: any,
  linkId: string,
  amountSOL: number = 0.1
) {
  console.log('📚 Example 8: Transaction Explorer URLs')
  console.log('========================================\n')

  const lamports = parseSOLToLamports(amountSOL)

  try {
    const result = await executeRealDeposit({
      lamports,
      wallet,
      linkId,
    })

    console.log(`✅ Deposit successful!`)
    console.log(`\n📊 Transaction Details:`)
    console.log(`   Amount: ${result.amountSOL} SOL`)
    console.log(`   Transaction Hash: ${result.tx}`)

    console.log(`\n🔗 Explorer URLs:`)

    const mainnetUrl = getExplorerUrl(result.tx, 'mainnet-beta')
    console.log(`   Mainnet: ${mainnetUrl}`)

    // Other clusters for reference (if needed)
    console.log(`\n   Other Clusters:`)
    console.log(`   Devnet: ${getExplorerUrl(result.tx, 'devnet')}`)
    console.log(`   Testnet: ${getExplorerUrl(result.tx, 'testnet')}`)

    console.log(`\n📋 Copy & paste URL to view transaction:`)
    console.log(mainnetUrl)
  } catch (error) {
    console.error(
      `❌ Deposit failed:`,
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * How to use these examples:
 *
 * 1. Import wallet from your wallet adapter
 * 2. Import desired example function
 * 3. Call with appropriate parameters
 *
 * Example:
 * --------
 * import { exampleBasicDeposit } from './flows/exampleIntegrations'
 * import { getWallet } from './wallet/adapter'
 *
 * const wallet = getWallet()
 * await exampleBasicDeposit(wallet, 'my-link-id')
 */

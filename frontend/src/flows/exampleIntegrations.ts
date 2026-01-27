/**
 * Privacy Cash SDK Integration Examples
 * Updated for USER-PAYS architecture
 */

import { executeRealDeposit } from './depositFlow'

/**
 * Example 1: Basic Deposit
 */
export async function exampleBasicDeposit(wallet: any, linkId: string) {
  console.log('📚 Example 1: Basic Deposit\n')

  try {
    const amountSOL = 0.1
    console.log(`💰 Depositing ${amountSOL} SOL`)

    const tx = await executeRealDeposit(
      {
        linkId,
        amount: amountSOL.toString(),
        publicKey: wallet.publicKey.toString(),
      },
      wallet
    )

    console.log(`✅ Deposit successful: ${tx}`)
  } catch (error) {
    console.error(`❌ Deposit failed:`, error instanceof Error ? error.message : error)
  }
}

/**
 * Example 2: Multiple Deposits
 */
export async function exampleMultipleDeposits(wallet: any) {
  console.log('📚 Example 2: Multiple Deposits\n')

  const deposits = [
    { amount: 0.1, linkId: 'link-1' },
    { amount: 0.05, linkId: 'link-2' },
    { amount: 0.25, linkId: 'link-3' },
  ]

  for (const deposit of deposits) {
    try {
      console.log(`📍 Depositing ${deposit.amount} SOL for link ${deposit.linkId}...`)

      const tx = await executeRealDeposit(
        {
          linkId: deposit.linkId,
          amount: deposit.amount.toString(),
          publicKey: wallet.publicKey.toString(),
        },
        wallet
      )

      console.log(`✅ Success: ${tx}\n`)

      // Small delay between deposits
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(
        `❌ Deposit ${deposit.linkId} failed:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  const totalSOL = deposits.reduce((sum, d) => sum + d.amount, 0)
  console.log(`📊 Total: ${totalSOL} SOL`)
}

/**
 * Example 3: Privacy-Optimized Deposit
 */
export async function examplePrivacyOptimizedDeposit(
  wallet: any,
  linkId: string
) {
  console.log('📚 Example 3: Privacy-Optimized Deposit\n')

  try {
    const amountSOL = 1.0
    console.log(`🔐 Depositing round amount: ${amountSOL} SOL (good for privacy)`)

    const tx = await executeRealDeposit(
      {
        linkId,
        amount: amountSOL.toString(),
        publicKey: wallet.publicKey.toString(),
      },
      wallet
    )

    console.log(`✅ Private deposit successful: ${tx}`)
  } catch (error) {
    console.error(`❌ Deposit failed:`, error instanceof Error ? error.message : error)
  }
}

/**
 * Example 4: Variable Amount Deposit
 */
export async function exampleVariableAmountDeposit(
  wallet: any,
  linkId: string,
  amountSOL: number
) {
  console.log('📚 Example 4: Variable Amount Deposit\n')

  try {
    console.log(`💰 Depositing ${amountSOL} SOL`)

    const tx = await executeRealDeposit(
      {
        linkId,
        amount: amountSOL.toString(),
        publicKey: wallet.publicKey.toString(),
      },
      wallet
    )

    console.log(`✅ Deposit successful: ${tx}`)
  } catch (error) {
    console.error(`❌ Deposit failed:`, error instanceof Error ? error.message : error)
  }
}

/**
 * Example 5: Deposit with Error Handling
 */
export async function exampleErrorHandling(wallet: any, linkId: string) {
  console.log('📚 Example 5: Error Handling\n')

  try {
    const amountSOL = 0.001

    const tx = await executeRealDeposit(
      {
        linkId,
        amount: amountSOL.toString(),
        publicKey: wallet.publicKey.toString(),
      },
      wallet
    )

    console.log(`✅ Deposit successful: ${tx}`)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`)

      if (error.message.includes('User rejected')) {
        console.log(`ℹ️  User rejected the signature`)
      } else if (error.message.includes('insufficient')) {
        console.log(`ℹ️  Insufficient SOL balance`)
      } else if (error.message.includes('network')) {
        console.log(`ℹ️  Network error`)
      }
    }
  }
}

/**
 * Example 6: Batch Deposits
 */
export async function exampleBatchDeposits(
  wallet: any,
  batchSize: number = 3,
  amountPerDepositSOL: number = 0.1
) {
  console.log('📚 Example 6: Batch Deposits\n')

  const results = { successful: 0, failed: 0, transactions: [] as string[] }

  for (let i = 0; i < batchSize; i++) {
    try {
      const linkId = `batch-link-${Date.now()}-${i}`

      console.log(`[${i + 1}/${batchSize}] Depositing ${amountPerDepositSOL} SOL...`)

      const tx = await executeRealDeposit(
        {
          linkId,
          amount: amountPerDepositSOL.toString(),
          publicKey: wallet.publicKey.toString(),
        },
        wallet
      )

      results.successful++
      results.transactions.push(tx)
      console.log(`✅ Success: ${tx}`)

      if (i < batchSize - 1) {
        console.log(`⏳ Waiting 2 seconds...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error) {
      results.failed++
      console.error(`❌ Failed:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Successful: ${results.successful}`)
  console.log(`   Failed: ${results.failed}`)
  console.log(`   Total: ${batchSize * amountPerDepositSOL} SOL`)
}

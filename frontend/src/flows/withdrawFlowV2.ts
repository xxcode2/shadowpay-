/**
 * ✅ SIMPLIFIED WITHDRAWAL FLOW (Official SDK)
 * 
 * Uses the official Privacy Cash SDK for proper withdrawal handling
 * Finds UTXOs automatically and withdraws with correct fee handling
 */

import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { withdrawFromPrivacyCash, getPrivateBalance } from '../services/privacyCashClient'

export interface WithdrawRequest {
  walletAddress: string
  recipientAddress?: string  // ✅ Optional: withdraw to different address
  amount?: string  // ✅ Optional: specific amount. If not provided, withdraws all
}

export interface WithdrawResult {
  success: boolean
  transactionSignature: string
  amount: number
  walletAddress: string
}

/**
 * Execute withdrawal from Privacy Cash
 * Simple wrapper around the official SDK
 */
export async function executeWithdraw(
  request: WithdrawRequest,
  wallet: any
): Promise<WithdrawResult> {
  const { walletAddress, recipientAddress, amount: amountStr } = request

  console.log('\n💸 WITHDRAWAL FLOW - Using Official Privacy Cash SDK')
  console.log(`   Wallet: ${walletAddress}`)
  if (recipientAddress) {
    console.log(`   Recipient: ${recipientAddress}`)
  }

  try {
    // Setup connection
    const rpcUrl = CONFIG.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')

    // Ensure publicKey is PublicKey object
    const publicKeyObj = wallet.publicKey instanceof PublicKey
      ? wallet.publicKey
      : new PublicKey(wallet.publicKey)

    // ✅ STEP 1: Check private balance
    console.log(`\nStep 1: Checking private balance...`)
    const balance = await getPrivateBalance(connection, {
      publicKey: publicKeyObj,
      signTransaction: async (tx: VersionedTransaction) => {
        return await wallet.signTransaction(tx)
      }
    })

    const balanceSOL = balance / 1e9
    console.log(`   💰 Private balance: ${balanceSOL.toFixed(6)} SOL (${balance} lamports)`)

    if (balance === 0) {
      throw new Error('No private balance - deposit funds first')
    }

    // ✅ STEP 2: Determine withdrawal amount
    let lamports: number
    if (amountStr) {
      lamports = Math.round(parseFloat(amountStr) * 1e9)
      if (lamports > balance) {
        console.warn(`   ⚠️  Requested amount exceeds balance, withdrawing entire balance`)
        lamports = balance
      }
    } else {
      lamports = balance // Withdraw everything
    }

    const withdrawAmountSOL = lamports / 1e9
    console.log(`   📤 Withdrawing: ${withdrawAmountSOL.toFixed(6)} SOL`)

    // ✅ STEP 3: Execute withdrawal using official SDK
    console.log(`\nStep 2: Creating withdrawal transaction...`)
    const result = await withdrawFromPrivacyCash({
      lamports,
      recipientAddress,
      connection,
      wallet: {
        publicKey: publicKeyObj,
        signTransaction: async (tx: VersionedTransaction) => {
          return await wallet.signTransaction(tx)
        },
        signMessage: async (message: Uint8Array) => {
          return await wallet.signMessage(message)
        }
      },
      onProgress: (msg: string) => {
        console.log(`   📡 ${msg}`)
      }
    })

    console.log(`✅ Withdrawal successful!`)
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Amount received: ${(result.amount_in_lamports / 1e9).toFixed(6)} SOL`)
    console.log(`   Fee: ${(result.fee_in_lamports / 1e9).toFixed(6)} SOL`)
    console.log(`   Status: Funds in wallet ✨`)

    showSuccess(
      `Withdrawn ${(result.amount_in_lamports / 1e9).toFixed(6)} SOL to ${
        recipientAddress ? recipientAddress.slice(0, 8) : 'your wallet'
      }...`
    )

    return {
      success: true,
      transactionSignature: result.tx,
      amount: result.amount_in_lamports / 1e9,
      walletAddress: result.recipient
    }

  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error(`\n❌ WITHDRAWAL FAILED: ${errorMsg}`)

    // Helpful error messages
    if (errorMsg.includes('No private balance')) {
      showError('No private balance - deposit funds first')
    } else if (errorMsg.includes('No UTXOs available')) {
      showError('No UTXOs available - wait for deposits to confirm')
    } else if (errorMsg.includes('too low')) {
      showError('Amount is too low to cover withdrawal fees (~0.01 SOL)')
    } else {
      showError(`Withdrawal failed: ${errorMsg}`)
    }

    throw error
  }
}

/**
 * Get current private balance
 */
export async function getBalance(walletAddress: string, wallet: any): Promise<number> {
  try {
    const connection = new Connection(CONFIG.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')
    const publicKeyObj = new PublicKey(walletAddress)

    const balance = await getPrivateBalance(connection, {
      publicKey: publicKeyObj,
      signTransaction: async (tx: VersionedTransaction) => {
        return await wallet.signTransaction(tx)
      }
    })

    return balance / 1e9
  } catch (error) {
    console.error('Error fetching balance:', error)
    return 0
  }
}

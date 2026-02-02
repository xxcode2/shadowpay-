/**
 * ✅ SIMPLIFIED WITHDRAWAL FLOW (Official SDK)
 * 
 * Uses the official Privacy Cash SDK for proper withdrawal handling
 * Finds UTXOs automatically and withdraws with correct fee handling
 * 
 * FEE STRUCTURE:
 * - User has 1.0 SOL in private balance
 * - 1% owner fee = 0.01 SOL (sent to owner wallet)
 * - 0.99 SOL sent to recipient
 */

import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { withdrawFromPrivacyCash, getPrivateBalance } from '../services/privacyCashClient'
import { getFeeMessage, calculateFee, getNetAmount, FEE_CONFIG } from '../utils/feeCalculator'

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
    const connection = new Connection(CONFIG.SOLANA_RPC_URL, 'confirmed')

    // Ensure publicKey is PublicKey object
    const publicKeyObj = wallet.publicKey instanceof PublicKey
      ? wallet.publicKey
      : new PublicKey(wallet.publicKey)

    // ✅ STEP 1: Check private balance
    console.log(`\nStep 1: Checking private balance...`)
    const balance = await getPrivateBalance(connection, {
      publicKey: publicKeyObj,
      signMessage: async (msg: Uint8Array) => {
        return await wallet.signMessage(msg)
      }
    })

    const balanceSOL = balance / 1e9
    console.log(`   💰 Private balance: ${balanceSOL.toFixed(6)} SOL (${balance} lamports)`)

    if (balance === 0) {
      throw new Error('No private balance - deposit funds first')
    }

    // ✅ STEP 2: Determine withdrawal amount (from balance, BEFORE fee)
    let totalWithdrawLamports: number
    if (amountStr) {
      // Amount is expected as SOL string (e.g., "0.01")
      const amountSOL = parseFloat(amountStr)
      totalWithdrawLamports = Math.round(amountSOL * 1e9)
      
      if (totalWithdrawLamports > balance) {
        console.warn(`   ⚠️  Requested amount exceeds balance, withdrawing entire balance`)
        totalWithdrawLamports = balance
      }
    } else {
      totalWithdrawLamports = balance // Withdraw everything
    }

    // Calculate fee and net amounts
    const feeLamports = calculateFee(totalWithdrawLamports)
    const netLamports = getNetAmount(totalWithdrawLamports)

    const withdrawAmountSOL = totalWithdrawLamports / 1e9
    console.log(`   📤 Requested withdrawal: ${withdrawAmountSOL.toFixed(6)} SOL`)
    console.log(`   ${getFeeMessage(totalWithdrawLamports)}`)

    // ✅ STEP 3: Execute withdrawal using official SDK
    // Withdraw the full amount (fee + net)
    console.log(`\nStep 2: Creating withdrawal transaction...`)
    console.log(`   Withdrawing from Privacy Cash: ${(totalWithdrawLamports / 1e9).toFixed(6)} SOL`)
    
    const result = await withdrawFromPrivacyCash({
      lamports: totalWithdrawLamports,
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

    console.log(`✅ Withdrawal from Privacy Cash successful!`)
    console.log(`   Transaction: ${result.tx}`)

    // ✅ STEP 4: Transfer 1% fee to owner wallet
    console.log(`\nStep 3: Sending fee to owner wallet...`)
    console.log(`   Fee: ${(feeLamports / 1e9).toFixed(6)} SOL → ${FEE_CONFIG.OWNER_WALLET}`)
    
    let feeTransactionSignature: string | null = null
    try {
      // Transfer fee from the withdrawn amount to owner
      feeTransactionSignature = await transferFeeToOwnerFromWithdrawal(
        connection,
        new PublicKey(result.recipient),
        feeLamports,
        wallet
      )
      console.log(`   ✅ Fee transferred: ${feeTransactionSignature.slice(0, 20)}...`)
    } catch (feeErr: any) {
      console.warn(`   ⚠️  Fee transfer error: ${feeErr.message}`)
      // Continue - the full amount is already withdrawn
    }

    console.log(`✅ Withdrawal successful!`)
    console.log(`   Withdrawal TX: ${result.tx}`)
    console.log(`   Gross from pool: ${(totalWithdrawLamports / 1e9).toFixed(6)} SOL`)
    console.log(`   Fee (1%): ${(feeLamports / 1e9).toFixed(6)} SOL`)
    console.log(`   Net to wallet: ${(netLamports / 1e9).toFixed(6)} SOL`)
    console.log(`   Status: Funds in wallet ✨`)

    showSuccess(
      `Withdrawn ${(netLamports / 1e9).toFixed(6)} SOL to ${
        recipientAddress ? recipientAddress.slice(0, 8) : 'your wallet'
      }... (${(feeLamports / 1e9).toFixed(6)} SOL fee)`
    )

    return {
      success: true,
      transactionSignature: result.tx,
      amount: netLamports / 1e9,
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
    const connection = new Connection(CONFIG.SOLANA_RPC_URL)
    const publicKeyObj = new PublicKey(walletAddress)

    const balance = await getPrivateBalance(connection, {
      publicKey: publicKeyObj,
      signMessage: async (msg: Uint8Array) => {
        return await wallet.signMessage(msg)
      }
    })

    return balance / 1e9
  } catch (error) {
    console.error('Error fetching balance:', error)
    return 0
  }
}

/**
 * Transfer 1% owner fee from a received withdrawal
 * Called AFTER Privacy Cash withdrawal to send fee to owner
 * Uses simple legacy transaction with wallet adapter pattern
 */
async function transferFeeToOwnerFromWithdrawal(
  connection: Connection,
  senderPublicKey: PublicKey,
  feeLamports: number,
  wallet: any
): Promise<string> {
  try {
    const ownerPublicKey = new PublicKey(FEE_CONFIG.OWNER_WALLET)

    console.log(`   Checking balance for fee...`)
    const balance = await connection.getBalance(senderPublicKey)
    console.log(`   Balance: ${balance} lamports, Fee needed: ${feeLamports}`)

    if (balance < feeLamports) {
      throw new Error(`Insufficient balance for fee: need ${feeLamports}, have ${balance}`)
    }

    // Create transfer instruction
    const instruction = SystemProgram.transfer({
      fromPubkey: senderPublicKey,
      toPubkey: ownerPublicKey,
      lamports: feeLamports
    })

    // Use simple legacy transaction
    const tx = new Transaction().add(instruction)
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized')
    tx.recentBlockhash = blockhash
    tx.feePayer = senderPublicKey

    // Use wallet adapter to sign AND send (not connection.sendTransaction)
    const signature = await wallet.sendTransaction(tx, connection)

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed')

    return signature

  } catch (error: any) {
    console.error(`❌ Failed to transfer fee: ${error.message}`)
    throw error
  }
}

/**
 * ✨ v3.0 AUTO-WITHDRAW HELPER
 * 
 * Automatically withdraw from Privacy Cash to connected wallet
 * No private key needed - uses connected wallet to sign
 */

import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from '@solana/web3.js'

/**
 * Auto-withdraw using connected wallet (Phantom, Solflare, etc.)
 * Simple: claim → immediately withdraw to user's connected wallet
 */
export async function autoWithdrawToConnectedWallet(input: {
  amount: number // in SOL (e.g., 0.01)
  recipientAddress?: string // If not provided, use connected wallet
}) {
  const { amount, recipientAddress } = input

  console.log('\n' + '='.repeat(70))
  console.log('💰 AUTO-WITHDRAWING FROM PRIVACY CASH')
  console.log('='.repeat(70) + '\n')

  // ✅ CHECK IF WALLET IS CONNECTED
  const wallet = (window as any).solana
  if (!wallet || !wallet.isConnected) {
    throw new Error('❌ Wallet not connected! Please connect your wallet first.')
  }

  const userAddress = wallet.publicKey?.toString()
  if (!userAddress) {
    throw new Error('❌ Could not get wallet address')
  }

  const finalRecipient = recipientAddress || userAddress
  const lamports = Math.floor(amount * 1_000_000_000)

  console.log(`📊 Withdrawal Details:`)
  console.log(`   Amount: ${amount} SOL`)
  console.log(`   From: Privacy Cash pool`)
  console.log(`   To: ${finalRecipient}`)
  console.log(`   Fees: ~0.006 SOL base + 0.35% of amount`)

  try {
    console.log(`\n🔐 Step 1: Initializing Privacy Cash with your wallet...`)

    const { PrivacyCash } = await import('privacycash')

    // Create client with connected wallet's public key
    const client = new PrivacyCash({
      RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
      owner: wallet.publicKey // Use connected wallet
    })

    console.log(`   ✅ Connected wallet: ${userAddress}`)

    console.log(`\n⏳ Step 2: Generating ZK proof and submitting to relayer...`)
    console.log(`   (This may take 30-60 seconds, please wait...)`)

    // Withdraw directly to recipient
    const result = await client.withdraw({
      lamports,
      recipientAddress: finalRecipient
    })

    console.log(`\n✅ WITHDRAWAL SUCCESSFUL!`)
    console.log(`   💸 Transaction: ${result.tx}`)
    console.log(`   📥 Amount received: ${(result.amount_in_lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
    console.log(`   💱 Fees paid: ${(result.fee_in_lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
    console.log(`   🔗 View: https://solscan.io/tx/${result.tx}`)
    console.log('\n' + '='.repeat(70) + '\n')

    return {
      success: true,
      tx: result.tx,
      amountReceived: result.amount_in_lamports / LAMPORTS_PER_SOL,
      feesPaid: result.fee_in_lamports / LAMPORTS_PER_SOL,
      recipient: finalRecipient
    }

  } catch (err: any) {
    console.error(`❌ Auto-withdrawal failed:`, err.message)
    
    // Friendly error messages
    if (err.message.includes('no balance')) {
      throw new Error('❌ No balance in Privacy Cash pool. Deposit may not have confirmed yet.')
    } else if (err.message.includes('UTXO')) {
      throw new Error('❌ No UTXOs available. Wait a moment for deposit to confirm.')
    } else if (err.message.includes('User rejected')) {
      throw new Error('❌ Transaction rejected by wallet. Please try again.')
    }
    
    throw new Error(`❌ Withdrawal failed: ${err.message}`)
  }
}

/**
 * Check Privacy Cash balance for connected wallet
 */
export async function checkPrivacyCashBalanceForConnectedWallet(): Promise<number> {
  const wallet = (window as any).solana
  if (!wallet || !wallet.isConnected) {
    throw new Error('❌ Wallet not connected!')
  }

  try {
    console.log(`🔍 Checking Privacy Cash balance...`)

    const { PrivacyCash } = await import('privacycash')

    const client = new PrivacyCash({
      RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
      owner: wallet.publicKey
    })

    const balance = await client.getPrivateBalance()
    const balanceSOL = balance.lamports / LAMPORTS_PER_SOL

    console.log(`✅ Private Balance: ${balanceSOL.toFixed(6)} SOL`)
    return balanceSOL
  } catch (err: any) {
    console.error('❌ Failed to check balance:', err.message)
    throw err
  }
}

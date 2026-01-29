/**
 * ✨ v3.0 AUTO-WITHDRAW HELPER
 * 
 * Automatically withdraw from Privacy Cash using wallet signing
 * Simple: claim → immediately withdraw to connected wallet
 * NO private keys exposed - uses wallet adapter signing!
 */

import { LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js'

/**
 * Auto-withdraw using wallet signing (Phantom/Solflare)
 * No private key needed - uses wallet.signTransaction
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
  console.log(`   Owner: ${userAddress}`)
  console.log(`   Fees: ~0.006 SOL base + 0.35% of amount`)

  try {
    console.log(`\n🔐 Step 1: Requesting withdrawal from Privacy Cash relayer...`)

    // Step 1: Request unsigned transaction from Privacy Cash relayer
    const relayerResponse = await fetch('https://api.privacycash.net/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ShadowPay-v3'
      },
      body: JSON.stringify({
        amount_lamports: lamports,
        recipient_address: finalRecipient,
        relayer_fee_percent: 0.35,
        owner_public_key: userAddress
      })
    })

    if (!relayerResponse.ok) {
      const errorData = await relayerResponse.text()
      console.error(`Relayer error (${relayerResponse.status}):`, errorData)
      throw new Error(`Privacy Cash relayer error: ${relayerResponse.statusText}`)
    }

    const relayerData = await relayerResponse.json()
    console.log(`   ✅ Relayer prepared transaction`)

    if (!relayerData.unsigned_tx) {
      throw new Error('No unsigned transaction from relayer')
    }

    // Step 2: Deserialize and sign with wallet
    console.log(`\n📝 Step 2: Requesting your wallet to sign transaction...`)

    let txToSign: Transaction
    try {
      // Try to parse as base64
      const txBuffer = Buffer.from(relayerData.unsigned_tx, 'base64')
      txToSign = Transaction.from(txBuffer)
    } catch (parseErr) {
      // If base64 fails, try direct JSON parsing
      const txData = typeof relayerData.unsigned_tx === 'string' 
        ? JSON.parse(relayerData.unsigned_tx)
        : relayerData.unsigned_tx
      txToSign = Transaction.from(txData)
    }

    // Sign with wallet (will trigger popup)
    const signedTx = await wallet.signTransaction(txToSign)
    console.log(`   ✅ Transaction signed by wallet`)

    // Step 3: Submit signed transaction to relayer
    console.log(`\n⏳ Step 3: Submitting signed transaction to relayer...`)
    console.log(`   (Processing ZK proof and withdrawal, please wait...)`)

    const submitResponse = await fetch('https://api.privacycash.net/submit-withdrawal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ShadowPay-v3'
      },
      body: JSON.stringify({
        signed_tx: signedTx.serialize().toString('base64'),
        withdrawal_id: relayerData.withdrawal_id
      })
    })

    if (!submitResponse.ok) {
      const errorData = await submitResponse.text()
      console.error(`Submit error (${submitResponse.status}):`, errorData)
      throw new Error(`Failed to submit withdrawal: ${submitResponse.statusText}`)
    }

    const submitData = await submitResponse.json()

    // Success!
    console.log(`\n✅ WITHDRAWAL SUCCESSFUL!`)
    console.log(`   💸 Transaction: ${submitData.tx_hash}`)
    console.log(`   📥 Amount: ${amount.toFixed(6)} SOL`)
    console.log(`   💰 Recipient: ${finalRecipient}`)
    console.log(`   💱 Base Fee: 0.006 SOL`)
    console.log(`   📊 Protocol Fee: ${(amount * 0.0035).toFixed(6)} SOL`)
    console.log(`   🔗 View: https://solscan.io/tx/${submitData.tx_hash}`)
    console.log('\n' + '='.repeat(70) + '\n')

    return {
      success: true,
      tx: submitData.tx_hash,
      amountReceived: amount - 0.006 - (amount * 0.0035),
      feesPaid: 0.006 + (amount * 0.0035),
      recipient: finalRecipient
    }

  } catch (err: any) {
    console.error(`\n❌ Auto-withdrawal failed:`, err.message)
    
    // Parse error type
    const errorMsg = err.message || err.toString()
    
    if (errorMsg.includes('not signed')) {
      throw new Error('❌ Transaction not signed. Please approve in your wallet.')
    } else if (errorMsg.includes('balance')) {
      throw new Error('❌ Insufficient balance in Privacy Cash pool.')
    } else if (errorMsg.includes('network')) {
      throw new Error('❌ Network error. Please check your connection and try again.')
    } else if (errorMsg.includes('relayer')) {
      throw new Error('❌ Privacy Cash relayer unavailable. Please try again in a moment.')
    }
    
    throw new Error(`❌ Withdrawal failed: ${errorMsg}`)
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

    const userAddress = wallet.publicKey?.toString()
    if (!userAddress) {
      throw new Error('Could not get wallet address')
    }

    // Query Privacy Cash relayer for balance
    const balanceRes = await fetch('https://api.privacycash.net/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ShadowPay-v3'
      },
      body: JSON.stringify({
        owner_public_key: userAddress
      })
    })

    if (!balanceRes.ok) {
      throw new Error(`Balance query failed: ${balanceRes.statusText}`)
    }

    const balanceData = await balanceRes.json()
    const balanceSOL = balanceData.balance_lamports / LAMPORTS_PER_SOL

    console.log(`✅ Private Balance: ${balanceSOL.toFixed(6)} SOL`)
    return balanceSOL
  } catch (err: any) {
    console.error('❌ Failed to check balance:', err.message)
    throw err
  }
}

/**
 * ✨ v3.0 AUTO-WITHDRAW HELPER
 * 
 * After claiming a link, user must withdraw from Privacy Cash
 * This helper makes it easy to do the withdrawal automatically
 */

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

export async function autoWithdrawFromPrivacyCash(input: {
  amount: number // in SOL (e.g., 0.01)
  recipientAddress: string // Solana wallet
  userPrivateKey?: Uint8Array | number[] // Optional: auto-withdraw
}) {
  const { amount, recipientAddress, userPrivateKey } = input

  console.log('\n' + '='.repeat(70))
  console.log('💰 WITHDRAWING FROM PRIVACY CASH')
  console.log('='.repeat(70) + '\n')

  const lamports = Math.floor(amount * 1_000_000_000)

  console.log(`📝 Withdrawal Details:`)
  console.log(`   Amount: ${amount} SOL (${lamports} lamports)`)
  console.log(`   Recipient: ${recipientAddress}`)
  console.log(`   Fees: ~0.006 SOL base + 0.35% of amount`)

  // ✅ IF USER PROVIDED PRIVATE KEY, AUTO-WITHDRAW
  if (userPrivateKey) {
    try {
      console.log(`\n🔐 Initializing Privacy Cash with your keypair...`)

      const { PrivacyCash } = await import('privacycash')
      
      let keyArray: number[] = []
      if (userPrivateKey instanceof Uint8Array) {
        keyArray = Array.from(userPrivateKey)
      } else {
        keyArray = Array.isArray(userPrivateKey) ? userPrivateKey : []
      }

      if (keyArray.length !== 64) {
        throw new Error(`Invalid private key length: ${keyArray.length} (need 64)`)
      }

      const client = new PrivacyCash({
        RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
        owner: keyArray
      })

      console.log(`✅ Privacy Cash client initialized`)
      console.log(`⏳ Generating ZK proof and submitting to relayer...`)

      const result = await client.withdraw({
        lamports,
        recipientAddress
      })

      console.log(`\n✅ WITHDRAWAL SUCCESSFUL!`)
      console.log(`   Transaction: ${result.tx}`)
      console.log(`   Amount received: ${(result.amount_in_lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
      console.log(`   Fees paid: ${(result.fee_in_lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`)
      console.log(`\n💸 View on Solscan: https://solscan.io/tx/${result.tx}`)
      console.log('='.repeat(70) + '\n')

      return {
        success: true,
        tx: result.tx,
        amountReceived: result.amount_in_lamports / LAMPORTS_PER_SOL,
        feesPaid: result.fee_in_lamports / LAMPORTS_PER_SOL
      }

    } catch (err: any) {
      console.error(`❌ Auto-withdrawal failed:`, err.message)
      throw err
    }
  }

  // ✅ OTHERWISE, SHOW MANUAL WITHDRAWAL INSTRUCTIONS
  else {
    console.log(`\n⚠️  Private key not provided - showing manual withdrawal instructions:`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`\n1️⃣  OPTION A: Use Privacy Cash Web UI (Easy)`)
    console.log(`   Visit: https://www.privacycash.net`)
    console.log(`   - Connect your wallet`)
    console.log(`   - Enter amount: ${amount} SOL`)
    console.log(`   - Select recipient: ${recipientAddress}`)
    console.log(`   - Confirm withdrawal`)

    console.log(`\n2️⃣  OPTION B: Use CLI/SDK (Developer)`)
    console.log(`\n   npm install privacycash`)
    console.log(`\n   const { PrivacyCash } = require('privacycash')\n`)
    console.log(`   const client = new PrivacyCash({`)
    console.log(`     RPC_url: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',`)
    console.log(`     owner: [${userPrivateKey ? 'YOUR_PRIVATE_KEY_ARRAY' : 'your 64 byte array'}]`)
    console.log(`   })\n`)
    console.log(`   const result = await client.withdraw({`)
    console.log(`     lamports: ${lamports},`)
    console.log(`     recipientAddress: '${recipientAddress}'`)
    console.log(`   })\n`)
    console.log(`   console.log('TX:', result.tx)`)

    console.log(`\n3️⃣  OPTION C: Use This Helper with Private Key`)
    console.log(`   autoWithdrawFromPrivacyCash({`)
    console.log(`     amount: ${amount},`)
    console.log(`     recipientAddress: '${recipientAddress}',`)
    console.log(`     userPrivateKey: [your 64-byte private key array]`)
    console.log(`   })`)

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`\n⚠️  Note: Make sure recipient wallet is a FRESH/CLEAN wallet for max privacy!`)
    console.log(`   Old wallets may be linked to your deposit address.\n`)

    return {
      success: false,
      requiresManualWithdrawal: true,
      message: 'Manual withdrawal needed - use one of the options above'
    }
  }
}

/**
 * Quick helper to check Privacy Cash balance
 */
export async function checkPrivacyCashBalance(userPrivateKey: Uint8Array | number[]) {
  try {
    const { PrivacyCash } = await import('privacycash')

    let keyArray: number[] = []
    if (userPrivateKey instanceof Uint8Array) {
      keyArray = Array.from(userPrivateKey)
    } else {
      keyArray = Array.isArray(userPrivateKey) ? userPrivateKey : []
    }

    const client = new PrivacyCash({
      RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
      owner: keyArray
    })

    const balance = await client.getPrivateBalance()
    const balanceSOL = balance.lamports / LAMPORTS_PER_SOL

    console.log(`💰 Your Private Balance in Privacy Cash: ${balanceSOL.toFixed(6)} SOL`)
    return balanceSOL
  } catch (err: any) {
    console.error('❌ Failed to check balance:', err.message)
    throw err
  }
}

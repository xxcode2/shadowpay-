/**
 * Fund operator wallet in Privacy Cash pool
 * Run: npx ts-node fund-operator-private-cash.ts <amount_in_sol>
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { PrivacyCash } from 'privacycash'
import dotenv from 'dotenv'

dotenv.config()

const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

async function fundOperatorPrivateCash() {
  try {
    const amountStr = process.argv[2] || '0.5'
    const amount = parseFloat(amountStr)

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount. Usage: npx ts-node fund-operator-private-cash.ts <amount>')
    }

    console.log('\n' + '='.repeat(70))
    console.log('💰 FUNDING OPERATOR PRIVATE CASH POOL')
    console.log('='.repeat(70) + '\n')

    // Get operator private key
    const operatorKeyStr = process.env.OPERATOR_SECRET_KEY || ''
    if (!operatorKeyStr) {
      throw new Error('OPERATOR_SECRET_KEY not set in .env')
    }

    // Parse private key
    let operatorKey: number[]
    if (operatorKeyStr.includes(',')) {
      operatorKey = operatorKeyStr.split(',').map(n => parseInt(n.trim(), 10))
    } else if (operatorKeyStr.startsWith('[')) {
      operatorKey = JSON.parse(operatorKeyStr)
    } else {
      const buffer = Buffer.from(operatorKeyStr, 'base64')
      operatorKey = Array.from(buffer)
    }

    if (!Array.isArray(operatorKey) || operatorKey.length !== 64) {
      throw new Error(`Invalid operator key: got ${operatorKey.length} bytes, need 64`)
    }

    console.log(`📝 Amount to deposit: ${amount} SOL`)
    console.log(`🔑 Loading operator key...`)

    const connection = new Connection(SOLANA_RPC)
    const operatorKeypair = Keypair.fromSecretKey(new Uint8Array(operatorKey))
    const operatorAddress = operatorKeypair.publicKey.toString()

    console.log(`📍 Operator address: ${operatorAddress}`)

    // Check balance
    const balance = await connection.getBalance(operatorAddress)
    const balanceSOL = balance / 1_000_000_000

    console.log(`\n💵 Wallet balance: ${balanceSOL.toFixed(6)} SOL`)

    if (balanceSOL < amount + 0.01) {
      throw new Error(`Insufficient balance! Need ${(amount + 0.01).toFixed(6)} SOL, have ${balanceSOL.toFixed(6)} SOL`)
    }

    console.log(`\n🚀 Depositing ${amount} SOL to Privacy Cash...`)
    console.log(`⏳ This may take 30-60 seconds...\n`)

    const client = new PrivacyCash({
      RPC_url: SOLANA_RPC,
      owner: operatorKey
    })

    const lamports = Math.floor(amount * 1_000_000_000)

    // Deposit to Privacy Cash
    const result = await client.deposit({
      lamports
    })

    console.log(`\n✅ DEPOSIT SUCCESSFUL!`)
    console.log(`   TX: ${result.tx}`)
    console.log(`   Amount deposited: ${amount} SOL`)
    console.log(`   Fee paid: ~0.0001 SOL`)
    console.log(`\n🔗 View: https://solscan.io/tx/${result.tx}`)

    // Check new private balance
    console.log(`\n⏳ Waiting for confirmation...`)
    await new Promise(resolve => setTimeout(resolve, 3000))

    const newClient = new PrivacyCash({
      RPC_url: SOLANA_RPC,
      owner: operatorKey
    })

    const newBalance = await newClient.getPrivateBalance()
    const newBalanceSOL = newBalance.lamports / 1_000_000_000

    console.log(`💰 New Private Cash Balance: ${newBalanceSOL.toFixed(6)} SOL`)
    console.log('\n' + '='.repeat(70) + '\n')

  } catch (err: any) {
    console.error(`\n❌ ERROR:`, err.message)
    process.exit(1)
  }
}

fundOperatorPrivateCash()

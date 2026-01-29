#!/usr/bin/env node

/**
 * Check operator wallet balance on Solana
 * Works locally (with OPERATOR_SECRET_KEY in .env) or on Railway
 */

import dotenv from 'dotenv'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'

dotenv.config()

async function checkBalance() {
  console.log('\n' + '='.repeat(70))
  console.log('💰 CHECKING OPERATOR WALLET BALANCE')
  console.log('='.repeat(70) + '\n')

  try {
    // Get secrets from env
    const operatorSecretKey = process.env.OPERATOR_SECRET_KEY
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

    if (!operatorSecretKey) {
      console.error('❌ OPERATOR_SECRET_KEY not set in environment')
      console.error('\nTo set locally, create/edit .env:')
      console.error('  OPERATOR_SECRET_KEY="<64 comma-separated bytes>"\n')
      process.exit(1)
    }

    // Parse secret key
    let keyArray: number[]
    if (operatorSecretKey.startsWith('[') && operatorSecretKey.endsWith(']')) {
      keyArray = JSON.parse(operatorSecretKey)
    } else {
      keyArray = operatorSecretKey
        .split(',')
        .map((x: string) => parseInt(x.trim(), 10))
        .filter((n: number) => !isNaN(n))
    }

    if (keyArray.length !== 64) {
      console.error(`❌ OPERATOR_SECRET_KEY format invalid: ${keyArray.length} bytes (expected 64)`)
      process.exit(1)
    }

    const keypair = Keypair.fromSecretKey(Uint8Array.from(keyArray))
    const walletAddress = keypair.publicKey.toString()

    console.log(`🔑 Operator wallet:`)
    console.log(`   ${walletAddress}\n`)

    // Check balance
    const connection = new Connection(rpcUrl)
    const balance = await connection.getBalance(keypair.publicKey)
    const solBalance = balance / 1e9

    console.log(`📊 Mainnet balance:`)
    console.log(`   ${solBalance.toFixed(6)} SOL\n`)

    if (solBalance < 0.01) {
      console.warn(`⚠️  LOW BALANCE!`)
      console.warn(`   Minimum recommended: 0.1 SOL`)
      console.warn(`   Send SOL to: ${walletAddress}\n`)
    } else if (solBalance < 0.05) {
      console.warn(`⚠️  Balance OK but low`)
      console.warn(`   Consider sending more SOL for operational buffer\n`)
    } else {
      console.log(`✅ Balance is sufficient\n`)
    }

    console.log('='.repeat(70))
    console.log('ℹ️  To deposit to Privacy Cash pool:')
    console.log('   npx ts-node test-operator-deposit.ts')
    console.log('='.repeat(70) + '\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

checkBalance()

#!/usr/bin/env ts-node
/**
 * 🔍 SHADOWPAY DEPOSIT ERROR DIAGNOSTIC TOOL
 * 
 * Gunakan ini untuk debug error 500 pada /api/deposit/prepare
 * 
 * Usage:
 *   cd backend
 *   npx ts-node diagnostic-deposit.ts
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { loadKeypairFromEnv } from './src/services/keypairManager.js'

console.log(`\n🔍 SHADOWPAY DEPOSIT DIAGNOSTIC\n`)
console.log(`=`.repeat(60))

// 1. Check Environment Variables
console.log(`\n📋 STEP 1: Checking Environment Variables`)
console.log(`-`.repeat(60))

const requiredEnvVars = [
  'OPERATOR_PRIVATE_KEY',
  'OPERATOR_SECRET_KEY', 
  'RPC_URL',
  'SOLANA_RPC_URL',
  'DATABASE_URL',
]

let missingVars: string[] = []
let hasOperatorKey = false

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar]
  if (value) {
    console.log(`✅ ${envVar}: ${value.substring(0, 30)}...`)
    if (envVar === 'OPERATOR_PRIVATE_KEY' || envVar === 'OPERATOR_SECRET_KEY') {
      hasOperatorKey = true
    }
  } else {
    console.log(`❌ ${envVar}: NOT SET`)
    missingVars.push(envVar)
  }
}

if (!hasOperatorKey) {
  console.log(`\n⚠️  WARNING: No operator key found!`)
  console.log(`   Set either OPERATOR_PRIVATE_KEY or OPERATOR_SECRET_KEY`)
}

// 2. Check Operator Keypair
console.log(`\n📋 STEP 2: Testing Operator Keypair`)
console.log(`-`.repeat(60))

let operatorKeypair: any
let operatorPublicKey: string

try {
  operatorKeypair = loadKeypairFromEnv()
  operatorPublicKey = operatorKeypair.publicKey.toBase58()
  console.log(`✅ Operator keypair loaded successfully`)
  console.log(`   Public Key: ${operatorPublicKey}`)
  console.log(`   Secret Key Length: ${operatorKeypair.secretKey.length} bytes`)
} catch (err: any) {
  console.error(`❌ Failed to load operator keypair:`)
  console.error(`   ${err.message}`)
  console.log(`\n💡 Fix: Make sure OPERATOR_SECRET_KEY or OPERATOR_PRIVATE_KEY is set correctly`)
  console.log(`   Format: [200,228,213,...,188] or 200,228,213,...,188`)
  process.exit(1)
}

// 3. Check RPC Connection
console.log(`\n📋 STEP 3: Testing RPC Connection`)
console.log(`-`.repeat(60))

const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_URL || 
  'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

console.log(`RPC URL: ${rpcUrl.substring(0, 60)}...`)

let connection: Connection
let rpcWorking = false

try {
  connection = new Connection(rpcUrl, 'confirmed')
  const version = await connection.getVersion()
  console.log(`✅ RPC connection successful`)
  console.log(`   Solana Version: ${version['solana-core']}`)
  rpcWorking = true
} catch (err: any) {
  console.error(`❌ RPC connection failed:`)
  console.error(`   ${err.message}`)
  console.log(`\n💡 Fix: Check your RPC_URL or SOLANA_RPC_URL`)
  console.log(`   Try using a public RPC or get an API key from:`)
  console.log(`   - Helius: https://helius.dev`)
  console.log(`   - QuickNode: https://quicknode.com`)
  console.log(`   - Alchemy: https://alchemy.com`)
}

// 4. Check Operator Wallet Balance
if (rpcWorking && operatorKeypair) {
  console.log(`\n📋 STEP 4: Checking Operator Wallet Balance`)
  console.log(`-`.repeat(60))
  
  try {
    const balance = await connection!.getBalance(operatorKeypair.publicKey)
    const balanceSOL = balance / LAMPORTS_PER_SOL
    
    console.log(`Wallet: ${operatorPublicKey}`)
    console.log(`Balance: ${balanceSOL} SOL (${balance} lamports)`)
    
    if (balance === 0) {
      console.log(`\n⚠️  WARNING: Operator wallet has 0 balance!`)
      console.log(`   While users pay fees, the operator wallet still needs some SOL`)
      console.log(`   for SDK initialization and proof generation.`)
      console.log(`\n💡 Fix: Send at least 0.01 SOL to: ${operatorPublicKey}`)
    } else if (balanceSOL < 0.01) {
      console.log(`\n⚠️  WARNING: Operator wallet balance is low`)
      console.log(`   Recommended: At least 0.01 SOL`)
      console.log(`\n💡 Fix: Send more SOL to: ${operatorPublicKey}`)
    } else {
      console.log(`✅ Operator wallet has sufficient balance`)
    }
  } catch (err: any) {
    console.error(`❌ Failed to check wallet balance:`)
    console.error(`   ${err.message}`)
  }
}

// 5. Check Privacy Cash SDK
console.log(`\n📋 STEP 5: Testing Privacy Cash SDK`)
console.log(`-`.repeat(60))

try {
  // Try to import Privacy Cash
  const { PrivacyCash } = await import('privacycash')
  console.log(`✅ Privacy Cash SDK imported successfully`)
  
  // Try to initialize
  try {
    const config = {
      RPC_url: rpcUrl,
      owner: operatorKeypair,
      enableDebug: false,
    }
    
    const pc = new PrivacyCash(config)
    console.log(`✅ Privacy Cash SDK initialized successfully`)
    
  } catch (initErr: any) {
    console.error(`❌ Failed to initialize Privacy Cash SDK:`)
    console.error(`   ${initErr.message}`)
    console.log(`\n💡 This is likely the cause of your 500 error!`)
  }
  
} catch (importErr: any) {
  console.error(`❌ Failed to import Privacy Cash SDK:`)
  console.error(`   ${importErr.message}`)
  console.log(`\n💡 Fix: Install Privacy Cash SDK`)
  console.log(`   Run: npm install privacycash`)
  console.log(`   Or: pnpm install privacycash`)
}

// 6. Summary
console.log(`\n📋 DIAGNOSTIC SUMMARY`)
console.log(`=`.repeat(60))

let issuesFound = 0

if (missingVars.length > 0) {
  console.log(`❌ Missing environment variables: ${missingVars.join(', ')}`)
  issuesFound++
}

if (!hasOperatorKey) {
  console.log(`❌ No operator key configured`)
  issuesFound++
}

if (!rpcWorking) {
  console.log(`❌ RPC connection not working`)
  issuesFound++
}

if (issuesFound === 0) {
  console.log(`✅ All checks passed!`)
  console.log(`\nIf you're still getting 500 errors, check:`)
  console.log(`1. Backend logs for more specific error messages`)
  console.log(`2. Privacy Cash SDK version compatibility`)
  console.log(`3. Network connectivity from your deployment environment`)
} else {
  console.log(`\n⚠️  Found ${issuesFound} issue(s)`)
  console.log(`\nFix the issues above and try again.`)
}

console.log(`\n` + `=`.repeat(60))
console.log(`\n`)

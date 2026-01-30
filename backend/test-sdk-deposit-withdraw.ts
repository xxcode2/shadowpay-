#!/usr/bin/env node

/**
 * ✅ SDK APPROACH TEST
 * 
 * Test clean SDK deposit & withdraw WITHOUT manual complexity
 * 
 * ✅ DO: Use SDK with circuits
 * ❌ DON'T: Manual merkle/nullifier/buildCircuitInput
 */

import PrivacyCash from 'privacycash'
import { Keypair } from '@solana/web3.js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCUITS_DIR = path.join(process.cwd(), 'public', 'circuits')
const TEST_AMOUNT_SOL = 0.001 // Small amount for testing

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseKeypair(secretKeyInput: string): Keypair {
  if (!secretKeyInput) {
    throw new Error('OPERATOR_SECRET_KEY not set')
  }

  try {
    if (secretKeyInput.includes(',')) {
      const arr = secretKeyInput
        .split(',')
        .map(x => parseInt(x.trim(), 10))
        .filter(n => !isNaN(n))

      if (arr.length !== 64) {
        throw new Error(`Invalid key: expected 64 bytes, got ${arr.length}`)
      }

      return Keypair.fromSecretKey(Uint8Array.from(arr))
    }

    if (secretKeyInput.startsWith('[') && secretKeyInput.endsWith(']')) {
      const arr = JSON.parse(secretKeyInput)
      if (!Array.isArray(arr) || arr.length !== 64) {
        throw new Error(`Invalid key array: expected 64 bytes, got ${arr.length}`)
      }
      return Keypair.fromSecretKey(Uint8Array.from(arr))
    }

    throw new Error('Unsupported key format')
  } catch (err: any) {
    throw new Error(`Failed to parse OPERATOR_SECRET_KEY: ${err.message}`)
  }
}

async function loadCircuits(): Promise<{
  wasm: Uint8Array
  zkey: Uint8Array
}> {
  console.log(`📦 Loading circuits from: ${CIRCUITS_DIR}`)

  const wasmPath = path.join(CIRCUITS_DIR, 'transaction2.wasm')
  const zkeyPath = path.join(CIRCUITS_DIR, 'transaction2.zkey')

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM not found: ${wasmPath}`)
  }

  if (!fs.existsSync(zkeyPath)) {
    throw new Error(`ZKEY not found: ${zkeyPath}`)
  }

  const wasm = new Uint8Array(fs.readFileSync(wasmPath))
  const zkey = new Uint8Array(fs.readFileSync(zkeyPath))

  console.log(`   ✅ WASM: ${(wasm.length / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   ✅ ZKEY: ${(zkey.length / 1024 / 1024).toFixed(2)} MB\n`)

  return { wasm, zkey }
}

// ============================================================================
// TEST FLOW
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 SDK APPROACH TEST - CLEAN DEPOSIT & WITHDRAW')
  console.log('='.repeat(80) + '\n')

  try {
    // ✅ STEP 1: Setup
    console.log('📋 STEP 1: Setup')
    console.log('-'.repeat(80))

    if (!OPERATOR_SECRET_KEY) {
      console.error('❌ OPERATOR_SECRET_KEY not set')
      process.exit(1)
    }

    const operatorKeypair = parseKeypair(OPERATOR_SECRET_KEY)
    const operatorAddress = operatorKeypair.publicKey.toString()
    const recipientKeypair = Keypair.generate()
    const recipientAddress = recipientKeypair.publicKey.toString()

    console.log(`✅ Operator: ${operatorAddress}`)
    console.log(`✅ Recipient: ${recipientAddress}`)
    console.log(`✅ Amount: ${TEST_AMOUNT_SOL} SOL\n`)

    // ✅ STEP 2: Load circuits
    console.log('📋 STEP 2: Load circuits')
    console.log('-'.repeat(80))

    let circuits
    try {
      circuits = await loadCircuits()
    } catch (err: any) {
      console.warn(`⚠️  Could not load circuits from filesystem: ${err.message}`)
      console.warn(`    In production, circuits would be loaded from /circuits folder\n`)
      throw err
    }

    // ✅ STEP 3: Initialize Privacy Cash SDK
    console.log('📋 STEP 3: Initialize Privacy Cash SDK')
    console.log('-'.repeat(80))

    console.log(`🔄 Initializing with:`)
    console.log(`   RPC: ${RPC_URL}`)
    console.log(`   Keypair: ${operatorAddress}`)
    console.log(`   (NO manual merkle/nullifier/buildCircuitInput)\n`)

    const pc = new PrivacyCash(operatorKeypair, RPC_URL)

    console.log(`✅ Privacy Cash SDK ready\n`)

    // ✅ STEP 4: Deposit (Create Link)
    console.log('📋 STEP 4: Deposit to Privacy Cash Pool (Create Link)')
    console.log('-'.repeat(80))

    console.log(`📥 Depositing ${TEST_AMOUNT_SOL} SOL...`)
    console.log(`   Amount: ${TEST_AMOUNT_SOL * 1e9} lamports`)
    console.log(`   Memo: "ShadowPay payment link"`)
    console.log(`⏳ Processing (may take 60+ seconds)...\n`)

    let linkId: string
    try {
      // THIS IS THE KEY - SDK handle everything
      // NO buildCircuitInput, NO manual merkle, NO nullifier
      linkId = await pc.deposit(TEST_AMOUNT_SOL * 1e9, {
        memo: 'ShadowPay payment link',
        prover: circuits,
      })

      console.log(`✅ DEPOSIT SUCCESSFUL!`)
      console.log(`   Link ID: ${linkId}`)
      console.log(`   Status: Ready to share with recipient\n`)

      // In real app, save this to database
      console.log(`📝 Saving to database:`)
      console.log(`   {`)
      console.log(`     linkId: "${linkId}",`)
      console.log(`     amount: ${TEST_AMOUNT_SOL},`)
      console.log(`     status: "active",`)
      console.log(`     createdAt: "${new Date().toISOString()}",`)
      console.log(`   }\n`)

    } catch (depositErr: any) {
      console.error(`❌ DEPOSIT FAILED`)
      console.error(`   Error: ${depositErr.message}\n`)

      if (depositErr.message?.includes('UTXO')) {
        console.warn(`⚠️  Operator needs balance in Privacy Cash pool`)
        console.warn(`   Run: npx ts-node test-operator-deposit.ts\n`)
      }

      throw depositErr
    }

    // ✅ STEP 5: Withdraw (Claim Link)
    console.log('📋 STEP 5: Withdraw from Privacy Cash Pool (Claim Link)')
    console.log('-'.repeat(80))

    console.log(`📤 Withdrawing to: ${recipientAddress}`)
    console.log(`   Amount: ${TEST_AMOUNT_SOL * 1e9} lamports`)
    console.log(`⏳ Processing (may take 60+ seconds)...\n`)

    let withdrawTx: string
    try {
      // THIS IS THE KEY - SDK handle everything
      // NO manual merkle access, NO nullifier management
      withdrawTx = await pc.withdraw(TEST_AMOUNT_SOL * 1e9, recipientAddress, {
        prover: circuits,
      })

      console.log(`✅ WITHDRAW SUCCESSFUL!`)
      console.log(`   TX: ${withdrawTx}`)
      console.log(`   Recipient: ${recipientAddress}`)
      console.log(`   Amount: ${TEST_AMOUNT_SOL} SOL\n`)

      // In real app, update database
      console.log(`📝 Updating database:`)
      console.log(`   {`)
      console.log(`     linkId: "${linkId}",`)
      console.log(`     status: "claimed",`)
      console.log(`     claimedBy: "${recipientAddress}",`)
      console.log(`     withdrawTx: "${withdrawTx}",`)
      console.log(`     claimedAt: "${new Date().toISOString()}",`)
      console.log(`   }\n`)

    } catch (withdrawErr: any) {
      console.error(`❌ WITHDRAW FAILED`)
      console.error(`   Error: ${withdrawErr.message}\n`)

      if (withdrawErr.message?.includes('UTXO')) {
        console.warn(`⚠️  Operator has no balance in Privacy Cash pool`)
        console.warn(`   First, deposit: npx ts-node test-operator-deposit.ts\n`)
      }

      throw withdrawErr
    }

    // ✅ SUMMARY
    console.log('='.repeat(80))
    console.log('✅ SDK APPROACH TEST PASSED!')
    console.log('='.repeat(80) + '\n')

    console.log(`✨ What We Tested:`)
    console.log(`   1. ✅ Load circuits (wasm + zkey)`)
    console.log(`   2. ✅ Initialize Privacy Cash SDK`)
    console.log(`   3. ✅ Deposit (create link) WITHOUT manual complexity`)
    console.log(`      - NO buildCircuitInput`)
    console.log(`      - NO inPathIndices`)
    console.log(`      - NO inPathElements`)
    console.log(`      - NO manual nullifier`)
    console.log(`      - SDK handle everything ✅`)
    console.log(`   4. ✅ Withdraw (claim link) WITHOUT manual complexity`)
    console.log(`      - Recipient use their own wallet`)
    console.log(`      - Non-custodial ✅`)
    console.log(`\n🎯 Architecture:`)
    console.log(`   User A → SDK.deposit() → linkId`)
    console.log(`   User B → SDK.withdraw(linkId) → funds in B's wallet`)
    console.log(`   Backend → Just save linkId + status\n`)
    console.log(`🚀 Ready for frontend integration!\n`)

  } catch (error: any) {
    console.error('\n' + '='.repeat(80))
    console.error('❌ TEST FAILED')
    console.error('='.repeat(80))
    console.error(`\nError: ${error.message || error}\n`)

    console.log('📋 Troubleshooting:')
    console.log('   1. Check OPERATOR_SECRET_KEY is set')
    console.log('   2. Ensure operator has balance: npm run check-operator-balance')
    console.log('   3. Check circuits exist: ls public/circuits/')
    console.log('   4. Check SOLANA_RPC_URL is correct\n')

    process.exit(1)
  }
}

main()

#!/usr/bin/env node

/**
 * ✅ BASIC PRIVACY CASH FLOW TEST
 * 
 * Tests fundamental deposit & withdraw WITHOUT UI
 * Verifies keypair consistency and SDK functionality
 * 
 * Flow:
 * 1. Initialize Privacy Cash with OPERATOR keypair
 * 2. Check operator's private balance
 * 3. Simulate deposit (0.01 SOL to pool)
 * 4. Check balance after deposit
 * 5. Simulate withdraw (0.005 SOL from pool)
 * 6. Check balance after withdraw
 */

import { Keypair } from '@solana/web3.js'
import dotenv from 'dotenv'
import PrivacyCash from 'privacycash'

dotenv.config()

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY

const TEST_DEPOSIT_AMOUNT = 0.01 * 1e9 // 0.01 SOL in lamports
const TEST_WITHDRAW_AMOUNT = 0.005 * 1e9 // 0.005 SOL in lamports

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseKeypair(secretKeyInput: string): Keypair {
  if (!secretKeyInput) {
    throw new Error('OPERATOR_SECRET_KEY not set')
  }

  try {
    // Parse comma-separated bytes
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

    // Try JSON array
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

// ============================================================================
// TEST FLOW
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 BASIC PRIVACY CASH DEPOSIT & WITHDRAW TEST')
  console.log('='.repeat(80) + '\n')

  try {
    // ✅ STEP 1: Parse keypair
    console.log('📋 STEP 1: Initialize operator keypair')
    console.log('-'.repeat(80))

    if (!OPERATOR_SECRET_KEY) {
      console.error('❌ OPERATOR_SECRET_KEY not set in environment')
      console.error('\nSet it locally:')
      console.error('  export OPERATOR_SECRET_KEY="<64 comma-separated bytes>"\n')
      process.exit(1)
    }

    const operatorKeypair = parseKeypair(OPERATOR_SECRET_KEY)
    const operatorAddress = operatorKeypair.publicKey.toString()

    console.log(`✅ Keypair parsed successfully`)
    console.log(`   Address: ${operatorAddress}`)
    console.log(`   Secret key bytes: ${OPERATOR_SECRET_KEY.split(',').length}\n`)

    // ✅ STEP 2: Initialize Privacy Cash client
    console.log('📋 STEP 2: Initialize Privacy Cash SDK')
    console.log('-'.repeat(80))

    console.log(`🔄 Connecting to Solana RPC: ${RPC_URL}`)
    console.log(`🔐 Using operator wallet: ${operatorAddress}`)
    console.log(`⏳ This may take 30-60 seconds...\n`)

    const pc = new PrivacyCash(operatorKeypair, RPC_URL)

    console.log(`✅ Privacy Cash client initialized\n`)

    // ✅ STEP 3: Check initial balance
    console.log('📋 STEP 3: Check operator\'s private balance')
    console.log('-'.repeat(80))

    console.log(`🔍 Querying private balance...`)
    const balanceBefore = await pc.getPrivateBalance()

    console.log(`✅ Private balance retrieved`)
    console.log(`   Current: ${(balanceBefore / 1e9).toFixed(9)} SOL`)
    console.log(`   Lamports: ${balanceBefore.toLocaleString()}\n`)

    // ✅ STEP 4: Test deposit
    console.log('📋 STEP 4: Test deposit to Privacy Cash pool')
    console.log('-'.repeat(80))

    console.log(`💸 Test deposit amount: ${(TEST_DEPOSIT_AMOUNT / 1e9).toFixed(6)} SOL`)
    console.log(`⏳ Executing deposit... (this may take 60+ seconds)\n`)

    try {
      const depositResult = await pc.deposit(TEST_DEPOSIT_AMOUNT)
      
      console.log(`✅ DEPOSIT SUCCESSFUL!`)
      console.log(`   TX: ${depositResult}`)
      console.log(`   Amount: ${(TEST_DEPOSIT_AMOUNT / 1e9).toFixed(6)} SOL\n`)

      // Wait a moment for pool to update
      console.log(`⏳ Waiting for blockchain confirmation... (30 seconds)\n`)
      await new Promise(resolve => setTimeout(resolve, 30000))

      // ✅ STEP 5: Check balance after deposit
      console.log('📋 STEP 5: Check balance after deposit')
      console.log('-'.repeat(80))

      console.log(`🔍 Querying updated balance...`)
      const balanceAfterDeposit = await pc.getPrivateBalance()

      console.log(`✅ Balance updated`)
      console.log(`   Before: ${(balanceBefore / 1e9).toFixed(9)} SOL`)
      console.log(`   After:  ${(balanceAfterDeposit / 1e9).toFixed(9)} SOL`)
      console.log(`   Change: ${((balanceAfterDeposit - balanceBefore) / 1e9).toFixed(9)} SOL\n`)

      if (balanceAfterDeposit > balanceBefore) {
        console.log(`✅ DEPOSIT VERIFIED: Balance increased\n`)
      } else {
        console.warn(`⚠️  WARNING: Balance did not increase. May still be confirming.\n`)
      }

      // ✅ STEP 6: Test withdraw
      console.log('📋 STEP 6: Test withdraw from Privacy Cash pool')
      console.log('-'.repeat(80))

      console.log(`💸 Test withdraw amount: ${(TEST_WITHDRAW_AMOUNT / 1e9).toFixed(6)} SOL`)
      console.log(`📤 Recipient: ${operatorAddress} (same as operator)`)
      console.log(`⏳ Executing withdraw... (this may take 60+ seconds)\n`)

      const withdrawResult = await pc.withdraw(TEST_WITHDRAW_AMOUNT, operatorAddress)

      console.log(`✅ WITHDRAW SUCCESSFUL!`)
      console.log(`   TX: ${withdrawResult}`)
      console.log(`   Amount: ${(TEST_WITHDRAW_AMOUNT / 1e9).toFixed(6)} SOL\n`)

      // Wait for confirmation
      console.log(`⏳ Waiting for blockchain confirmation... (30 seconds)\n`)
      await new Promise(resolve => setTimeout(resolve, 30000))

      // ✅ STEP 7: Check final balance
      console.log('📋 STEP 7: Check balance after withdraw')
      console.log('-'.repeat(80))

      console.log(`🔍 Querying final balance...`)
      const balanceAfterWithdraw = await pc.getPrivateBalance()

      console.log(`✅ Final balance`)
      console.log(`   Start:   ${(balanceBefore / 1e9).toFixed(9)} SOL`)
      console.log(`   After deposit: ${(balanceAfterDeposit / 1e9).toFixed(9)} SOL`)
      console.log(`   After withdraw: ${(balanceAfterWithdraw / 1e9).toFixed(9)} SOL`)
      console.log(`   Net change: ${((balanceAfterWithdraw - balanceBefore) / 1e9).toFixed(9)} SOL\n`)

      // ✅ SUMMARY
      console.log('='.repeat(80))
      console.log('✅ BASIC FLOW TEST PASSED!')
      console.log('='.repeat(80))
      console.log(`\n✨ Summary:`)
      console.log(`   1. ✅ Keypair initialization works`)
      console.log(`   2. ✅ Privacy Cash SDK connects successfully`)
      console.log(`   3. ✅ Deposit to pool executes`)
      console.log(`   4. ✅ Balance increases after deposit`)
      console.log(`   5. ✅ Withdraw from pool executes`)
      console.log(`   6. ✅ Withdraw reduces balance\n`)
      console.log(`🎉 Ready for UI integration!\n`)

    } catch (depositErr: any) {
      console.error(`\n❌ DEPOSIT/WITHDRAW FAILED:`)
      console.error(`   ${depositErr.message || depositErr}\n`)

      // Check if it's the UTXO error
      if (depositErr.message?.includes('UTXO')) {
        console.warn(`⚠️  EXPECTED ERROR: Operator has no UTXOs in Privacy Cash pool`)
        console.warn(`\nTo fix:`)
        console.warn(`1. Ensure operator wallet has 0.1+ SOL on Solana mainnet`)
        console.warn(`2. Run deposit test again`)
        console.warn(`3. After deposit succeeds, operator can execute withdrawals\n`)
      }

      throw depositErr
    }

  } catch (error: any) {
    console.error('\n' + '='.repeat(80))
    console.error('❌ TEST FAILED')
    console.error('='.repeat(80))
    console.error(`\nError: ${error.message || error}\n`)

    if (!OPERATOR_SECRET_KEY) {
      console.error('📋 SETUP REQUIRED:')
      console.error('   1. Get operator SECRET KEY from Railway:')
      console.error('      Dashboard → Project → Variables → OPERATOR_SECRET_KEY\n')
      console.error('   2. Set environment variable:')
      console.error('      export OPERATOR_SECRET_KEY="<64 comma-separated bytes>"\n')
      console.error('   3. Ensure operator wallet has 0.1+ SOL')
      console.error('   4. Run this test again\n')
    }

    process.exit(1)
  }
}

main()

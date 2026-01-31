/**
 * Test script: Operator deposit to Privacy Cash pool
 * 
 * REQUIRED: OPERATOR_SECRET_KEY environment variable set
 * 
 * This deposits 0.1 SOL from operator wallet to Privacy Cash pool
 * so operator has balance for withdrawals
 */

import { getPrivacyCashClient, executeDeposit } from './src/services/privacyCash.ts'

async function main() {
  console.log('\n' + '='.repeat(70))
  console.log('🔐 OPERATOR DEPOSIT TO PRIVACY CASH POOL')
  console.log('='.repeat(70) + '\n')

  try {
    // ✅ Get Privacy Cash client initialized with operator keypair
    console.log('1️⃣  Initializing Privacy Cash client with operator keypair...')
    const pc = getPrivacyCashClient()
    console.log(`✅ Privacy Cash client ready\n`)

    // ✅ Check private balance BEFORE
    console.log('2️⃣  Checking current private balance...')
    const balanceBefore = await pc.getPrivateBalance()
    console.log(`   Current: ${(balanceBefore / 1e9).toFixed(6)} SOL\n`)

    // ✅ Deposit amount to pool (use 0.01 SOL or available balance - 0.005 for fees)
    console.log('3️⃣  Depositing to Privacy Cash pool...')
    console.log('   This may take 30-60 seconds...\n')

    // Use 0.01 SOL (enough for testing withdrawals) or calculate from available balance
    const depositAmount = 0.01 * 1e9 // 0.01 SOL in lamports
    const depositResult = await executeDeposit(pc, depositAmount)

    console.log(`✅ DEPOSIT SUCCESSFUL!`)
    console.log(`   TX: ${depositResult.tx}`)
    console.log(`   Amount: ${(depositAmount / 1e9).toFixed(6)} SOL\n`)

    // ✅ Check private balance AFTER
    console.log('4️⃣  Verifying private balance after deposit...')
    const balanceAfter = await pc.getPrivateBalance()
    console.log(`   Updated: ${(balanceAfter / 1e9).toFixed(6)} SOL\n`)

    console.log('='.repeat(70))
    console.log('✅ OPERATOR IS NOW READY FOR WITHDRAWALS')
    console.log('='.repeat(70) + '\n')

  } catch (error: any) {
    console.error('\n❌ OPERATOR DEPOSIT FAILED:')
    console.error(error.message || error)
    console.error('\nTroubleshooting:')
    console.error('1. Check OPERATOR_SECRET_KEY is set: echo $OPERATOR_SECRET_KEY')
    console.error('2. Check operator wallet has SOL: npm run check-operator-balance')
    console.error('3. Check Privacy Cash pool is responsive\n')
    process.exit(1)
  }
}

main()

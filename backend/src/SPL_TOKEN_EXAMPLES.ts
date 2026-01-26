/**
 * SPL Token Integration Examples
 * Complete working examples for SPL token operations with Privacy Cash SDK
 */

// Example 1: Deposit USDC
export async function depositUSDCExample() {
  const { getPrivacyCashClient, depositUSDC } = await import('./services/privacyCash.js')

  try {
    const pc = getPrivacyCashClient()

    // Deposit 10 USDC (USDC has 6 decimals, so 10 USDC = 10,000,000 base units)
    const result = await depositUSDC(pc, 10_000_000)

    console.log('✅ USDC deposit successful!')
    console.log(`   Transaction: ${result.tx}`)

    return result
  } catch (error) {
    console.error('❌ USDC deposit failed:', error)
  }
}

// Example 2: Deposit USDT
export async function depositUSDTExample() {
  const { getPrivacyCashClient, depositSPLToken } = await import('./services/privacyCash.js')

  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

  try {
    const pc = getPrivacyCashClient()

    // Deposit 50 USDT using human-readable amount
    const result = await depositSPLToken(pc, USDT_MINT, 50) // 50 USDT

    console.log('✅ USDT deposit successful!')
    console.log(`   Transaction: ${result.tx}`)

    return result
  } catch (error) {
    console.error('❌ USDT deposit failed:', error)
  }
}

// Example 3: Withdraw USDC to recipient
export async function withdrawUSDCExample() {
  const { getPrivacyCashClient, withdrawUSDC } = await import('./services/privacyCash.js')

  try {
    const pc = getPrivacyCashClient()
    const RECIPIENT_ADDRESS = 'Hs1X...' // Replace with actual recipient

    // Withdraw 25 USDC (25,000,000 base units)
    const result = await withdrawUSDC(pc, 25_000_000, RECIPIENT_ADDRESS)

    console.log('✅ USDC withdrawal successful!')
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Recipient: ${result.recipient}`)
    console.log(`   Received: ${result.base_units} base units (${result.base_units / 1e6} USDC)`)
    console.log(`   Fee: ${result.fee_base_units} base units (${result.fee_base_units / 1e6} USDC)`)

    return result
  } catch (error) {
    console.error('❌ USDC withdrawal failed:', error)
  }
}

// Example 4: Withdraw USDT to recipient
export async function withdrawUSDTExample() {
  const { getPrivacyCashClient, withdrawSPLToken } = await import('./services/privacyCash.js')

  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

  try {
    const pc = getPrivacyCashClient()
    const RECIPIENT_ADDRESS = 'Hs1X...' // Replace with actual recipient

    // Withdraw 100 USDT using human-readable amount
    const result = await withdrawSPLToken(pc, USDT_MINT, 100, undefined, RECIPIENT_ADDRESS)

    console.log('✅ USDT withdrawal successful!')
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Received: ${result.base_units / 1e6} USDT`)

    return result
  } catch (error) {
    console.error('❌ USDT withdrawal failed:', error)
  }
}

// Example 5: Check USDC balance
export async function checkUSDCBalanceExample() {
  const { getPrivacyCashClient, queryUSDCBalance } = await import('./services/privacyCash.js')

  try {
    const pc = getPrivacyCashClient()

    const balance = await queryUSDCBalance(pc)

    console.log('✅ USDC balance retrieved!')
    console.log(`   Balance: ${balance.baseUnits} base units`)
    console.log(`   Amount: ${balance.baseUnits / 1e6} USDC`)

    return balance
  } catch (error) {
    console.error('❌ Balance check failed:', error)
  }
}

// Example 6: Check SPL token balance (any supported token)
export async function checkSPLBalanceExample() {
  const { getPrivacyCashClient, querySPLBalance } = await import('./services/privacyCash.js')

  const ZEC_MINT = 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS'

  try {
    const pc = getPrivacyCashClient()

    const balance = await querySPLBalance(pc, ZEC_MINT)

    console.log('✅ ZEC balance retrieved!')
    console.log(`   Balance: ${balance.formatted}`)

    return balance
  } catch (error) {
    console.error('❌ Balance check failed:', error)
  }
}

// Example 7: Process withdrawal with full workflow
export async function fullWithdrawalWorkflowExample() {
  const { processSPLTokenWithdrawal, estimateSPLTokenWithdrawalFee } = await import('./utils/splTokenWithdrawal.js')

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const RECIPIENT_ADDRESS = 'Hs1X...' // Replace with actual recipient

  try {
    // Get fee estimate first
    console.log('📊 Getting fee estimate...')
    const feeEstimate = await estimateSPLTokenWithdrawalFee(USDC_MINT, 10) // 10 USDC

    console.log('Fee Estimate:')
    console.log(`   Amount: ${feeEstimate.amount}`)
    console.log(`   Fee: ${feeEstimate.estimatedTotalFee}`)
    console.log(`   You'll receive: ${feeEstimate.estimatedNetAmount}`)

    // Process withdrawal
    console.log('\n💸 Processing withdrawal...')
    const result = await processSPLTokenWithdrawal(USDC_MINT, 10, undefined, RECIPIENT_ADDRESS)

    console.log('\n✅ Withdrawal complete!')
    console.log(`   TX: ${result.tx}`)
    console.log(`   Received: ${result.baseUnitsReceived / 1e6} USDC`)
    console.log(`   Fee: ${result.baseFeeCharged / 1e6} USDC`)

    return result
  } catch (error) {
    console.error('❌ Workflow failed:', error)
  }
}

// Example 8: List all supported tokens
export async function listSupportedTokensExample() {
  const { getSupportedSPLTokensList } = await import('./utils/splTokenWithdrawal.js')

  const tokens = getSupportedSPLTokensList()

  console.log('📋 Supported SPL Tokens:')
  console.log('=====================================')

  tokens.forEach(token => {
    console.log(`\n${token.symbol} - ${token.name}`)
    console.log(`   Mint: ${token.mint}`)
    console.log(`   Decimals: ${token.decimals}`)
    console.log(`   Deposit Fee: ${token.depositFee}`)
    console.log(`   Withdrawal Fee: ${token.withdrawalFee}`)
  })

  return tokens
}

// Example 9: Multi-token withdrawal (USDC and USDT)
export async function multiTokenWithdrawalExample() {
  const { getPrivacyCashClient, withdrawSPLToken } = await import('./services/privacyCash.js')

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  const RECIPIENT_ADDRESS = 'Hs1X...' // Replace with actual recipient

  try {
    const pc = getPrivacyCashClient()

    console.log('💸 Withdrawing multiple tokens...\n')

    // Withdraw USDC
    console.log('1. Withdrawing USDC...')
    const usdcResult = await withdrawSPLToken(pc, USDC_MINT, 5, undefined, RECIPIENT_ADDRESS) // 5 USDC

    console.log(`   ✅ ${usdcResult.base_units / 1e6} USDC withdrawn`)
    console.log(`   TX: ${usdcResult.tx}\n`)

    // Withdraw USDT
    console.log('2. Withdrawing USDT...')
    const usdtResult = await withdrawSPLToken(pc, USDT_MINT, 10, undefined, RECIPIENT_ADDRESS) // 10 USDT

    console.log(`   ✅ ${usdtResult.base_units / 1e6} USDT withdrawn`)
    console.log(`   TX: ${usdtResult.tx}`)

    return {
      usdc: usdcResult,
      usdt: usdtResult,
    }
  } catch (error) {
    console.error('❌ Multi-token withdrawal failed:', error)
  }
}

// Example 10: SPL token deposit and withdrawal flow
export async function completeTokenFlowExample() {
  const { getPrivacyCashClient, depositSPLToken, withdrawSPLToken, querySPLBalance } = await import(
    './services/privacyCash.js'
  )

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const RECIPIENT_ADDRESS = 'Hs1X...' // Replace with actual recipient

  try {
    const pc = getPrivacyCashClient()

    // Check initial balance
    console.log('1️⃣  Checking initial USDC balance...')
    let balance = await querySPLBalance(pc, USDC_MINT)
    console.log(`   Initial: ${balance.baseUnits / 1e6} USDC\n`)

    // Deposit USDC
    console.log('2️⃣  Depositing 20 USDC...')
    const depositResult = await depositSPLToken(pc, USDC_MINT, 20)
    console.log(`   ✅ Deposit TX: ${depositResult.tx}\n`)

    // Check balance after deposit
    console.log('3️⃣  Checking balance after deposit...')
    balance = await querySPLBalance(pc, USDC_MINT)
    console.log(`   After deposit: ${balance.baseUnits / 1e6} USDC\n`)

    // Withdraw USDC
    console.log('4️⃣  Withdrawing 20 USDC...')
    const withdrawResult = await withdrawSPLToken(pc, USDC_MINT, 20, undefined, RECIPIENT_ADDRESS)
    console.log(`   ✅ Withdraw TX: ${withdrawResult.tx}`)
    console.log(`   Recipient received: ${withdrawResult.base_units / 1e6} USDC`)
    console.log(`   Fee: ${withdrawResult.fee_base_units / 1e6} USDC\n`)

    // Final balance
    console.log('5️⃣  Final balance...')
    balance = await querySPLBalance(pc, USDC_MINT)
    console.log(`   Final: ${balance.baseUnits / 1e6} USDC`)

    return {
      depositTx: depositResult.tx,
      withdrawTx: withdrawResult.tx,
      finalBalance: balance.baseUnits,
    }
  } catch (error) {
    console.error('❌ Flow failed:', error)
  }
}

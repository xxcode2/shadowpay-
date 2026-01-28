import { CONFIG } from '../config'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
}

/**
 * ✅ REAL PRIVACY CASH SDK - FRONTEND DIRECT
 * 
 * This is the CORRECT way to use Privacy Cash SDK.
 * SDK must run where the user's wallet is (Frontend with Phantom)
 * 
 * Flow:
 * 1. Frontend: Initialize Privacy Cash SDK with User's wallet
 * 2. Frontend: Call SDK.deposit() - SDK generates ZK proof + creates transaction
 * 3. SDK: Prompts user to sign in Phantom
 * 4. User: Approves signature
 * 5. SDK: Returns signed transaction
 * 6. Frontend: Get transaction signature
 * 7. Frontend: Send transaction hash to backend for recording
 * 8. Backend: Just records in database
 * 
 * Key Points:
 * - SDK runs on Frontend (where user's Phantom wallet is connected)
 * - User signs transaction locally with their private key
 * - User pays all transaction fees
 * - All Privacy Cash ZK logic handled by SDK
 * - Backend just records the confirmed transaction
 */
export async function executeUserPaysDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  const { linkId, amount, publicKey } = request
  const lamports = Math.round(parseFloat(amount) * 1e9)

  console.log('\n💰 Processing payment (PRIVACY CASH SDK)...')
  console.log(`   📋 Step 1: Initialize Privacy Cash SDK`)
  console.log(`   🔐 Step 2: Generate ZK proof`)
  console.log(`   ✍️  Step 3: You sign transaction`)
  console.log(`   📤 Step 4: Backend records`)

  try {
    // ✅ STEP 1: Check balance first
    console.log('\n🔍 Step 1: Checking your wallet balance...')
    console.log(`   Amount needed: ${amount} SOL + ~0.002 SOL fees`)
    
    const rpcUrl = process.env.VITE_SOLANA_RPC_URL || CONFIG.SOLANA_RPC_URL || 
      'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'
    
    const connection = new Connection(rpcUrl)
    const balance = await connection.getBalance(wallet.publicKey)
    const balanceSOL = balance / LAMPORTS_PER_SOL
    
    console.log(`   Your balance: ${balanceSOL.toFixed(6)} SOL`)
    
    const estimatedFees = 2_000_000 // ~0.002 SOL
    const totalNeeded = lamports + estimatedFees
    const totalNeededSOL = totalNeeded / LAMPORTS_PER_SOL
    
    if (balance < totalNeeded) {
      const shortfall = (totalNeeded - balance) / LAMPORTS_PER_SOL
      throw new Error(
        `Insufficient balance. You have ${balanceSOL.toFixed(6)} SOL, ` +
        `but need ${totalNeededSOL.toFixed(6)} SOL ` +
        `(${parseFloat(amount).toFixed(6)} SOL deposit + 0.002 SOL fees). ` +
        `Please add ${shortfall.toFixed(6)} SOL to your wallet.`
      )
    }
    
    console.log(`   ✅ Balance sufficient\n`)

    // ✅ STEP 2: Import and initialize Privacy Cash SDK
    console.log(`🔐 Step 2: Initializing Privacy Cash SDK...`)
    
    let PrivacyCash
    try {
      // @ts-ignore - privacycash module types may vary
      const pcModule = await import('privacycash')
      // @ts-ignore - trying different export patterns
      PrivacyCash = pcModule.PrivacyCash || pcModule.default || (pcModule as any)
      if (!PrivacyCash) {
        throw new Error('Could not find PrivacyCash in module')
      }
      console.log(`   ✅ SDK imported`)
    } catch (importErr: any) {
      throw new Error(`Failed to import Privacy Cash SDK: ${importErr.message}`)
    }

    // Initialize SDK with USER's wallet (not operator's!)
    console.log(`   Initializing with your Phantom wallet...`)
    let privacyCashClient
    try {
      privacyCashClient = new PrivacyCash({
        RPC_url: rpcUrl,
        owner: wallet,  // USER's wallet adapter from Phantom
        enableDebug: false,
      })
      console.log(`   ✅ SDK initialized with your wallet`)
    } catch (initErr: any) {
      throw new Error(`SDK initialization failed: ${initErr.message}`)
    }

    // ✅ STEP 3: Call SDK.deposit() - this will prompt user to sign in Phantom
    console.log(`\n💰 Step 3: Generating ZK proof and creating transaction...`)
    console.log(`   Calling SDK.deposit(${lamports} lamports)...`)
    console.log(`   This will prompt you to sign in Phantom...`)
    
    let depositResult
    try {
      // Call SDK deposit - this is where user signs locally in Phantom
      depositResult = await privacyCashClient.deposit({
        lamports,
      })
      
      console.log(`   ✅ Proof generated and signed`)
      console.log(`   ✅ Transaction created and signed`)
      
      if (!depositResult || (!(depositResult as any).tx && !(depositResult as any).transaction)) {
        throw new Error('SDK returned invalid response - no transaction')
      }
      
      const txHash = (depositResult as any).tx || (depositResult as any).transaction
      console.log(`   ✅ Transaction: ${typeof txHash === 'string' ? txHash.substring(0, 20) + '...' : 'received'}`)
      
    } catch (sdkErr: any) {
      // Check if user rejected in Phantom
      if (sdkErr.message.includes('rejected') || sdkErr.message.includes('Rejected')) {
        throw new Error('You rejected the transaction in Phantom. Deposit cancelled.')
      }
      if (sdkErr.message.includes('timeout')) {
        throw new Error('Transaction signing timed out - please try again')
      }
      throw new Error(`SDK deposit failed: ${sdkErr.message}`)
    }

    // ✅ STEP 4: Extract transaction and send to backend for recording
    console.log(`\n📤 Step 4: Recording deposit with backend...`)
    
    const txHash = (depositResult as any).tx || (depositResult as any).transaction
    const recordPayload = {
      linkId,
      amount: parseFloat(amount),
      lamports,
      publicKey,
      signedTransaction: txHash,
    }

    try {
      const recordResponse = await fetch(
        `${CONFIG.BACKEND_URL}/api/deposit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordPayload),
        }
      )

      if (!recordResponse.ok) {
        const errorData = await recordResponse.json().catch(() => ({}))
        console.warn('⚠️  Backend recording warning:', errorData.error)
        // Continue anyway - transaction is already on blockchain
      } else {
        const recordData = await recordResponse.json()
        console.log(`   ✅ Backend recorded`)
      }
    } catch (recordErr) {
      console.warn('⚠️  Could not record with backend:', recordErr)
      // Transaction is on blockchain even if recording fails
    }

    // ✅ SUCCESS
    const explorerUrl = `https://solscan.io/tx/${txHash}`
    const successMsg = `✅ Deposit successful! ${amount} SOL deposited to Privacy Cash.`
    console.log(`\n✅ DEPOSIT COMPLETE`)
    console.log(`   Amount: ${amount} SOL`)
    console.log(`   Transaction: ${txHash.substring(0, 20)}...`)
    console.log(`   Explorer: ${explorerUrl}`)
    
    showSuccess(`${successMsg} View transaction: ${explorerUrl}`)
    
    return txHash

  } catch (error: any) {
    const errorMsg = error.message || 'Deposit failed'
    console.error(`\n❌ DEPOSIT ERROR:`, errorMsg)
    showError(`❌ Deposit failed: ${errorMsg}`)
    throw error
  }
}

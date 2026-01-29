/**
 * ✅ v3.0: EXECUTE LINK CLAIM + AUTO-WITHDRAW
 * 
 * Flow:
 * 1. Frontend: Call backend to claim link (marks as claimed)
 * 2. Frontend: Uses Privacy Cash SDK to auto-withdraw from shielded pool
 * 3. Funds received in recipient wallet automatically
 * 
 * No backend withdrawal needed - user withdraws themselves using their keys!
 */

import { autoWithdrawFromPrivacyCash } from './autoWithdraw.js'

export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
  userPrivateKey?: Uint8Array | number[] // Optional: for auto-withdrawal
}) {
  const { linkId, recipientAddress, userPrivateKey } = input

  // ✅ FRONTEND VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('❌ Missing or invalid linkId')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('❌ Missing recipientAddress')
  }

  // Solana addresses are 32-58 characters base58
  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('❌ Invalid Solana wallet address format (incorrect length)')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log(`🚀 Claiming link ${linkId} for ${recipientAddress}...`)

  try {
    // ✅ STEP 1: Fetch link details from backend
    console.log('📋 Step 1: Fetching link details...')
    const linkResponse = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!linkResponse.ok) {
      const err = await linkResponse.json()
      throw new Error(err.error || 'Link not found')
    }

    const linkData = await linkResponse.json()

    if (linkData.claimed) {
      throw new Error('❌ This link has already been claimed!')
    }

    console.log(`   ✅ Link found: ${linkData.amount} SOL`)

    // ✅ STEP 2: Claim link with backend (just mark as claimed)
    console.log('🔓 Step 2: Claiming link on backend...')

    const claimRes = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        recipientAddress,
      }),
    })

    if (!claimRes.ok) {
      let errorMsg = `Claim failed with status ${claimRes.status}`
      
      try {
        const contentType = claimRes.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const errorData = await claimRes.json()
          console.error('❌ Claim failed with details:', errorData)
          errorMsg = errorData.error || errorMsg

          // Friendly error messages
          if (errorMsg.toLowerCase().includes('no valid deposit')) {
            errorMsg = `⏳ Deposit still processing. Wait 30-60 seconds and try again.`
          } else if (errorMsg.toLowerCase().includes('already claimed')) {
            errorMsg = '❌ This link has already been claimed!'
          } else if (errorMsg.toLowerCase().includes('not found')) {
            errorMsg = '❌ This link does not exist. Please check the link ID.'
          } else if (errorMsg.toLowerCase().includes('invalid solana')) {
            errorMsg = '❌ Invalid wallet address. Please check your Solana address.'
          }
        }
      } catch (parseErr: any) {
        console.error('⚠️ Could not parse error response:', parseErr.message)
      }

      throw new Error(errorMsg)
    }

    const claimData = await claimRes.json()
    console.log(`   ✅ Link claimed on backend!`)
    console.log(`   📝 Amount to withdraw: ${claimData.amount} SOL`)

    // ✅ STEP 3: AUTO-WITHDRAW FROM PRIVACY CASH
    console.log('💰 Step 3: Processing withdrawal from Privacy Cash...')

    // If user provided private key, auto-withdraw
    if (userPrivateKey) {
      console.log(`   🔐 Auto-withdrawing with your keypair...`)
      const withdrawResult = await autoWithdrawFromPrivacyCash({
        amount: claimData.amount,
        recipientAddress,
        userPrivateKey
      })

      return {
        success: true,
        claimed: true,
        withdrawn: true,
        linkId: claimData.linkId,
        amount: claimData.amount,
        withdrawTx: withdrawResult.tx,
        amountReceived: withdrawResult.amountReceived,
        feesPaid: withdrawResult.feesPaid,
        message: 'Link claimed and funds withdrawn successfully!'
      }
    }

    // Otherwise, show manual withdrawal instructions
    else {
      console.log(`\n📋 NEXT STEP: Recipient Must Withdraw from Privacy Cash`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Your link has been claimed! Now you need to withdraw your funds.`)
      console.log(`\n💡 Quick Options:`)
      console.log(`   1. Use Privacy Cash Web UI: https://www.privacycash.net`)
      console.log(`   2. Use CLI with: autoWithdrawFromPrivacyCash(...)`)
      console.log(`   3. Manual SDK: const result = await client.withdraw({...})`)
      console.log(`\n📊 Withdrawal Info:`)
      console.log(`   Amount: ${claimData.amount} SOL`)
      console.log(`   Recipient: ${recipientAddress}`)
      console.log(`   Fees: 0.006 SOL base + 0.35% of amount`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

      return {
        success: true,
        claimed: true,
        withdrawn: false,
        linkId: claimData.linkId,
        amount: claimData.amount,
        depositTx: claimData.depositTx,
        requiresManualWithdrawal: true,
        message: 'Link claimed! Follow the instructions above to withdraw your funds.'
      }
    }

  } catch (err: any) {
    console.error('❌ Claim link error:', err.message || err.toString())
    throw new Error(`❌ Claim failed: ${err.message || 'Unknown error'}`)
  }
}

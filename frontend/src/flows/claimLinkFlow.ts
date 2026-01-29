/**
 * ✅ v3.0: ONE-CLICK CLAIM + AUTO-WITHDRAW
 * 
 * Super simple flow:
 * 1. User connects wallet (Phantom/Solflare)
 * 2. User clicks "Claim & Withdraw"
 * 3. Backend claims the link
 * 4. Frontend auto-withdraws to the connected wallet
 * 5. Funds appear in wallet!
 * 
 * That's it - completely automatic!
 */

import { autoWithdrawToConnectedWallet } from './autoWithdraw'

export async function executeClaimLink(input: {
  linkId: string
  recipientAddress?: string // Optional - uses connected wallet if not provided
}) {
  const { linkId, recipientAddress } = input

  // ✅ CHECK WALLET CONNECTED
  const wallet = (window as any).solana
  if (!wallet || !wallet.isConnected) {
    throw new Error('❌ Please connect your wallet first (Phantom or Solflare)')
  }

  const userWallet = wallet.publicKey?.toString()
  if (!userWallet) {
    throw new Error('❌ Could not get wallet address. Please reconnect.')
  }

  // Use connected wallet as recipient if not specified
  const finalRecipient = recipientAddress || userWallet

  // ✅ FRONTEND VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('❌ Missing or invalid linkId')
  }

  // Solana addresses are 32-58 characters base58
  if (finalRecipient.length < 32 || finalRecipient.length > 58) {
    throw new Error('❌ Invalid Solana wallet address format')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log('\n' + '='.repeat(70))
  console.log('🚀 CLAIM & WITHDRAW - ONE CLICK')
  console.log('='.repeat(70) + '\n')
  console.log(`📱 Connected Wallet: ${userWallet}`)
  console.log(`🔗 Link ID: ${linkId}`)
  console.log(`💰 Destination: ${finalRecipient}\n`)

  try {
    // ✅ STEP 1: Fetch link details from backend
    console.log('📋 STEP 1: Fetching link details...')
    const linkResponse = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!linkResponse.ok) {
      const err = await linkResponse.json()
      throw new Error(err.error || 'Link not found')
    }

    const linkData = await linkResponse.json()

    if (linkData.claimed) {
      throw new Error('❌ This link has already been claimed!')
    }

    console.log(`   ✅ Found: ${linkData.amount} SOL`)

    // ✅ STEP 2: Claim link with backend (just mark as claimed)
    console.log('\n🔓 STEP 2: Claiming link on backend...')

    const claimRes = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        recipientAddress: finalRecipient,
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
    console.log(`   ✅ Link claimed! Amount: ${claimData.amount} SOL`)

    // ✅ STEP 3: AUTO-WITHDRAW TO CONNECTED WALLET
    console.log('\n💳 STEP 3: Auto-withdrawing from Privacy Cash...')

    try {
      const withdrawResult = await autoWithdrawToConnectedWallet({
        amount: claimData.amount,
        recipientAddress: finalRecipient
      })

      console.log('\n' + '='.repeat(70))
      console.log('✅ SUCCESS! Link Claimed & Withdrawn!')
      console.log('='.repeat(70))
      console.log(`\n📥 Amount Received: ${withdrawResult.amountReceived.toFixed(6)} SOL`)
      console.log(`💱 Fees Paid: ${withdrawResult.feesPaid.toFixed(6)} SOL`)
      console.log(`🔗 View Tx: https://solscan.io/tx/${withdrawResult.tx}`)
      console.log(`\n⏳ Funds should arrive in your wallet shortly!\n`)

      return {
        success: true,
        claimed: true,
        withdrawn: true,
        linkId: claimData.linkId,
        amount: claimData.amount,
        amountReceived: withdrawResult.amountReceived,
        feesPaid: withdrawResult.feesPaid,
        withdrawTx: withdrawResult.tx,
        recipient: finalRecipient,
        message: '✅ Claimed and withdrawn successfully!'
      }
    } catch (withdrawErr: any) {
      console.error('❌ Withdrawal failed:', withdrawErr.message)
      
      // Claim succeeded but withdrawal failed - still good progress
      console.log('\n⚠️ Claim succeeded but withdrawal needs manual action.')
      console.log('You can still withdraw manually from Privacy Cash web UI:')
      console.log('   https://www.privacycash.net')

      return {
        success: false,
        claimed: true,
        withdrawn: false,
        linkId: claimData.linkId,
        amount: claimData.amount,
        depositTx: claimData.depositTx,
        error: withdrawErr.message,
        message: 'Link claimed! Please complete withdrawal manually at privacycash.net'
      }
    }


  } catch (err: any) {
    console.error('❌ Error:', err.message || err.toString())
    throw new Error(`❌ ${err.message || 'Unknown error'}`)
  }
}

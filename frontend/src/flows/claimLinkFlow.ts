/**
 * ✅ v4.0: CLAIM & AUTO-WITHDRAW IN ONE CLICK
 * 
 * Super simple:
 * 1. User connects wallet
 * 2. User clicks "Claim"
 * 3. Backend validates, claims, AND withdraws directly to wallet
 * 4. Done! SOL in wallet!
 * 
 * All-in-one on backend - NO MANUAL WITHDRAWAL NEEDED!
 */

export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
}) {
  const { linkId, recipientAddress } = input

  // ✅ VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('❌ Missing or invalid linkId')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('❌ Missing or invalid wallet address')
  }

  // Solana address check
  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('❌ Invalid Solana wallet address')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log('\n' + '='.repeat(70))
  console.log('🎯 CLAIM & WITHDRAW - ONE CLICK')
  console.log('='.repeat(70) + '\n')
  console.log(`📱 Wallet: ${recipientAddress}`)
  console.log(`🔗 Link ID: ${linkId}\n`)

  try {
    // STEP 1: Fetch link details
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

    // STEP 2: Claim link + backend withdraws to wallet
    console.log('\n🔓 STEP 2: Claiming link (backend will auto-withdraw)...')

    const claimRes = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          errorMsg = errorData.error || errorMsg
        }
      } catch {}

      throw new Error(errorMsg)
    }

    const claimData = await claimRes.json()

    // SUCCESS!
    if (claimData.withdrawn) {
      console.log('\n' + '='.repeat(70))
      console.log('✅ SUCCESS! LINK CLAIMED & SOL SENT TO WALLET!')
      console.log('='.repeat(70))
      console.log(`\n💸 Transaction: ${claimData.withdrawTx}`)
      console.log(`📥 Amount Received: ${claimData.amountReceived.toFixed(6)} SOL`)
      console.log(`💱 Fee Paid: ${claimData.feePaid.toFixed(6)} SOL`)
      console.log(`⏳ Check wallet in 30-60 seconds!`)
      console.log(`\n🔗 View on Solscan: https://solscan.io/tx/${claimData.withdrawTx}\n`)

      return {
        success: true,
        claimed: true,
        withdrawn: true,
        linkId,
        amount: claimData.amount,
        amountReceived: claimData.amountReceived,
        feePaid: claimData.feePaid,
        withdrawTx: claimData.withdrawTx,
        message: '✅ Link claimed and SOL sent to your wallet!',
      }
    } else {
      // Fallback: claim succeeded but withdrawal failed
      console.log('\n⚠️ Link claimed but withdrawal needs manual action.')
      console.log('Contact support with Link ID:', linkId)

      return {
        success: false,
        claimed: true,
        withdrawn: false,
        linkId,
        amount: claimData.amount,
        message: 'Link claimed but withdrawal failed. Please contact support.',
        error: claimData.error,
      }
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    throw new Error(`❌ ${err.message || 'Unknown error'}`)
  }
}

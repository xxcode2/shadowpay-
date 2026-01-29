/**
 * ✅ v5.0: NON-CUSTODIAL CLAIM FLOW
 * 
 * Backend ONLY marks link as claimed
 * User MUST withdraw themselves from Private Cash
 * 
 * 2-STEP PROCESS:
 * 1. Claim link (backend)
 * 2. Withdraw from pool (user frontend/web UI)
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

  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('❌ Invalid Solana wallet address')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log('\n' + '='.repeat(70))
  console.log('📋 CLAIMING PAYMENT LINK')
  console.log('='.repeat(70) + '\n')
  console.log(`🔗 Link ID: ${linkId}`)
  console.log(`📱 Recipient: ${recipientAddress}\n`)

  try {
    // STEP 1: Fetch link details
    console.log('STEP 1: Fetching link details...')
    const linkResponse = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!linkResponse.ok) {
      const err = await linkResponse.json()
      throw new Error(err.error || 'Link not found')
    }

    const linkData = await linkResponse.json()

    if (linkData.claimed) {
      throw new Error('❌ This link has already been claimed!')
    }

    console.log(`✅ Found: ${linkData.amount} SOL\n`)

    // STEP 2: Claim link (backend only marks as claimed)
    console.log('STEP 2: Claiming link on backend...')

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

    console.log(`✅ Link claimed successfully!\n`)

    // SUCCESS - show withdrawal instructions
    console.log('='.repeat(70))
    console.log('✅ LINK CLAIMED!')
    console.log('='.repeat(70))
    console.log(`\n💰 Amount: ${claimData.amount} SOL`)
    console.log(`📍 Deposit TX: ${claimData.depositTx}`)
    console.log(`⏰ Claimed at: ${claimData.claimedAt}\n`)

    console.log('📌 NEXT STEP: Withdraw from Private Cash Pool\n')
    
    if (claimData.withdrawalOptions) {
      console.log('OPTION 1: Easy (Web UI)')
      console.log(`  → Visit ${claimData.withdrawalOptions.option1.url}`)
      console.log('  → Connect your wallet')
      console.log(`  → Withdraw ${claimData.amount} SOL`)
      console.log('  → Funds arrive in 30-60 seconds\n')

      console.log('OPTION 2: Advanced (SDK)')
      console.log('  → Use Privacy Cash SDK from your application')
      console.log(`  → Code example in response.withdrawalOptions.option2.code\n`)
    }

    console.log('='.repeat(70) + '\n')

    return {
      success: true,
      claimed: true,
      linkId,
      amount: claimData.amount,
      depositTx: claimData.depositTx,
      recipientAddress,
      claimedAt: claimData.claimedAt,
      message: '✅ Link claimed! Now withdraw from Private Cash pool.',
      withdrawalOptions: claimData.withdrawalOptions,
      nextSteps: claimData.nextSteps
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    throw new Error(`❌ ${err.message || 'Unknown error'}`)
  }
}

/**
 * Execute link claim and withdrawal
 * 
 * Frontend sends:
 * - linkId: The link to claim
 * - recipientAddress: Where to send the funds
 * 
 * Backend executes REAL PrivacyCash.withdraw() as RELAYER
 */
export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
}) {
  const { linkId, recipientAddress } = input

  // ✅ FRONTEND VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('Missing or invalid linkId')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('Missing recipientAddress')
  }

  // ✅ BASIC SOLANA ADDRESS FORMAT CHECK (optional, backend validates too)
  // Solana addresses are 32-58 characters base58
  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('Invalid Solana wallet address format (incorrect length)')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log(`🚀 Claiming link ${linkId} for ${recipientAddress}...`)

  try {
    const res = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        recipientAddress,
      }),
    })

    // ✅ HANDLE ERROR RESPONSES WITH PROPER PARSING
    if (!res.ok) {
      try {
        const errorData = await res.json()
        console.error('❌ Claim failed with details:', errorData)

        // Provide user-friendly error messages
        let errorMsg = errorData.error || `Claim failed with status ${res.status}`

        if (errorMsg.includes('no valid deposit')) {
          errorMsg = 'Deposit still processing. Please wait 1-2 minutes and try again.'
        } else if (errorMsg.includes('already claimed')) {
          errorMsg = 'This link has already been claimed!'
        } else if (errorMsg.includes('not found')) {
          errorMsg = 'This link does not exist. Please check the link ID.'
        } else if (errorMsg.includes('Invalid Solana')) {
          errorMsg = 'Invalid wallet address. Please check your Solana address.'
        }

        throw new Error(errorMsg)
      } catch (parseErr: any) {
        // If not JSON, try text response
        const errorText = await res.text()
        console.error('❌ Raw error response:', errorText)
        throw new Error(`Claim failed: ${errorText || 'Unknown error'}`)
      }
    }

    const data = await res.json()
    console.log(`✅ Withdrawal completed: ${data.withdrawTx}`)

    return {
      success: true,
      withdrawTx: data.withdrawTx,
      linkId: data.linkId,
    }
  } catch (err: any) {
    console.error('❌ Claim link error:', err.message || err.toString())
    throw new Error(`Claim failed: ${err.message || 'Unknown error'}`)
  }
}

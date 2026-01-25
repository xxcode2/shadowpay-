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

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  if (import.meta.env.DEV) console.log(`🚀 Claiming link ${linkId} for ${recipientAddress}...`)

  try {
    const res = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId,
        recipientAddress,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Claim failed: ${error}`)
    }

    const data = await res.json()
    if (import.meta.env.DEV) console.log(`✅ Withdrawal completed: ${data.withdrawTx}`)

    return {
      success: true,
      withdrawTx: data.withdrawTx,
    }
  } catch (err: any) {
    if (import.meta.env.DEV) console.error('❌ Claim link error:', err.message)
    throw err
  }
}

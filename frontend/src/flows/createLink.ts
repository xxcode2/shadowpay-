/**
 * ✅ CORRECT ARCHITECTURE:
 * 1. Create link metadata on backend
 * 2. Execute REAL PrivacyCash deposit on FRONTEND with user wallet
 * 3. Send deposit tx hash to backend for recording
 * 4. Backend only records the transaction, does not execute anything
 */
import { executeDeposit, SigningWallet } from './depositFlow.js'

export async function createLink({
  amountSOL,
  wallet,
}: {
  amountSOL: number
  wallet: SigningWallet
}): Promise<{ linkId: string; depositTx: string }> {
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  try {
    // 1️⃣ Create link metadata on backend
    if (import.meta.env.DEV) console.log(`📝 Creating payment link for ${amountSOL} SOL...`)
    const createRes = await fetch(`${BACKEND_URL}/api/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: amountSOL, 
        assetType: 'SOL' 
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Create link failed: ${createRes.statusText}`)
    }

    const { linkId } = await createRes.json()
    if (import.meta.env.DEV) console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ EXECUTE REAL PrivacyCash deposit on FRONTEND with user wallet
    const lamports = Math.round(amountSOL * 1e9)
    if (import.meta.env.DEV) console.log(`🏦 Executing PrivacyCash deposit from your wallet...`)
    const depositTx = await executeDeposit({
      lamports,
      wallet,
    })
    console.log(`✅ Deposit executed: ${depositTx}`)

    // 3️⃣ Record deposit on backend (backend does NOT execute, only records)
    if (import.meta.env.DEV) console.log(`📡 Recording deposit on backend...`)
    const recordRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        linkId,
        depositTx, // The actual transaction hash from user's PrivacyCash deposit
        publicKey: wallet.publicKey.toString(),
        amount: amountSOL,
      }),
    })

    if (!recordRes.ok) {
      const errorText = await recordRes.text()
      throw new Error(`Backend recording failed: ${recordRes.statusText} - ${errorText}`)
    }

    const recordResult = await recordRes.json()
    console.log(`✅ Deposit recorded: ${recordResult.message}`)

    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK FLOW ERROR:', err)
    throw err
  }
}

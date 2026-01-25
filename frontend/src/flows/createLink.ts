import { executeDeposit, SigningWallet } from './depositFlow'

/**
 * Complete flow: Create link + Real deposit by USER
 * 
 * 1. Create link metadata on backend
 * 2. User executes REAL PrivacyCash deposit via Phantom
 * 3. Notify backend to record the tx hash
 */
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

    // 2️⃣ REAL deposit by USER wallet
    const lamports = Math.round(amountSOL * 1e9)
    if (import.meta.env.DEV) console.log(`💰 Prompting wallet for REAL deposit (${amountSOL} SOL)...`)
    const depositTx = await executeDeposit({ lamports, wallet })

    // 3️⃣ Notify backend to record the tx hash
    if (import.meta.env.DEV) console.log(`📡 Recording deposit tx on backend...`)
    const recordRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        linkId, 
        depositTx 
      }),
    })

    if (!recordRes.ok) {
      throw new Error(`Failed to record deposit: ${recordRes.statusText}`)
    }

    if (import.meta.env.DEV) console.log(`✅ Deposit recorded on backend`)
    return { linkId, depositTx }
  } catch (err: any) {
    if (import.meta.env.DEV) console.error('❌ CREATE LINK FLOW ERROR:', err.message)
    throw err
  }
}

/**
 * CORRECT ARCHITECTURE: Frontend signs for authorization, Backend executes with operator
 * 
 * 1. Create link metadata on backend
 * 2. User signs authorization message with Phantom (no PrivacyCash SDK in browser)
 * 3. Send authorization signature to backend
 * 4. Backend executes REAL PrivacyCash deposit with OPERATOR wallet
 */
export interface SigningWallet {
  publicKey: { toString(): string }
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

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

    // 2️⃣ User signs authorization message with Phantom
    console.log(`🔐 Signing authorization message...`)
    const message = new TextEncoder().encode(
      `Authorize deposit of ${amountSOL} SOL for link ${linkId}`
    )
    
    let signature: Uint8Array
    try {
      signature = await wallet.signMessage(message)
    } catch (signErr: any) {
      console.error('❌ USER REJECTED SIGNATURE')
      throw new Error(`Signature cancelled by user`)
    }

    console.log(`✅ Authorization signed`)

    // 3️⃣ Send authorization to backend (backend executes real deposit with operator)
    if (import.meta.env.DEV) console.log(`📡 Sending authorization to backend...`)
    const depositRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        linkId,
        signature: Array.from(signature), // Convert Uint8Array to array
        publicKey: wallet.publicKey.toString(),
        amount: amountSOL,
      }),
    })

    if (!depositRes.ok) {
      const errorText = await depositRes.text()
      throw new Error(`Backend deposit failed: ${depositRes.statusText} - ${errorText}`)
    }

    const depositResult = await depositRes.json()
    const depositTx = depositResult.depositTx

    console.log(`✅ Backend executed deposit: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK FLOW ERROR:', err)
    throw err
  }
}

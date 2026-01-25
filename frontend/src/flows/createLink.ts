/**
 * ✅ CORRECT ARCHITECTURE:
 * 1. Create link metadata on backend
 * 2. User SIGNS authorization message (NO private key needed)
 * 3. Send signature to backend
 * 4. Backend EXECUTES deposit with operator private key
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
        assetType: 'SOL',
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Create link failed: ${createRes.statusText}`)
    }

    const { linkId } = await createRes.json()
    if (import.meta.env.DEV) console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ User SIGNS authorization message (authorization only, no private key)
    if (import.meta.env.DEV) console.log(`🔐 Signing authorization message...`)
    const message = new TextEncoder().encode(
      `Authorize payment of ${amountSOL} SOL for link ${linkId}`
    )

    let signature: Uint8Array
    try {
      signature = await wallet.signMessage(message)

      // ✅ VALIDATE SIGNATURE FORMAT
      if (!signature || signature.length !== 64) {
        console.error('❌ Invalid signature length from wallet:', signature?.length)
        throw new Error(`Invalid signature format: expected 64 bytes, got ${signature?.length}`)
      }
    } catch (signErr: any) {
      console.error('❌ USER REJECTED SIGNATURE')
      throw new Error(`Signature cancelled by user`)
    }

    if (import.meta.env.DEV) {
      console.log(`✅ Authorization signed`)
      console.log(`   Signature length: ${signature.length} bytes`)
    }

    // 3️⃣ Send to backend for EXECUTION (backend has operator private key)
    if (import.meta.env.DEV) console.log(`📡 Sending to backend for deposit execution...`)
    const depositRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId,
        amount: amountSOL,
        signature: Array.from(signature), // Convert Uint8Array to array
        publicKey: wallet.publicKey.toString(),
      }),
    })

    if (!depositRes.ok) {
      const errorText = await depositRes.text()
      throw new Error(`Backend deposit failed: ${depositRes.statusText} - ${errorText}`)
    }

    const depositResult = await depositRes.json()
    const depositTx = depositResult.depositTx

    if (import.meta.env.DEV) console.log(`✅ Backend executed deposit: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK FLOW ERROR:', err)
    throw err
  }
}


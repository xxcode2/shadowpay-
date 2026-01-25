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
  memo,
}: {
  amountSOL: number
  wallet: SigningWallet
  memo?: string
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
        memo: memo || undefined, // ✅ Include memo if provided
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Create link failed: ${createRes.statusText}`)
    }

    const { linkId } = await createRes.json()
    if (import.meta.env.DEV) console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ User SIGNS authorization message (authorization only, no private key)
    if (import.meta.env.DEV) console.log(`🔐 Requesting signature from wallet...`)
    const message = new TextEncoder().encode(
      `Authorize payment of ${amountSOL} SOL for link ${linkId}`
    )

    let signature: Uint8Array
    try {
      const signResult = await wallet.signMessage(message)

      // ✅ HANDLE MULTIPLE SIGNATURE FORMAT RESPONSES
      if (signResult instanceof Uint8Array) {
        // Format: Uint8Array directly (most common)
        signature = signResult
      } else if (typeof signResult === 'object' && signResult !== null) {
        // Try to access signature property
        const result = signResult as Record<string, any>
        if (result.signature instanceof Uint8Array) {
          // Format: { signature: Uint8Array }
          signature = result.signature
        } else if (result.buffer instanceof ArrayBuffer) {
          // Format: Buffer or array-like
          signature = new Uint8Array(result.buffer)
        } else {
          console.error('❌ Unsupported signature format:', typeof signResult, signResult)
          throw new Error('Unsupported signature format from wallet')
        }
      } else {
        console.error('❌ Unsupported signature format:', typeof signResult, signResult)
        throw new Error('Unsupported signature format from wallet')
      }

      if (!signature || signature.length === 0) {
        console.error('❌ Invalid signature length from wallet:', signature?.length)
        throw new Error(`Invalid signature format: expected 64 bytes, got ${signature?.length || 0}`)
      }

      if (signature.length !== 64) {
        console.error('❌ Invalid signature size:', signature.length)
        throw new Error(`Invalid signature format: expected 64 bytes, got ${signature.length}`)
      }

      if (import.meta.env.DEV) {
        console.log(`✅ Signature obtained successfully`)
        console.log(`   Signature length: ${signature.length} bytes`)
      }
    } catch (signErr: any) {
      const errMsg = signErr?.message || 'Unknown error'
      console.error('❌ SIGNATURE ERROR:', errMsg)

      // ✅ DETECT USER REJECTION
      if (
        errMsg.toLowerCase().includes('user rejected') ||
        errMsg.toLowerCase().includes('user denied') ||
        errMsg.toLowerCase().includes('cancelled')
      ) {
        throw new Error(
          'You cancelled the signature request. Please try again and click "Approve" in your wallet popup.'
        )
      }

      if (errMsg.includes('Unsupported signature format')) {
        throw new Error(
          'Wallet signature format not supported. Try refreshing the page or using a different wallet.'
        )
      }

      throw new Error(`Failed to sign message: ${errMsg}`)
    }

    if (import.meta.env.DEV) console.log(`✅ Authorization signed`)

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


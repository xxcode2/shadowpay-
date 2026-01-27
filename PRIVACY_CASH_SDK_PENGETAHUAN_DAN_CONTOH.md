# Privacy Cash SDK - Pengetahuan & Contoh Praktis

## 📚 Daftar Isi
1. [Pengenalan Umum](#pengenalan-umum)
2. [Arsitektur Non-Custodial](#arsitektur-non-custodial)
3. [Konsep Kunci](#konsep-kunci)
4. [Contoh Implementasi Frontend](#contoh-implementasi-frontend)
5. [Contoh Implementasi Backend](#contoh-implementasi-backend)
6. [Integrasi SPL Token](#integrasi-spl-token)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Pengenalan Umum

### Apa itu Privacy Cash SDK?

**Privacy Cash SDK** adalah pustaka JavaScript/TypeScript yang mengimplementasikan protocol Privacy Cash untuk Solana. Protocol ini memungkinkan:

✅ **Deposit Private**: Mengirim dana ke Privacy Cash pool tanpa mengekspos wallet Anda  
✅ **Withdraw Aman**: Menarik dana dengan bukti zero-knowledge (tanpa reveal wallet asli)  
✅ **Multi-Aset**: Support untuk SOL, USDC, USDT, dan SPL tokens lainnya  
✅ **Non-Custodial**: Anda selalu mengontrol private key, SDK tidak pernah mengambil alih  

### Dependency yang Dibutuhkan

```json
{
  "dependencies": {
    "privacycash": "^1.1.11",
    "@solana/web3.js": "^1.98.4",
    "bn.js": "^5.2.2",
    "@ethersproject/keccak256": "^5.8.0",
    "snarkjs": "^0.7.5"
  }
}
```

### Versi SDK di Repository

```
Package Name: privacycash
Version: 1.1.11
Repository: https://github.com/Privacy-Cash/privacy-cash-sdk
```

---

## Arsitektur Non-Custodial

### Alur Deposit (User Mengirim Dana)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND - Wallet User                                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. User Connect Wallet (Phantom, Solflare, dll)                 │
│ 2. User tanda tangan message untuk derive encryption key         │
│    └─> Message: "Privacy Money account sign in"                │
│    └─> Hanya user yang punya private key untuk decrypt UTXO    │
│ 3. Generate random blinding factor untuk privacy                │
│ 4. Create UTXO dengan amount + blinding + pubkey                │
│ 5. User sign UTXO dengan wallet (transaction signature)         │
│ 6. Kirim ke backend API /api/deposit/relay                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND - Operator Relayer                                       │
├─────────────────────────────────────────────────────────────────┤
│ 7. Terima UTXO + signature dari frontend                        │
│ 8. Verify signature valid dari user                             │
│ 9. Record di database:                                          │
│    └─> linkId, UTXO data, amount, signature                    │
│ 10. Call Privacy Cash SDK: pc.deposit({ lamports })             │
│ 11. SDK creates zero-knowledge proof                            │
│ 12. SDK submit commitment ke Privacy Cash pool                  │
│ 13. Return transaction signature ke frontend                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PRIVACY CASH NETWORK                                             │
├─────────────────────────────────────────────────────────────────┤
│ • Commitment di-store di Merkle tree                            │
│ • UTXO di-encrypt dengan public key user                        │
│ • Hanya user (punya private key) bisa decrypt & withdraw        │
│ • Operator TIDAK punya custodi dana                             │
└─────────────────────────────────────────────────────────────────┘
```

### Alur Withdraw (User Menerima Dana)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND - Wallet User yang Menerima                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. User buka payment link (share dari depositor)                │
│ 2. User connect wallet mereka (beda wallet dari depositor)      │
│ 3. Masukkan recipient address (dimana mau nerima dana)          │
│ 4. Approve transaction dengan wallet                            │
│ 5. Kirim request ke backend /api/withdraw                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND - Operator Relayer                                       │
├─────────────────────────────────────────────────────────────────┤
│ 6. Terima request withdraw dari frontend                        │
│ 7. Call Privacy Cash SDK: pc.withdraw({ lamports, address })   │
│ 8. SDK creates zero-knowledge proof:                            │
│    └─> Prove punya UTXO di merkle tree                         │
│    └─> Prove belum withdraw sebelumnya (nullifier)              │
│    └─> Prove amount sesuai                                      │
│ 9. SDK submit proof ke Privacy Cash relayer                     │
│ 10. Relayer verify proof & sign transaction                     │
│ 11. Transaction broadcast ke Solana                             │
│ 12. Return transaction signature                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ SOLANA BLOCKCHAIN                                                │
├─────────────────────────────────────────────────────────────────┤
│ • Dana masuk ke recipient wallet                                │
│ • UTXO di-mark sebagai "spent" (nullifier recorded)             │
│ • Tidak bisa withdraw 2x dari UTXO yang sama                    │
│ • Seluruh transaksi tercatat di blockchain                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Konsep Kunci

### 1. Encryption Key Derivation

Setiap user mendapat encryption key unik dari wallet signature mereka:

```typescript
// User sign off-chain message ONCE
const message = new TextEncoder().encode("Privacy Money account sign in")
const signature = await wallet.signMessage(message)

// Encryption service derive encryption key dari signature
const encryptionService = new EncryptionService()
encryptionService.deriveEncryptionKeyFromSignature(signature)

// Key ini digunakan untuk:
// - Encrypt UTXO yang akan dikirim ke Privacy Cash
// - Decrypt UTXO saat user mau withdraw
// - Hanya user (punya wallet) bisa generate key ini
```

**Keamanan**: 
- Private key tetap di wallet, tidak pernah dikirim ke server
- Encryption key di-derive dari signature, bukan dari private key langsung
- Setiap user punya encryption key BERBEDA

### 2. UTXO (Unspent Transaction Output)

UTXO adalah representasi dari "uang digital private" di Privacy Cash pool:

```typescript
interface UTXO {
  amount: BN                    // Jumlah lamports/base units
  blinding: BN                  // Random secret untuk privacy
  pubkey: string               // PoseidonHash(encryption_key)
  mintAddress: string          // Token mint (So11... untuk SOL)
  index?: number               // Position di Merkle tree
  timestamp?: number           // Kapan UTXO dibuat
  keyIndex?: number            // Index di encryption key derivation
}
```

**Contoh Pembuatan UTXO**:

```typescript
import BN from 'bn.js'

// Amount: 0.1 SOL = 100,000,000 lamports
const amount = new BN(100_000_000)

// Blinding: Random secret untuk hide real amount
// Even jika attacker tahu amount, tidak bisa track dengan blinding berbeda
const blinding = new BN(Math.floor(Math.random() * 1_000_000_000))

// Public key: Hash dari encryption key user
// User generate dengan: sha256(encryption_key)
const pubkey = "8b7d9c6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c" // hex string

// Mint address: Untuk SOL
const mintAddress = "So11111111111111111111111111111111111111112"

const utxo = {
  amount,
  blinding,
  pubkey,
  mintAddress,
  timestamp: Date.now()
}
```

### 3. Commitment (Privacy Commitment)

Commitment adalah hash yang di-submit ke Privacy Cash pool. Hanya orang dengan private key yang bisa decrypt UTXO:

```typescript
// Commitment = PoseidonHash(amount, pubkey, blinding, mint)
// Commitment disimpan di Merkle tree di Privacy Cash pool
// 
// Misal ada 100 orang deposit:
// - 100 commitment di merkle tree
// - Tapi orang lain tidak tahu amount, pubkey, atau blinding
// - Hanya yang punya private key bisa decrypt

const commitment = poseidonHash(
  amount,
  pubkey,
  blinding,
  mintAddress
)
// commitment = "0x2f8c5d3a..." (hex string)

// Commitment ini di-store di Privacy Cash contract
// Saat withdraw, user prove punya UTXO dengan commitment ini
// Menggunakan zero-knowledge proof (tanpa reveal amount!)
```

### 4. Nullifier (Spend Proof)

Nullifier adalah bukti bahwa UTXO sudah di-spend (prevent double-spend):

```typescript
// Nullifier = PoseidonHash(commitment, index, signature)
// 
// Saat user withdraw:
// - Backend generate nullifier unique untuk UTXO ini
// - Nullifier di-submit ke Privacy Cash
// - Privacy Cash record nullifier di "spent list"
// - Jika ada attempt withdraw 2x, nullifier sudah ada -> REJECT

const nullifier = poseidonHash(
  commitment,
  index,           // Position di Merkle tree
  userSignature    // User's withdrawal signature
)

// Nullifier ini membuat impossible untuk:
// - Withdraw 2x dari UTXO yang sama
// - Withdraw dengan UTXO orang lain
// - Forge withdrawal tanpa valid proof
```

---

## Contoh Implementasi Frontend

### Contoh 1: Basic Deposit Flow

```typescript
// File: frontend/src/flows/depositFlow.ts

import BN from 'bn.js'
import { CONFIG } from '../config'

export interface DepositRequest {
  linkId: string           // Payment link ID
  amount: string           // Amount SOL (as string)
  publicKey: string        // Wallet public key
}

export async function executeRealDeposit(
  request: DepositRequest,
  wallet: any
): Promise<string> {
  console.log('🚀 Starting deposit flow...')
  
  const { linkId, amount } = request
  const lamports = Math.floor(parseFloat(amount) * 1_000_000_000)
  
  try {
    // ✅ STEP 1: Derive encryption key
    console.log('🔐 Step 1: Deriving encryption key from wallet signature...')
    
    const message = new TextEncoder().encode("Privacy Money account sign in")
    const encryptionSignature = await wallet.signMessage(message)
    
    console.log('   ✓ Encryption key derived from signature')
    console.log(`   ✓ Signature length: ${encryptionSignature.length} bytes`)
    
    // ✅ STEP 2: Create UTXO
    console.log('🔐 Step 2: Creating UTXO...')
    
    const amountBN = new BN(lamports)
    const blindingBN = new BN(Math.floor(Math.random() * 1_000_000_000))
    
    // Derive pubkey dari encryption key (simplified)
    const pubkeyFromKey = Buffer.from(encryptionSignature)
      .toString('hex')
      .substring(0, 64)  // First 32 bytes
    
    const utxoData = {
      amount: amountBN.toString(),
      blinding: blindingBN.toString(),
      pubkey: pubkeyFromKey,
      mintAddress: "So11111111111111111111111111111111111111112", // SOL
      timestamp: Date.now(),
      linkId
    }
    
    console.log('   ✓ UTXO created:')
    console.log(`     - Amount: ${amountBN.toString()} lamports`)
    console.log(`     - Blinding: ${blindingBN.toString()}`)
    console.log(`     - Pubkey: ${pubkeyFromKey}`)
    
    // ✅ STEP 3: User sign UTXO
    console.log('🔐 Step 3: User signing UTXO with wallet...')
    
    const utxoMessage = new TextEncoder().encode(JSON.stringify(utxoData))
    const utxoSignature = await wallet.signMessage(utxoMessage)
    
    console.log('   ✓ UTXO signed by wallet')
    
    // ✅ STEP 4: Send to backend
    console.log('📤 Step 4: Sending to backend...')
    
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/deposit/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utxo: utxoData,
        signature: Buffer.from(utxoSignature).toString('base64'),
        senderAddress: wallet.publicKey.toString(),
        linkId
      })
    })
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`)
    }
    
    const result = await response.json()
    const txSignature = result.tx
    
    console.log(`✅ Deposit successful!`)
    console.log(`   Transaction: ${txSignature}`)
    console.log(`   Explorer: https://explorer.solana.com/tx/${txSignature}`)
    
    return txSignature
    
  } catch (error) {
    console.error('❌ Deposit failed:', error)
    throw error
  }
}
```

### Contoh 2: Deposit dengan Validation

```typescript
export async function exampleDepositWithValidation(
  wallet: any,
  linkId: string
) {
  console.log('📚 Example: Deposit dengan Validation\n')

  const validateAmount = (amount: string): number => {
    const num = parseFloat(amount)
    
    // Validasi minimum
    if (num < 0.001) {
      throw new Error('Amount terlalu kecil (min 0.001 SOL)')
    }
    
    // Validasi maximum (recommended)
    if (num > 10) {
      console.warn('⚠️  Amount sangat besar, pertimbangkan split ke multiple deposits')
    }
    
    // Validasi decimal
    if (num.toString().split('.')[1]?.length > 8) {
      throw new Error('Terlalu banyak decimal places')
    }
    
    return num
  }

  const validateAddress = (address: string): boolean => {
    // Solana address adalah base58, 44 chars, dimulai dengan prefix
    return address.length === 44 && /^[1-9A-HJ-NP-Z]+$/.test(address)
  }

  try {
    const amount = '0.5'
    
    // Validate input
    console.log('✓ Validating amount...')
    const validAmount = validateAmount(amount)
    console.log(`  Amount valid: ${validAmount} SOL\n`)

    console.log('✓ Validating wallet...')
    const walletAddress = wallet.publicKey.toString()
    if (!validateAddress(walletAddress)) {
      throw new Error('Invalid wallet address')
    }
    console.log(`  Wallet valid: ${walletAddress}\n`)

    // Execute deposit
    console.log('💳 Executing deposit...')
    const tx = await executeRealDeposit(
      {
        linkId,
        amount,
        publicKey: walletAddress
      },
      wallet
    )

    console.log(`✅ Deposit successful: ${tx}`)
    return tx

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    throw error
  }
}
```

### Contoh 3: Multiple Deposits

```typescript
export async function exampleMultipleDeposits(wallet: any) {
  console.log('📚 Example: Multiple Deposits\n')

  const deposits = [
    { amount: '0.1', linkId: 'link-user-1' },
    { amount: '0.05', linkId: 'link-user-2' },
    { amount: '0.25', linkId: 'link-user-3' },
  ]

  const results = []

  for (let i = 0; i < deposits.length; i++) {
    const deposit = deposits[i]
    
    try {
      console.log(`\n[${i + 1}/${deposits.length}] Depositing ${deposit.amount} SOL...`)
      
      const tx = await executeRealDeposit(
        {
          linkId: deposit.linkId,
          amount: deposit.amount,
          publicKey: wallet.publicKey.toString()
        },
        wallet
      )

      results.push({ linkId: deposit.linkId, tx, success: true })
      console.log(`✓ Success: ${tx}`)

      // Delay antara deposits untuk avoid rate limit
      if (i < deposits.length - 1) {
        console.log('⏳ Waiting 3 seconds before next deposit...')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

    } catch (error) {
      results.push({
        linkId: deposit.linkId,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      })
      console.error(`✗ Failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  // Summary
  console.log('\n📊 Summary:')
  const successful = results.filter(r => r.success).length
  console.log(`   Total: ${deposits.length}`)
  console.log(`   Success: ${successful}`)
  console.log(`   Failed: ${deposits.length - successful}`)
  
  results.forEach(r => {
    if (r.success) {
      console.log(`   ✓ ${r.linkId}`)
    } else {
      console.log(`   ✗ ${r.linkId}: ${r.error}`)
    }
  })

  return results
}
```

---

## Contoh Implementasi Backend

### Contoh 1: Backend Deposit Handler

```typescript
// File: backend/src/routes/deposit.ts

import { PrivacyCash } from 'privacycash'
import { getPrivacyCashClient } from '../services/privacyCash'
import { prisma } from '../lib/prisma'

interface DepositRelayRequest {
  utxo: {
    amount: string
    blinding: string
    pubkey: string
    mintAddress: string
    linkId: string
  }
  signature: string
  senderAddress: string
  linkId: string
}

export async function handleDepositRelay(
  request: DepositRelayRequest
) {
  const { utxo, signature, senderAddress, linkId } = request

  try {
    console.log(`📥 Received deposit relay request`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   Amount: ${utxo.amount} lamports`)
    console.log(`   Sender: ${senderAddress}`)

    // ✅ STEP 1: Verify payment link exists
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })

    if (!link) {
      throw new Error('Payment link not found')
    }

    // ✅ STEP 2: Record UTXO in database
    await prisma.utxoData.create({
      data: {
        linkId,
        amount: utxo.amount,
        blinding: utxo.blinding,
        pubkey: utxo.pubkey,
        mintAddress: utxo.mintAddress,
        senderAddress,
        signature,
        status: 'pending'
      }
    })

    // ✅ STEP 3: Call Privacy Cash SDK
    console.log('🔐 Calling Privacy Cash SDK for deposit...')
    
    const pc = getPrivacyCashClient()
    
    // SDK will:
    // - Generate zero-knowledge proof
    // - Create commitment hash
    // - Submit to Privacy Cash network
    const depositResult = await pc.deposit({
      lamports: parseInt(utxo.amount)
    })

    const txSignature = depositResult.tx

    // ✅ STEP 4: Update database with result
    await prisma.utxoData.update({
      where: { linkId },
      data: {
        status: 'confirmed',
        txSignature,
        createdAt: new Date()
      }
    })

    console.log(`✅ Deposit processed successfully!`)
    console.log(`   Transaction: ${txSignature}`)

    return {
      success: true,
      tx: txSignature,
      linkId
    }

  } catch (error) {
    console.error('❌ Deposit relay failed:', error)
    
    // Update status to failed
    await prisma.utxoData.update({
      where: { linkId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }).catch(() => {}) // Ignore if not found

    throw error
  }
}
```

### Contoh 2: Backend Withdraw Handler

```typescript
export async function handleWithdrawal(request: {
  linkId: string
  recipientAddress: string
  wallet: any
}) {
  const { linkId, recipientAddress, wallet } = request

  try {
    console.log(`💰 Processing withdrawal`)
    console.log(`   Link ID: ${linkId}`)
    console.log(`   Recipient: ${recipientAddress}`)

    // ✅ STEP 1: Get UTXO data
    const utxoData = await prisma.utxoData.findUnique({
      where: { linkId }
    })

    if (!utxoData) {
      throw new Error('UTXO not found for this link')
    }

    if (utxoData.status === 'withdrawn') {
      throw new Error('This payment link already been claimed')
    }

    // ✅ STEP 2: Get Privacy Cash client
    const pc = getPrivacyCashClient()

    // ✅ STEP 3: Query available balance
    console.log('📊 Checking available balance...')
    const balance = await pc.getPrivateBalance()
    console.log(`   Available: ${balance.lamports} lamports`)

    const amount = parseInt(utxoData.amount)
    if (balance.lamports < amount) {
      throw new Error('Insufficient balance in Privacy Cash pool')
    }

    // ✅ STEP 4: Execute withdrawal
    console.log('🔐 Executing withdrawal via Privacy Cash SDK...')
    
    // SDK will:
    // - Generate zero-knowledge proof of UTXO ownership
    // - Create nullifier to prevent double-spend
    // - Submit proof to Privacy Cash relayer
    // - Relayer signs and broadcasts transaction
    const withdrawResult = await pc.withdraw({
      lamports: amount,
      recipientAddress: recipientAddress
    })

    // ✅ STEP 5: Update database
    await prisma.utxoData.update({
      where: { linkId },
      data: {
        status: 'withdrawn',
        withdrawalTx: withdrawResult.tx,
        recipientAddress,
        withdrawnAt: new Date()
      }
    })

    console.log(`✅ Withdrawal successful!`)
    console.log(`   Transaction: ${withdrawResult.tx}`)
    console.log(`   Amount: ${amount} lamports`)
    console.log(`   To: ${recipientAddress}`)

    return {
      success: true,
      tx: withdrawResult.tx,
      amount,
      recipientAddress
    }

  } catch (error) {
    console.error('❌ Withdrawal failed:', error)
    throw error
  }
}
```

---

## Integrasi SPL Token

### Contoh 1: Deposit USDC

```typescript
import BN from 'bn.js'

export async function depositUSDCExample() {
  const { getPrivacyCashClient, depositUSDC } = await import(
    './services/privacyCash'
  )

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

  try {
    const pc = getPrivacyCashClient()

    // USDC memiliki 6 decimals
    // Jadi 10 USDC = 10,000,000 base units
    const amountBaseUnits = 10_000_000

    console.log(`💳 Depositing 10 USDC (${amountBaseUnits} base units)...`)

    const result = await depositUSDC(pc, amountBaseUnits)

    console.log('✅ USDC deposit successful!')
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Amount: 10 USDC`)

    return result

  } catch (error) {
    console.error('❌ USDC deposit failed:', error)
    throw error
  }
}
```

### Contoh 2: Withdraw USDT

```typescript
export async function withdrawUSDTExample() {
  const { getPrivacyCashClient, withdrawSPLToken } = await import(
    './services/privacyCash'
  )

  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

  try {
    const pc = getPrivacyCashClient()
    const RECIPIENT_ADDRESS = 'YOUR_WALLET_ADDRESS_HERE'

    // USDT juga 6 decimals
    // Withdraw 100 USDT
    const result = await withdrawSPLToken(
      pc,
      USDT_MINT,
      100,              // human-readable amount (100 USDT)
      undefined,        // optional base_units
      RECIPIENT_ADDRESS
    )

    console.log('✅ USDT withdrawal successful!')
    console.log(`   Transaction: ${result.tx}`)
    console.log(`   Received: ${result.base_units / 1e6} USDT`)
    console.log(`   Fee: ${result.fee_base_units / 1e6} USDT`)
    console.log(`   Recipient: ${result.recipient}`)

    return result

  } catch (error) {
    console.error('❌ USDT withdrawal failed:', error)
    throw error
  }
}
```

### Contoh 3: Check SPL Token Balance

```typescript
export async function checkTokenBalanceExample() {
  const { getPrivacyCashClient, querySPLBalance } = await import(
    './services/privacyCash'
  )

  const tokens = [
    {
      name: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6
    },
    {
      name: 'USDT',
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6
    }
  ]

  try {
    const pc = getPrivacyCashClient()

    console.log('📊 Checking token balances...\n')

    for (const token of tokens) {
      const balance = await querySPLBalance(pc, token.mint)

      const formattedAmount = (balance.baseUnits || 0) / Math.pow(10, token.decimals)

      console.log(`${token.name}:`)
      console.log(`   Base Units: ${balance.baseUnits}`)
      console.log(`   Amount: ${formattedAmount} ${token.name}`)
      console.log(`   Raw: ${balance.formatted}`)
      console.log()
    }

  } catch (error) {
    console.error('❌ Balance check failed:', error)
    throw error
  }
}
```

### Supported Tokens

| Token | Mint Address | Decimals | Notes |
|-------|---|---|---|
| **SOL** | `So11111111111111111111111111111111111111112` | 9 | Native Solana |
| **USDC** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 | Circle |
| **USDT** | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6 | Tether |
| **ZEC** | `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS` | 8 | Zcash |

---

## Best Practices

### 1. Amount Handling (BN.js)

```typescript
import BN from 'bn.js'

// ✅ CORRECT - Use BN untuk precision
const amount1 = new BN('100000000')  // 0.1 SOL exact

const amount2 = new BN(100_000_000)  // OK untuk angka kecil

// ❌ WRONG - Floating point loses precision
const amount3 = 0.1 * 1_000_000_000  // 99999999.99999999 !

// Conversion helper
function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * 1_000_000_000))
}

function lamportsToSol(lamports: BN | number): number {
  const bn = new BN(lamports)
  return bn.toNumber() / 1_000_000_000
}

console.log(solToLamports(0.1))     // BN(100000000)
console.log(lamportsToSol(100000000)) // 0.1
```

### 2. Privacy Considerations

```typescript
// ✅ GOOD - Use round numbers
const goodAmounts = [
  0.1,   // Easy to hide among hundreds of 0.1 SOL deposits
  0.5,
  1.0,
  5.0
]

// ❌ BAD - Unique amounts traceable
const badAmounts = [
  0.123456789,  // Too specific, easy to track
  3.14159,      // Distinctive pattern
  0.001          // Most deposits are 0.01+ SOL
]

// Best practice: Suggest common amounts
const suggestedAmounts = [0.05, 0.1, 0.25, 0.5, 1, 5, 10]
```

### 3. Error Handling

```typescript
export async function handleDepositWithErrorHandling(
  wallet: any,
  linkId: string,
  amountSOL: number
) {
  try {
    // User input validation
    if (amountSOL < 0.001) {
      throw new Error('Amount minimum 0.001 SOL')
    }

    // Wallet validation
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected')
    }

    // Execute deposit
    const tx = await executeRealDeposit(
      {
        linkId,
        amount: amountSOL.toString(),
        publicKey: wallet.publicKey.toString()
      },
      wallet
    )

    console.log(`✅ Deposit successful: ${tx}`)
    return { success: true, tx }

  } catch (error) {
    // Map error messages
    let userMessage = 'Deposit failed'

    if (error instanceof Error) {
      if (error.message.includes('rejected')) {
        userMessage = 'You rejected the transaction'
      } else if (error.message.includes('insufficient')) {
        userMessage = 'Insufficient balance'
      } else if (error.message.includes('Network')) {
        userMessage = 'Network error, please try again'
      } else {
        userMessage = error.message
      }
    }

    console.error(`❌ Error: ${userMessage}`)
    return { success: false, error: userMessage }
  }
}
```

### 4. Transaction Monitoring

```typescript
export async function monitorDepositTransaction(
  txSignature: string,
  connection: Connection,
  maxWaitTime: number = 60000
) {
  console.log(`👀 Monitoring transaction: ${txSignature}`)

  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await connection.getSignatureStatus(txSignature)

      if (status?.value?.confirmationStatus === 'finalized') {
        console.log('✅ Transaction finalized!')
        return { success: true, tx: txSignature }
      }

      if (status?.value?.err) {
        console.error('❌ Transaction failed:', status.value.err)
        return { success: false, error: status.value.err }
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error('Error checking transaction:', error)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  throw new Error(`Transaction timeout: ${txSignature}`)
}
```

---

## Troubleshooting

### Error: "Privacy Cash SDK not loaded"

**Penyebab**: SDK tidak ter-initialize di frontend

**Solusi**:
```typescript
// Di app.ts, ensure SDK initialization
function initializePrivacyCashSDK() {
  try {
    // Check if SDK loaded
    if (!(window as any).PrivacyCash) {
      console.warn('Privacy Cash SDK not available, using fallback')
      // Fallback logic
    } else {
      console.log('✓ Privacy Cash SDK loaded')
    }
  } catch (error) {
    console.error('Failed to initialize SDK:', error)
  }
}

// Call pada startup
initializePrivacyCashSDK()
```

### Error: "Insufficient balance"

**Penyebab**: UTXO di Privacy Cash pool tidak cukup untuk withdrawal

**Solusi**:
```typescript
// Check balance sebelum withdraw
const balance = await pc.getPrivateBalance()

if (balance.lamports < requestedAmount) {
  throw new Error(
    `Insufficient balance: ${balance.lamports} < ${requestedAmount}`
  )
}
```

### Error: "Transaction failed - double spend"

**Penyebab**: Attempt withdraw 2x dari UTXO yang sama (nullifier already recorded)

**Solusi**:
```typescript
// Verify status sebelum withdraw
const utxo = await db.utxoData.findUnique({ where: { linkId } })

if (utxo.status === 'withdrawn') {
  throw new Error('This payment already claimed')
}

// Setelah withdraw, update status
await db.utxoData.update({
  where: { linkId },
  data: { status: 'withdrawn' }
})
```

### Error: "Invalid signature"

**Penyebab**: UTXO signature tidak valid atau corrupted

**Solusi**:
```typescript
// Verify signature format
if (typeof signature !== 'string' || signature.length < 20) {
  throw new Error('Invalid signature format')
}

// Ensure signature is proper base64
try {
  Buffer.from(signature, 'base64')
} catch {
  throw new Error('Signature is not valid base64')
}
```

---

## Resources Lebih Lanjut

### Official GitHub
- **Repository**: https://github.com/Privacy-Cash/privacy-cash-sdk
- **Documentation**: Lihat README.md di repository

### Key Files di Workspace Anda
- [Privacy Cash Integration](./PRIVACY_CASH_SDK_INTEGRATION.md)
- [Frontend Examples](./frontend/src/flows/exampleIntegrations.ts)
- [Backend Examples](./backend/src/SPL_TOKEN_EXAMPLES.ts)
- [Backend Services](./backend/src/services/privacyCash.ts)

### Community & Support
- Privacy Cash Discord
- Solana Developer Discord
- GitHub Issues

---

## Summary

Privacy Cash SDK memungkinkan:

✅ **Non-custodial transactions** - User selalu kontrol private key  
✅ **Privacy** - Commitment & blinding menyembunyikan detail UTXO  
✅ **Zero-knowledge proofs** - Withdrawal tanpa reveal withdrawal source  
✅ **Multi-asset** - SOL, USDC, USDT, dan SPL tokens lain  
✅ **Scalability** - Merkle tree & batching untuk efficiency  

Key takeaways:
- User tanda tangan message untuk derive encryption key (ONCE)
- UTXO = encrypted representation of deposit amount
- Commitment di merkle tree, nullifier prevent double-spend
- Backend adalah relayer, never punya custodi dana
- Frontend handle deposit, backend handle withdrawal

Selamat mengintegrasikan Privacy Cash SDK! 🚀


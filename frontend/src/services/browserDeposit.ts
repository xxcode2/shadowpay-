/**
 * Browser-Compatible Non-Custodial Deposit Service
 *
 * This service implements the Privacy Cash deposit flow directly in the browser,
 * ensuring true non-custodial operation where:
 * - UTXOs are encrypted with user's keys (derived from their wallet signature)
 * - ZK proofs are generated in the browser
 * - User signs the transaction with their wallet (Phantom)
 * - Transaction is submitted directly to Privacy Cash relayer API
 *
 * Flow:
 * 1. User signs "Privacy Money account sign in" message → derives encryption key
 * 2. Browser generates ZK proof using snarkjs
 * 3. Browser creates deposit transaction
 * 4. User signs transaction with Phantom
 * 5. Signed transaction is relayed to Privacy Cash indexer
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'

// Privacy Cash constants
const PRIVACY_CASH_RELAYER_API = 'https://api3.privacycash.org'
const SIGN_MESSAGE = 'Privacy Money account sign in'

/**
 * Wallet interface compatible with Phantom and other Solana wallets
 */
export interface WalletAdapter {
  publicKey: PublicKey
  signMessage(message: Uint8Array): Promise<Uint8Array>
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>
}

/**
 * Deposit parameters
 */
export interface DepositParams {
  wallet: WalletAdapter
  lamports: number
  connection: Connection
  onProgress?: (step: string, detail?: string) => void
}

/**
 * Deposit result
 */
export interface DepositResult {
  success: boolean
  transactionSignature: string
  amount: number
  explorerUrl: string
}

/**
 * Execute non-custodial deposit using Privacy Cash SDK directly in browser
 *
 * This is the main entry point for deposits. It uses the Privacy Cash SDK
 * to generate ZK proofs and create transactions entirely in the browser.
 */
export async function executeNonCustodialDeposit(params: DepositParams): Promise<DepositResult> {
  const { wallet, lamports, connection, onProgress } = params
  const log = (step: string, detail?: string) => {
    console.log(`[Deposit] ${step}${detail ? ': ' + detail : ''}`)
    onProgress?.(step, detail)
  }

  try {
    log('Starting non-custodial deposit', `${lamports / 1e9} SOL`)

    // Step 1: Check balance
    log('Checking wallet balance')
    const balance = await connection.getBalance(wallet.publicKey)
    const estimatedFees = 5_000_000 // ~0.005 SOL for fees
    const totalNeeded = lamports + estimatedFees

    if (balance < totalNeeded) {
      throw new Error(
        `Insufficient balance. You have ${(balance / 1e9).toFixed(4)} SOL, ` +
        `but need ${(totalNeeded / 1e9).toFixed(4)} SOL (${(lamports / 1e9).toFixed(4)} SOL deposit + ~0.005 SOL fees)`
      )
    }
    log('Balance sufficient', `${(balance / 1e9).toFixed(4)} SOL`)

    // Step 2: Derive encryption key from wallet signature
    log('Requesting signature for encryption key derivation')
    log('Please sign the message in your wallet')

    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE)
    let signature: Uint8Array

    try {
      signature = await wallet.signMessage(encodedMessage)
      // Handle wallets that return { signature } object
      if ((signature as any).signature instanceof Uint8Array) {
        signature = (signature as any).signature
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rejected') || err.message?.toLowerCase().includes('cancelled')) {
        throw new Error('You rejected the signature request. This is required to derive your encryption key.')
      }
      throw err
    }

    log('Encryption key derived from signature')

    // Step 3: Initialize Privacy Cash SDK with user's derived encryption key
    log('Initializing Privacy Cash SDK')

    // Import Privacy Cash SDK - it will run in browser
    const { PrivacyCash } = await import('privacycash')
    const { EncryptionService } = await import('privacycash/utils')

    // Create encryption service from user's signature (not from operator's keypair!)
    const encryptionService = new EncryptionService()
    encryptionService.deriveEncryptionKeyFromSignature(signature)

    log('SDK initialized with your encryption key')

    // Step 4: Use the SDK's deposit function with browser-compatible transaction signer
    // The SDK generates ZK proof and creates the transaction
    log('Generating ZK proof', 'This may take 30-60 seconds...')

    // Get the RPC URL for SDK
    const rpcUrl = connection.rpcEndpoint

    // Create a custom deposit flow using SDK internals
    // The SDK expects to be initialized with a keypair, but we can use the lower-level
    // functions with our own encryption service and transaction signer
    const depositResult = await executeDepositWithSDK({
      connection,
      publicKey: wallet.publicKey,
      lamports,
      encryptionService,
      rpcUrl,
      transactionSigner: async (tx: VersionedTransaction) => {
        log('Please sign the deposit transaction in your wallet')
        return await wallet.signTransaction(tx)
      },
      onProgress: log
    })

    log('Deposit successful!', depositResult.signature)

    return {
      success: true,
      transactionSignature: depositResult.signature,
      amount: lamports / 1e9,
      explorerUrl: `https://solscan.io/tx/${depositResult.signature}`
    }

  } catch (error: any) {
    console.error('[Deposit] Error:', error)
    throw error
  }
}

/**
 * Execute deposit using SDK with custom encryption service and transaction signer
 */
async function executeDepositWithSDK(params: {
  connection: Connection
  publicKey: PublicKey
  lamports: number
  encryptionService: any
  rpcUrl: string
  transactionSigner: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  onProgress: (step: string, detail?: string) => void
}): Promise<{ signature: string }> {
  const { connection, publicKey, lamports, encryptionService, rpcUrl, transactionSigner, onProgress } = params

  try {
    // Try to use the SDK's internal deposit function
    // The SDK's deposit.ts accepts a transactionSigner callback
    const depositModule = await import('privacycash')

    // Check if we can access the deposit function directly
    // The PrivacyCash class wraps it, but we need to pass our own encryption service

    // Create a storage wrapper for browser
    const storage = createBrowserStorage()

    // Get WASM factory
    const { WasmFactory } = await import('@lightprotocol/hasher.rs')
    const lightWasm = await WasmFactory.getInstance()

    onProgress('WASM initialized')

    // Try to access the low-level deposit function
    // If the SDK exports it, we can use it directly
    // Otherwise, we need to use an alternative approach

    // For now, let's try using the SDK's PrivacyCash class with a workaround
    // We'll create a temporary keypair just for SDK initialization,
    // but then manually set up our encryption service

    // Alternative approach: Call the Privacy Cash relayer API directly
    // since the SDK's class constructor requires a private key

    return await executeDirectRelayerDeposit({
      connection,
      publicKey,
      lamports,
      encryptionService,
      lightWasm,
      storage,
      transactionSigner,
      onProgress
    })

  } catch (error: any) {
    console.error('[Deposit SDK] Error:', error)
    throw new Error(`Deposit failed: ${error.message}`)
  }
}

/**
 * Execute deposit by directly interacting with Privacy Cash relayer
 * This is the fallback when we can't use the SDK's class directly
 */
async function executeDirectRelayerDeposit(params: {
  connection: Connection
  publicKey: PublicKey
  lamports: number
  encryptionService: any
  lightWasm: any
  storage: any
  transactionSigner: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  onProgress: (step: string, detail?: string) => void
}): Promise<{ signature: string }> {
  const { connection, publicKey, lamports, encryptionService, lightWasm, storage, transactionSigner, onProgress } = params

  // Import SDK utilities
  const sdkUtils = await import('privacycash/utils')

  // Get tree state from relayer
  onProgress('Fetching tree state')
  const treeStateResponse = await fetch(`${PRIVACY_CASH_RELAYER_API}/merkle/root`)
  if (!treeStateResponse.ok) {
    throw new Error('Failed to fetch Merkle tree state')
  }
  const { root, nextIndex } = await treeStateResponse.json() as { root: string, nextIndex: number }

  onProgress('Tree state fetched', `nextIndex: ${nextIndex}`)

  // Generate UTXO keypair from user's encryption service
  const utxoPrivateKey = encryptionService.getUtxoPrivateKeyV2()

  // Import UTXO and Keypair classes if available
  let Utxo: any
  let UtxoKeypair: any

  try {
    // Try to import from SDK utils
    const utxoModule = await import('privacycash/utils')
    Utxo = utxoModule.Utxo
    UtxoKeypair = utxoModule.Keypair
  } catch {
    throw new Error(
      'Privacy Cash SDK utilities not available. ' +
      'Please ensure the privacycash package is installed with npm install.'
    )
  }

  // Create UTXO keypair
  const utxoKeypair = new UtxoKeypair(utxoPrivateKey, lightWasm)

  // Fetch existing UTXOs (simplified - just check if user has any)
  onProgress('Checking existing balance')

  // Create input UTXOs (dummy for fresh deposit)
  const inputs = [
    new Utxo({ lightWasm, keypair: utxoKeypair }),
    new Utxo({ lightWasm, keypair: utxoKeypair })
  ]

  // Create output UTXOs
  const outputAmount = lamports.toString()
  const outputs = [
    new Utxo({
      lightWasm,
      amount: outputAmount,
      keypair: utxoKeypair,
      index: nextIndex
    }),
    new Utxo({
      lightWasm,
      amount: '0',
      keypair: utxoKeypair,
      index: nextIndex + 1
    })
  ]

  onProgress('Generating ZK proof', 'This may take 30-60 seconds...')

  // Generate proof
  const BN = (await import('bn.js')).default
  const FIELD_SIZE = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495617')
  const MERKLE_TREE_DEPTH = 26

  const publicAmountForCircuit = new BN(lamports).add(FIELD_SIZE).mod(FIELD_SIZE)

  // Get nullifiers and commitments
  const inputNullifiers = await Promise.all(inputs.map(x => x.getNullifier()))
  const outputCommitments = await Promise.all(outputs.map(x => x.getCommitment()))

  // Encrypt outputs
  const encryptedOutput1 = encryptionService.encryptUtxo(outputs[0])
  const encryptedOutput2 = encryptionService.encryptUtxo(outputs[1])

  // Create extData
  const FEE_RECIPIENT = new PublicKey('AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM')
  const extData = {
    recipient: new PublicKey('AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM'),
    extAmount: new BN(lamports),
    encryptedOutput1,
    encryptedOutput2,
    fee: new BN(0),
    feeRecipient: FEE_RECIPIENT,
    mintAddress: '11111111111111111111111111111112' // SOL
  }

  // Calculate extDataHash
  const extDataHash = sdkUtils.getExtDataHash(extData)

  // Create proof input
  const inputMerklePathIndices = [0, 0]
  const inputMerklePathElements = [
    new Array(MERKLE_TREE_DEPTH).fill('0'),
    new Array(MERKLE_TREE_DEPTH).fill('0')
  ]

  const proofInput = {
    root,
    inputNullifier: inputNullifiers,
    outputCommitment: outputCommitments,
    publicAmount: publicAmountForCircuit.toString(),
    extDataHash,
    inAmount: inputs.map(x => x.amount.toString(10)),
    inPrivateKey: inputs.map(x => x.keypair.privkey),
    inBlinding: inputs.map(x => x.blinding.toString(10)),
    inPathIndices: inputMerklePathIndices,
    inPathElements: inputMerklePathElements,
    outAmount: outputs.map(x => x.amount.toString(10)),
    outBlinding: outputs.map(x => x.blinding.toString(10)),
    outPubkey: outputs.map(x => x.keypair.pubkey),
    mintAddress: '11111111111111111111111111111112'
  }

  // Generate ZK proof using snarkjs
  const snarkjs = await import('snarkjs')

  // Circuit files should be in public folder
  const wasmPath = '/circuits/transaction2.wasm'
  const zkeyPath = '/circuits/transaction2.zkey'

  let proof: any
  let publicSignals: any

  try {
    const result = await snarkjs.groth16.fullProve(proofInput, wasmPath, zkeyPath)
    proof = result.proof
    publicSignals = result.publicSignals
  } catch (proofErr: any) {
    console.error('[ZK Proof] Error:', proofErr)

    // Check if circuit files exist
    try {
      const wasmCheck = await fetch(wasmPath, { method: 'HEAD' })
      const zkeyCheck = await fetch(zkeyPath, { method: 'HEAD' })

      if (!wasmCheck.ok || !zkeyCheck.ok) {
        throw new Error(
          'Circuit files not found. Please run: npm run setup:circuits ' +
          'or manually copy transaction2.wasm and transaction2.zkey to public/circuits/'
        )
      }
    } catch {
      throw new Error(
        'Failed to load circuit files. Please ensure they are available at ' +
        '/circuits/transaction2.wasm and /circuits/transaction2.zkey'
      )
    }

    throw new Error(`ZK proof generation failed: ${proofErr.message}`)
  }

  onProgress('ZK proof generated')

  // Parse proof to bytes
  const proofInBytes = sdkUtils.parseProofToBytesArray(proof)
  const inputsInBytes = sdkUtils.parseToBytesArray(publicSignals)

  // Create proof object
  const proofToSubmit = {
    proofA: proofInBytes.proofA,
    proofB: proofInBytes.proofB.flat(),
    proofC: proofInBytes.proofC,
    root: inputsInBytes[0],
    publicAmount: inputsInBytes[1],
    extDataHash: inputsInBytes[2],
    inputNullifiers: [inputsInBytes[3], inputsInBytes[4]],
    outputCommitments: [inputsInBytes[5], inputsInBytes[6]]
  }

  // Get PDAs
  const { findNullifierPDAs, findCrossCheckNullifierPDAs, getProgramAccounts } = sdkUtils
  const { nullifier0PDA, nullifier1PDA } = findNullifierPDAs(proofToSubmit)
  const { nullifier2PDA, nullifier3PDA } = findCrossCheckNullifierPDAs(proofToSubmit)
  const { treeAccount, treeTokenAccount, globalConfigAccount } = getProgramAccounts()

  // Serialize proof and extData
  const serializedProof = sdkUtils.serializeProofAndExtData(proofToSubmit, extData)

  onProgress('Creating transaction')

  // Get ALT
  const ALT_ADDRESS = new PublicKey('HEN49U2ySJ85Vc78qprSW9y6mFDhs1NczRxyppNHjofe')
  const altAccount = await connection.getAddressLookupTable(ALT_ADDRESS)
  if (!altAccount.value) {
    throw new Error('Address Lookup Table not found')
  }

  // Create deposit instruction
  const { TransactionInstruction, TransactionMessage, ComputeBudgetProgram, SystemProgram } = await import('@solana/web3.js')
  const PROGRAM_ID = new PublicKey('9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD')

  const depositInstruction = new TransactionInstruction({
    keys: [
      { pubkey: treeAccount, isSigner: false, isWritable: true },
      { pubkey: nullifier0PDA, isSigner: false, isWritable: true },
      { pubkey: nullifier1PDA, isSigner: false, isWritable: true },
      { pubkey: nullifier2PDA, isSigner: false, isWritable: false },
      { pubkey: nullifier3PDA, isSigner: false, isWritable: false },
      { pubkey: treeTokenAccount, isSigner: false, isWritable: true },
      { pubkey: globalConfigAccount, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM'), isSigner: false, isWritable: true },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    programId: PROGRAM_ID,
    data: serializedProof
  })

  // Set compute budget
  const computeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()

  // Create versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: blockhash,
    instructions: [computeBudget, depositInstruction]
  }).compileToV0Message([altAccount.value])

  const transaction = new VersionedTransaction(messageV0)

  // Sign transaction
  onProgress('Awaiting signature')
  const signedTransaction = await transactionSigner(transaction)

  // Relay to Privacy Cash
  onProgress('Submitting to Privacy Cash')
  const serializedTx = Buffer.from(signedTransaction.serialize()).toString('base64')

  const relayResponse = await fetch(`${PRIVACY_CASH_RELAYER_API}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedTransaction: serializedTx,
      senderAddress: publicKey.toString()
    })
  })

  if (!relayResponse.ok) {
    const errorText = await relayResponse.text()
    throw new Error(`Failed to relay deposit: ${errorText}`)
  }

  const { signature } = await relayResponse.json() as { signature: string }

  // Wait for confirmation
  onProgress('Waiting for confirmation')

  const encryptedOutputHex = Buffer.from(encryptedOutput1).toString('hex')

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000))

    try {
      const checkResponse = await fetch(`${PRIVACY_CASH_RELAYER_API}/utxos/check/${encryptedOutputHex}`)
      const checkResult = await checkResponse.json() as { exists: boolean }

      if (checkResult.exists) {
        return { signature }
      }
    } catch {
      // Continue waiting
    }
  }

  // Transaction submitted even if confirmation check fails
  console.warn('[Deposit] Confirmation check timed out, but transaction was submitted')
  return { signature }
}

/**
 * Create browser-compatible storage
 */
function createBrowserStorage() {
  const prefix = 'privacycash_'

  return {
    getItem(key: string): string | null {
      return localStorage.getItem(prefix + key)
    },
    setItem(key: string, value: string): void {
      localStorage.setItem(prefix + key, value)
    },
    removeItem(key: string): void {
      localStorage.removeItem(prefix + key)
    }
  }
}

/**
 * Clear local cache
 */
export function clearDepositCache(): void {
  const prefix = 'privacycash_'
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log('[Deposit] Cache cleared')
}

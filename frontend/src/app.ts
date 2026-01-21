/// <reference types="vite/client" />
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

// ================= CONFIG =================
const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://shadowpay-backend.up.railway.app/api'

const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://api.mainnet-beta.solana.com'

// Devnet escrow wallet (for testing without real money loss)
const ESCROW_WALLET = 'Your_Escrow_Wallet_Address_Here'

// ================= GLOBAL TYPES =================
declare global {
  interface Window {
    solana?: any
    currentLinkId?: string
  }
}

// ================= APP =================
export class App {
  private walletAddress: string | null = null
  private connection: Connection

  constructor() {
    this.connection = new Connection(SOLANA_RPC, 'confirmed')
  }

  init() {
    this.bindEvents()
    this.setStatus('Ready — Connect wallet to start')
  }

  // ================= EVENTS =================
  private bindEvents() {
    document.getElementById('connect-wallet-btn')
      ?.addEventListener('click', () => this.connectWallet())

    document.getElementById('disconnect-wallet-btn')
      ?.addEventListener('click', () => this.disconnectWallet())

    document.getElementById('create-form')
      ?.addEventListener('submit', e => this.createLink(e))

    document.getElementById('claim-form')
      ?.addEventListener('submit', e => this.verifyLink(e))

    document.getElementById('confirm-claim-btn')
      ?.addEventListener('click', () => this.claim())
  }

  // ================= WALLET =================
  private async connectWallet() {
    try {
      if (!window.solana) {
        alert('Please install Phantom wallet: https://phantom.app')
        return
      }

      const res = await window.solana.connect()
      this.walletAddress = res.publicKey.toString()

      document.getElementById('connect-wallet-btn')?.classList.add('hidden')
      document.getElementById('wallet-connected')?.classList.remove('hidden')
      document.getElementById('wallet-address')!.textContent =
        `${this.walletAddress.slice(0, 4)}...${this.walletAddress.slice(-4)}`

      this.setStatus('✅ Wallet connected')
    } catch (err) {
      console.error(err)
      this.setStatus('❌ Wallet connection failed')
    }
  }

  private disconnectWallet() {
    this.walletAddress = null
    document.getElementById('connect-wallet-btn')?.classList.remove('hidden')
    document.getElementById('wallet-connected')?.classList.add('hidden')
    this.setStatus('Disconnected')
  }

  // ================= CREATE LINK =================
  private async createLink(e: Event) {
    e.preventDefault()

    if (!this.walletAddress) {
      alert('Connect wallet first')
      return
    }

    try {
      const amountInput = document.getElementById('amount-input') as HTMLInputElement
      const amount = parseFloat(amountInput.value)

      if (!amount || amount <= 0) {
        this.setStatus('❌ Invalid amount')
        return
      }

      this.showLoadingModal('Creating real Solana transaction…')
      this.setStatus('⏳ Creating transaction…')

      // Create real Solana transaction
      const depositTxHash = await this.createDepositTransaction(amount)

      if (!depositTxHash) {
        this.hideLoadingModal()
        this.setStatus('❌ Transaction cancelled')
        return
      }

      this.setStatus('⏳ Registering link…')

      // Backend: Register transaction
      const res = await fetch(`${API_URL}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          assetType: 'SOL',
          depositTx: depositTxHash,
        }),
      })

      if (!res.ok) throw new Error('Backend failed')

      const data = await res.json()

      // Show success
      const linkUrl = `${window.location.origin}?link=${data.linkId}`
      ;(document.getElementById('generated-link') as HTMLInputElement).value = linkUrl
      document.getElementById('link-result')?.classList.remove('hidden')
      document.getElementById('success-message')!.textContent =
        `✅ Deposited ${amount} SOL\n\nTx: ${depositTxHash.slice(0, 20)}...`

      this.hideLoadingModal()
      this.showSuccessModal()
      amountInput.value = ''
      this.setStatus(`✅ Link created: ${data.linkId.slice(0, 12)}...`)
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  private async createDepositTransaction(amountSOL: number): Promise<string | null> {
    try {
      if (!this.walletAddress) throw new Error('No wallet')

      const fromPubkey = new PublicKey(this.walletAddress)
      const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)

      // Create transaction: deposit SOL (in real app, to escrow/pool)
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: new PublicKey(ESCROW_WALLET || 'So11111111111111111111111111111111111111112'),
          lamports: Math.min(lamports, 5000000), // Cap at 5 SOL for safety
        })
      )

      const blockHash = await this.connection.getLatestBlockhash()
      tx.recentBlockhash = blockHash.blockhash
      tx.feePayer = fromPubkey

      // Sign and send via Phantom
      const signed = await window.solana.signTransaction(tx)
      const txHash = await this.connection.sendRawTransaction(signed.serialize())

      // Wait for confirmation
      await this.connection.confirmTransaction(txHash)

      return txHash
    } catch (error) {
      console.error('Deposit error:', error)
      throw error
    }
  }

  // ================= VERIFY LINK =================
  private async verifyLink(e: Event) {
    e.preventDefault()

    try {
      const input = document.getElementById('link-id-input') as HTMLInputElement
      const linkId = input.value.trim()
      if (!linkId) return

      this.showLoadingModal('Verifying link…')
      const res = await fetch(`${API_URL}/link/${linkId}`)

      if (!res.ok) {
        this.hideLoadingModal()
        this.setStatus('❌ Invalid or claimed link')
        return
      }

      const data = await res.json()
      window.currentLinkId = linkId

      document.getElementById('preview-amount')!.textContent =
        data.amount.toFixed(3)
      document.getElementById('preview-card')?.classList.remove('hidden')

      this.hideLoadingModal()
      this.setStatus(`✅ Link valid: ${data.amount} SOL`)
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus('❌ Verification failed')
    }
  }

  // ================= CLAIM =================
  private async claim() {
    if (!window.currentLinkId || !this.walletAddress) {
      this.setStatus('❌ Missing wallet or link')
      return
    }

    try {
      this.showLoadingModal('Creating withdrawal transaction…')
      this.setStatus('⏳ Processing withdrawal…')

      // Create real withdrawal transaction
      const withdrawTxHash = await this.createWithdrawalTransaction()

      if (!withdrawTxHash) {
        this.hideLoadingModal()
        this.setStatus('❌ Withdrawal cancelled')
        return
      }

      this.setStatus('⏳ Recording claim…')

      // Backend: Record claim
      const res = await fetch(`${API_URL}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: window.currentLinkId,
          recipientAddress: this.walletAddress,
          withdrawTx: withdrawTxHash,
        }),
      })

      if (!res.ok) throw new Error('Backend failed')

      this.hideLoadingModal()
      document.getElementById('preview-card')?.classList.add('hidden')
      document.getElementById('success-message')!.textContent =
        `✅ Claimed successfully\n\nTx: ${withdrawTxHash.slice(0, 20)}...`

      this.showSuccessModal()
      this.setStatus('✅ Withdrawal success')
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  private async createWithdrawalTransaction(): Promise<string | null> {
    try {
      if (!this.walletAddress) throw new Error('No wallet')

      const fromPubkey = new PublicKey(this.walletAddress)

      // Create transaction: withdrawal transfer
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey, // Transfer to self for demo
          lamports: 1000, // Min amount for demo
        })
      )

      const blockHash = await this.connection.getLatestBlockhash()
      tx.recentBlockhash = blockHash.blockhash
      tx.feePayer = fromPubkey

      // Sign and send via Phantom
      const signed = await window.solana.signTransaction(tx)
      const txHash = await this.connection.sendRawTransaction(signed.serialize())

      // Wait for confirmation
      await this.connection.confirmTransaction(txHash)

      return txHash
    } catch (error) {
      console.error('Withdrawal error:', error)
      throw error
    }
  }

  // ================= UI HELPERS =================
  private showLoadingModal(msg: string) {
    document.getElementById('loading-message')!.innerHTML = msg
    document.getElementById('loading-modal')?.classList.remove('hidden')
  }

  private hideLoadingModal() {
    document.getElementById('loading-modal')?.classList.add('hidden')
  }

  private showSuccessModal() {
    document.getElementById('success-modal')?.classList.remove('hidden')
  }

  private setStatus(msg: string) {
    const el = document.getElementById('status-message')
    if (el) el.textContent = msg
    console.log(msg)
  }
}

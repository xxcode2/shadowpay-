/// <reference types="vite/client" />

import { PrivacyCash } from 'privacycash'

// ================= CONFIG =================
const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://shadowpay-backend.up.railway.app/api'

const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY'

// ================= GLOBAL =================
declare global {
  interface Window {
    solana?: any
    currentLinkId?: string
  }
}

// ================= APP =================
export class App {
  private walletAddress: string | null = null
  private privacyCash: PrivacyCash | null = null
  private pendingLamports: number | null = null

  init() {
    this.bindEvents()
    this.setStatus('Ready — Connect wallet to start')
  }

  // ================= EVENTS =================
  private bindEvents() {
    document
      .getElementById('connect-wallet-btn')
      ?.addEventListener('click', () => this.connectWallet())

    document
      .getElementById('disconnect-wallet-btn')
      ?.addEventListener('click', () => this.disconnectWallet())

    document
      .getElementById('create-form')
      ?.addEventListener('submit', e => this.createLink(e))

    document
      .getElementById('claim-form')
      ?.addEventListener('submit', e => this.verifyLink(e))

    document
      .getElementById('confirm-claim-btn')
      ?.addEventListener('click', () => this.claim())
  }

  // ================= WALLET =================
  private async connectWallet() {
    try {
      if (!window.solana) {
        alert('Please install Phantom wallet')
        return
      }

      const res = await window.solana.connect()
      this.walletAddress = res.publicKey.toString()

      // INIT PRIVACY CASH SDK (FRONTEND ONLY)
      this.privacyCash = new PrivacyCash({
        RPC_url: SOLANA_RPC,
        owner: window.solana.publicKey,
      })

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
    this.privacyCash = null
    this.pendingLamports = null

    document.getElementById('connect-wallet-btn')?.classList.remove('hidden')
    document.getElementById('wallet-connected')?.classList.add('hidden')

    this.setStatus('Disconnected')
  }

  // ================= CREATE LINK =================
  private async createLink(e: Event) {
    e.preventDefault()

    if (!this.walletAddress || !this.privacyCash) {
      alert('Connect wallet first')
      return
    }

    try {
      const amountInput =
        document.getElementById('amount-input') as HTMLInputElement
      const amount = parseFloat(amountInput.value)

      if (!amount || amount <= 0) {
        this.setStatus('❌ Invalid amount')
        return
      }

      const lamports = Math.round(amount * 1e9)

      this.showLoadingModal('Depositing SOL privately…')
      this.setStatus('⏳ Depositing to Privacy Cash pool…')

      // 🔐 REAL PRIVACY CASH DEPOSIT
      const depositResult = await this.privacyCash.deposit({
        lamports,
      })

      const depositTx = depositResult.tx

      this.setStatus('⏳ Registering payment link…')

      // BACKEND: metadata only
      const res = await fetch(`${API_URL}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          assetType: 'SOL',
          depositTx,
        }),
      })

      if (!res.ok) throw new Error('Backend failed')

      const data = await res.json()

      const linkUrl = `${window.location.origin}?link=${data.linkId}`
      ;(document.getElementById('generated-link') as HTMLInputElement).value =
        linkUrl

      document.getElementById('link-result')?.classList.remove('hidden')
      document.getElementById('success-message')!.textContent =
        `✅ Successfully deposited ${amount} SOL privately`

      this.hideLoadingModal()
      this.showSuccessModal()
      amountInput.value = ''
      this.setStatus(`✅ Link created: ${data.linkId}`)
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus(
        `❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`
      )
    }
  }

  // ================= VERIFY LINK =================
  private async verifyLink(e: Event) {
    e.preventDefault()

    try {
      const input =
        document.getElementById('link-id-input') as HTMLInputElement
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
      this.pendingLamports = Math.round(data.amount * 1e9)

      document.getElementById('preview-amount')!.textContent =
        data.amount.toFixed(3)
      document.getElementById('preview-memo')!.textContent =
        data.memo || 'No memo'
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
    if (
      !window.currentLinkId ||
      !this.walletAddress ||
      !this.privacyCash ||
      !this.pendingLamports
    ) {
      this.setStatus('❌ Missing wallet or link')
      return
    }

    try {
      this.showLoadingModal('Withdrawing privately…')
      this.setStatus('⏳ Processing withdrawal…')

      // 🔐 REAL PRIVACY CASH WITHDRAW
      const withdrawResult = await this.privacyCash.withdraw({
        lamports: this.pendingLamports,
        recipientAddress: this.walletAddress,
      })

      const withdrawTx = withdrawResult.tx

      // BACKEND: record claim only
      const res = await fetch(`${API_URL}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: window.currentLinkId,
          recipientAddress: this.walletAddress,
          withdrawTx,
        }),
      })

      if (!res.ok) throw new Error('Backend failed')

      this.hideLoadingModal()
      document.getElementById('preview-card')?.classList.add('hidden')
      document.getElementById('success-message')!.textContent =
        '✅ Payment claimed privately'

      this.showSuccessModal()
      this.setStatus('✅ Withdrawal complete')
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus(
        `❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`
      )
    }
  }

  // ================= UI HELPERS =================
  private showLoadingModal(msg: string) {
    const modal = document.getElementById('loading-modal')
    if (modal) {
      const msgEl = document.getElementById('loading-message')
      if (msgEl) msgEl.innerHTML = msg
      modal.classList.remove('hidden')
    }
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

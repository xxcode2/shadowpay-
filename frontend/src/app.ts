/// <reference types="vite/client" />

import { PrivacyCash } from 'privacycash'
import { EncryptionService } from 'privacycash/utils'

// ================= CONFIG =================
// Backend URL: Uses env var VITE_BACKEND_URL (set in .env / vercel.json)
// Default fallback to new production backend if env not set
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

const API_URL = `${BACKEND_URL}/api`

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
  private pendingLamports: number | null = null
  private privacyCash: PrivacyCash | null = null
  private encryptionReady = false

  init() {
    this.bindEvents()
    this.setStatus('Ready — Connect wallet to start')
  }

  // ================= EVENTS =================
  private bindEvents() {
    // Mode switching
    document
      .getElementById('mode-create')
      ?.addEventListener('click', () => this.switchMode('create'))

    document
      .getElementById('mode-claim')
      ?.addEventListener('click', () => this.switchMode('claim'))

    document
      .getElementById('mode-history')
      ?.addEventListener('click', () => this.switchMode('history'))

    // Wallet
    document
      .getElementById('connect-wallet-btn')
      ?.addEventListener('click', () => this.connectWallet())

    document
      .getElementById('disconnect-wallet-btn')
      ?.addEventListener('click', () => this.disconnectWallet())

    // Forms
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

  // ================= MODE SWITCHING =================
  private switchMode(mode: 'create' | 'claim' | 'history') {
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')
      btn.classList.add('text-gray-400', 'hover:text-white')
    })

    const activeBtn = document.getElementById(`mode-${mode}`)
    if (activeBtn) {
      activeBtn.classList.remove('text-gray-400', 'hover:text-white')
      activeBtn.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')
    }

    // Show/hide sections
    document.getElementById('create-section')?.classList.add('hidden')
    document.getElementById('claim-section')?.classList.add('hidden')
    document.getElementById('history-section')?.classList.add('hidden')

    if (mode === 'create') {
      document.getElementById('create-section')?.classList.remove('hidden')
    } else if (mode === 'claim') {
      document.getElementById('claim-section')?.classList.remove('hidden')
    } else if (mode === 'history') {
      document.getElementById('history-section')?.classList.remove('hidden')
    }
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
    this.pendingLamports = null

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
      const amountInput =
        document.getElementById('amount-input') as HTMLInputElement
      const amount = parseFloat(amountInput.value)

      if (!amount || amount <= 0) {
        this.setStatus('❌ Invalid amount')
        return
      }

      this.showLoadingModal('Processing deposit…')
      this.setStatus('⏳ Creating payment link…')

      // Send deposit request to backend
      const res = await fetch(`${API_URL}/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          assetType: 'SOL',
          senderAddress: this.walletAddress,
        }),
      })

      if (!res.ok) throw new Error('Backend failed')

      const data = await res.json()

      // ================= PRIVACY CASH DEPOSIT =================
      this.setStatus('⏳ Initializing Privacy Cash...')
      const lamports = Math.round(amount * 1e9)

      // 1️⃣ Derive encryption key (Phantom signMessage)
      if (!this.encryptionReady) {
        this.setStatus('⏳ Signing encryption key...')
        const encodedMessage = new TextEncoder().encode('Privacy Money account sign in')
        const signedMessage = await window.solana.signMessage(encodedMessage)

        const encryptionService = new EncryptionService()
        encryptionService.deriveEncryptionKeyFromSignature(
          signedMessage.signature ?? signedMessage
        )

        this.encryptionReady = true
        this.setStatus('✅ Encryption key derived')
      }

      // 2️⃣ Init Privacy Cash client
      this.setStatus('⏳ Initializing Privacy Cash client...')
      this.privacyCash = new PrivacyCash({
        RPC_url: SOLANA_RPC,
        owner: this.walletAddress,
      } as any)

      // 3️⃣ Deposit (🔥 PHANTOM WILL OPEN HERE FOR TRANSACTION SIGNING 🔥)
      this.setStatus('⏳ Executing deposit...')
      const depositResult = await this.privacyCash.deposit({
        lamports,
      })

      console.log('✅ Deposit tx:', depositResult.tx)
      this.setStatus('✅ Deposit successful')

      // 4️⃣ Notify backend of deposit
      this.setStatus('⏳ Recording deposit on backend...')
      const depositRes = await fetch(`${API_URL}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: data.linkId,
          depositTx: depositResult.tx,
        }),
      })

      if (!depositRes.ok) {
        throw new Error('Failed to record deposit')
      }

      const linkUrl = `${window.location.origin}?link=${data.linkId}`
      ;(document.getElementById('generated-link') as HTMLInputElement).value =
        linkUrl

      document.getElementById('link-result')?.classList.remove('hidden')
      document.getElementById('success-message')!.textContent =
        `✅ Successfully deposited ${amount} SOL and created link`

      this.hideLoadingModal()
      this.showSuccessModal()
      amountInput.value = ''
      this.setStatus(`✅ Link ready: ${data.linkId}`)
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
    if (!window.currentLinkId || !this.walletAddress || !this.pendingLamports) {
      this.setStatus('❌ Missing wallet or link')
      return
    }

    try {
      this.showLoadingModal('Processing withdrawal…')
      this.setStatus('⏳ Claiming payment…')

      // Send withdrawal request to backend
      const res = await fetch(`${API_URL}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: window.currentLinkId,
          recipientAddress: this.walletAddress,
        }),
      })

      if (!res.ok) throw new Error('Backend failed')

      this.hideLoadingModal()
      document.getElementById('preview-card')?.classList.add('hidden')
      document.getElementById('success-message')!.textContent =
        '✅ Payment claimed successfully'

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

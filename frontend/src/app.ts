/// <reference types="vite/client" />

import { createLink } from './flows/createLink.js'

// ================= CONFIG =================
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

const API_URL = `${BACKEND_URL}/api`

declare global {
  interface Window {
    solana?: any
    currentLinkId?: string
  }
}

export class App {
  private walletAddress: string | null = null
  private pendingLamports: number | null = null

  init() {
    this.bindEvents()
    this.setStatus('Ready — Connect wallet to start')

    // Auto-fill link ID from URL parameter
    const params = new URLSearchParams(window.location.search)
    const linkParam = params.get('link')
    if (linkParam) {
      const linkInput = document.getElementById('link-id-input') as HTMLInputElement
      if (linkInput) {
        linkInput.value = linkParam
        this.switchMode('claim')
      }
    }
  }

  // ================= EVENTS =================
  private bindEvents() {
    document.getElementById('mode-create')
      ?.addEventListener('click', () => this.switchMode('create'))

    document.getElementById('mode-claim')
      ?.addEventListener('click', () => this.switchMode('claim'))

    document.getElementById('mode-history')
      ?.addEventListener('click', () => this.switchMode('history'))

    document.getElementById('connect-wallet-btn')
      ?.addEventListener('click', () => this.connectWallet())

    document.getElementById('disconnect-wallet-btn')
      ?.addEventListener('click', () => this.disconnectWallet())

    document.getElementById('create-form')
      ?.addEventListener('submit', e => this.createLink(e))

    document.getElementById('claim-form')
      ?.addEventListener('submit', e => this.verifyLink(e))

    document.getElementById('close-success-modal')
      ?.addEventListener('click', () => this.hideSuccessModal())

    document.getElementById('copy-link-btn')
      ?.addEventListener('click', () => this.copyGeneratedLink())

    document.getElementById('confirm-claim-btn')
      ?.addEventListener('click', () => this.claim())
  }

  // ================= MODE =================
  private switchMode(mode: 'create' | 'claim' | 'history') {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')
      btn.classList.add('text-gray-400')
    })

    const active = document.getElementById(`mode-${mode}`)
    active?.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')

    document.getElementById('section-create')?.classList.add('hidden')
    document.getElementById('section-claim')?.classList.add('hidden')
    document.getElementById('section-history')?.classList.add('hidden')

    document.getElementById(`section-${mode}`)?.classList.remove('hidden')
  }

  // ================= WALLET =================
  private async connectWallet() {
    try {
      if (!window.solana) {
        alert('❌ Phantom wallet not found. Please install it: https://phantom.app')
        return
      }

      console.log('🔐 Connecting to Phantom...')
      const res = await window.solana.connect()
      this.walletAddress = res.publicKey.toString()
      console.log('✅ Connected:', this.walletAddress)

      document.getElementById('connect-wallet-btn')?.classList.add('hidden')
      document.getElementById('wallet-connected')?.classList.remove('hidden')
      document.getElementById('wallet-address')!.textContent =
        `${this.walletAddress.slice(0, 4)}...${this.walletAddress.slice(-4)}`

      this.setStatus('✅ Wallet connected')
    } catch (err: any) {
      console.error('❌ Wallet connection failed:', err.message)
      this.setStatus(`❌ Connection failed: ${err.message}`)
    }
  }

  private disconnectWallet() {
    this.walletAddress = null
    this.pendingLamports = null
    this.setStatus('Disconnected')
  }

  // 🔐 WALLET WRAPPER (INI KUNCI STABILITAS)
  private getSigningWallet() {
    if (!window.solana) throw new Error('Wallet not connected')

    return {
      publicKey: window.solana.publicKey,
      signTransaction: (tx: any) => window.solana.signTransaction(tx),
      signAllTransactions: (txs: any[]) => window.solana.signAllTransactions(txs),
    }
  }

  // ================= CREATE LINK =================
  private async createLink(e: Event) {
    e.preventDefault()
    if (!this.walletAddress) return alert('❌ Connect wallet first')

    const input = document.getElementById('amount-input') as HTMLInputElement
    const amount = Number(input.value)
    if (!amount || amount <= 0) return this.setStatus('❌ Invalid amount (must be > 0)')

    try {
      this.showLoadingModal('Creating link…')
      console.log(`📝 Creating link for ${amount} SOL...`)

      // Use the complete createLink flow (backend + real deposit + record)
      const { linkId, depositTx } = await createLink({
        amountSOL: amount,
        wallet: this.getSigningWallet(),
      })

      const linkUrl = `${window.location.origin}?link=${linkId}`
      ;(document.getElementById('generated-link') as HTMLInputElement).value = linkUrl

      this.hideLoadingModal()
      this.showSuccessModal()
      this.setStatus(`✅ Link ready: ${linkId}`)
      input.value = ''
    } catch (err: any) {
      console.error('❌ Create link error:', err)
      this.hideLoadingModal()
      const errMsg = err?.message || 'Unknown error'
      this.setStatus(`❌ Error: ${errMsg}`)
    }
  }

  // ================= VERIFY =================
  private async verifyLink(e: Event) {
    e.preventDefault()
    const input = document.getElementById('link-id-input') as HTMLInputElement
    const linkId = input.value.trim()
    if (!linkId) return

    const res = await fetch(`${API_URL}/link/${linkId}`)
    if (!res.ok) return this.setStatus('❌ Invalid link')

    const data = await res.json()
    
    // 📌 SAVE TO STATE
    window.currentLinkId = linkId
    this.pendingLamports = Math.round(data.amount * 1e9)

    // 📌 SHOW PREVIEW CARD (WAJIB!)
    const previewCard = document.getElementById('preview-card')
    if (previewCard) {
      previewCard.classList.remove('hidden')
    }

    // 📌 UPDATE PREVIEW VALUES
    const amountEl = document.getElementById('preview-amount')
    if (amountEl) {
      amountEl.textContent = `${data.amount.toFixed(3)}`
    }

    const memoEl = document.getElementById('preview-memo')
    if (memoEl) {
      memoEl.textContent = data.memo || 'No memo'
    }

    // 📌 SHOW CONFIRM BUTTON (WAJIB!)
    const confirmBtn = document.getElementById('confirm-claim-btn')
    if (confirmBtn) {
      confirmBtn.classList.remove('hidden')
    }

    this.setStatus(`✅ Link valid: ${data.amount} SOL`)
  }

  // ================= CLAIM =================
  private async claim() {
    if (!window.currentLinkId || !this.walletAddress) {
      return alert('❌ No link selected or wallet not connected')
    }

    try {
      this.showLoadingModal('Withdrawing...')
      console.log(`💸 Claiming link ${window.currentLinkId}...`)

      // Import executeClaimLink dynamically
      const { executeClaimLink } = await import('./flows/claimLinkFlow.js')

      await executeClaimLink({
        linkId: window.currentLinkId,
        recipientAddress: this.walletAddress,
      })

      this.hideLoadingModal()
      this.setStatus('✅ Withdrawal complete')
    } catch (err: any) {
      console.error('❌ Claim error:', err)
      this.hideLoadingModal()
      const errMsg = err?.message || 'Unknown error'
      this.setStatus(`❌ Error: ${errMsg}`)
    }
  }

  // ================= UI =================
  private showLoadingModal(msg: string) {
    const el = document.getElementById('loading-message')
    if (el) el.textContent = msg
    document.getElementById('loading-modal')?.classList.remove('hidden')
  }

  private hideLoadingModal() {
    document.getElementById('loading-modal')?.classList.add('hidden')
  }

  private showSuccessModal() {
    document.getElementById('success-modal')?.classList.remove('hidden')
  }

  private hideSuccessModal() {
    document.getElementById('success-modal')?.classList.add('hidden')
  }

  private copyGeneratedLink() {
    const linkInput = document.getElementById('generated-link') as HTMLInputElement
    if (linkInput && linkInput.value) {
      navigator.clipboard.writeText(linkInput.value)
      this.setStatus('✅ Link copied to clipboard')
    }
  }

  private setStatus(msg: string) {
    const el = document.getElementById('status-message')
    if (el) el.textContent = msg
    console.log(msg)
  }
}

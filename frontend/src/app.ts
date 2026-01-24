/// <reference types="vite/client" />

import { executeDeposit } from './flows/depositFlow.js'

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
      ?.addEventListener('click', async () => {
        this.switchMode('history')
        await this.loadHistory()
      })

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

    // History tabs
    document.getElementById('history-sent-tab')
      ?.addEventListener('click', () => {
        document.getElementById('history-sent-content')?.classList.remove('hidden')
        document.getElementById('history-received-content')?.classList.add('hidden')
        document.getElementById('history-sent-tab')?.classList.add('bg-purple-500/20', 'text-purple-300')
        document.getElementById('history-sent-tab')?.classList.remove('bg-gray-800', 'text-gray-400')
        document.getElementById('history-received-tab')?.classList.add('bg-gray-800', 'text-gray-400')
        document.getElementById('history-received-tab')?.classList.remove('bg-purple-500/20', 'text-purple-300')
      })

    document.getElementById('history-received-tab')
      ?.addEventListener('click', () => {
        document.getElementById('history-sent-content')?.classList.add('hidden')
        document.getElementById('history-received-content')?.classList.remove('hidden')
        document.getElementById('history-received-tab')?.classList.add('bg-purple-500/20', 'text-purple-300')
        document.getElementById('history-received-tab')?.classList.remove('bg-gray-800', 'text-gray-400')
        document.getElementById('history-sent-tab')?.classList.add('bg-gray-800', 'text-gray-400')
        document.getElementById('history-sent-tab')?.classList.remove('bg-purple-500/20', 'text-purple-300')
      })
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

    // Reset claim preview when switching away from claim mode
    if (mode !== 'claim') {
      document.getElementById('preview-card')?.classList.add('hidden')
    }
  }

  // ================= WALLET =================
  private async connectWallet() {
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
  }

  private disconnectWallet() {
    this.walletAddress = null
    this.pendingLamports = null
    this.setStatus('Disconnected')
  }

  // 🔐 WALLET WRAPPER (INI KUNCI STABILITAS)
  private getSigningWallet() {
    if (!window.solana) throw new Error('Wallet not found')

    return {
      publicKey: window.solana.publicKey,
      signMessage: (msg: Uint8Array) => window.solana.signMessage(msg),
    }
  }

  // ================= CREATE LINK =================
  private async createLink(e: Event) {
    e.preventDefault()
    if (!this.walletAddress) return alert('Connect wallet first')

    const input = document.getElementById('amount-input') as HTMLInputElement
    const amount = Number(input.value)
    if (!amount || amount <= 0) return this.setStatus('❌ Invalid amount')

    try {
      this.showLoadingModal('Creating link…')

      // 1️⃣ Create link metadata
      const res = await fetch(`${API_URL}/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, assetType: 'SOL' }),
      })
      if (!res.ok) throw new Error('Create link failed')

      const { linkId } = await res.json()

      // 📌 SAVE LINKID TO GLOBAL STATE (WAJIB!)
      window.currentLinkId = linkId

      // 2️⃣ Deposit via Privacy Cash (PHANTOM POPUP HERE)
      await executeDeposit({
        linkId,
        lamports: Math.round(amount * 1e9),
        wallet: this.getSigningWallet(),
      })

      const linkUrl = `${window.location.origin}?link=${linkId}`
      ;(document.getElementById('generated-link') as HTMLInputElement).value = linkUrl

      this.hideLoadingModal()
      this.showSuccessModal()
      this.setStatus(`✅ Link ready: ${linkId}`)
      await this.loadHistory()
      input.value = ''
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus('❌ Failed to create link')
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
    if (!window.currentLinkId || !this.walletAddress) return alert('No link selected')

    try {
      this.showLoadingModal('Withdrawing...')

      // Import executeClaimLink dynamically
      const { executeClaimLink } = await import('./flows/claimLinkFlow.js')

      await executeClaimLink({
        linkId: window.currentLinkId,
        wallet: this.getSigningWallet(),
      })

      this.hideLoadingModal()
      this.setStatus('✅ Withdrawal complete')
      await this.loadHistory()
    } catch (err) {
      console.error(err)
      this.hideLoadingModal()
      this.setStatus('❌ Withdrawal failed')
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

  // ================= HISTORY =================
  private async loadHistory() {
    if (!this.walletAddress) {
      this.setStatus('❌ Connect wallet to view history')
      return
    }

    try {
      this.showLoadingModal('Loading history…')

      const res = await fetch(
        `${API_URL}/history/${this.walletAddress}`
      )

      if (!res.ok) throw new Error('Failed to load history')

      const data = await res.json()
      
      console.log('📊 History data received:', data)

      // ✅ DEFENSIVE: ensure arrays exist
      const sent = Array.isArray(data.sent) ? data.sent : []
      const received = Array.isArray(data.received) ? data.received : []

      console.log(`📤 Sent: ${sent.length} links`)
      console.log(`📥 Received: ${received.length} links`)

      this.renderSentHistory(sent)
      this.renderReceivedHistory(received)
      
      // Reset tab view to Sent by default
      document.getElementById('history-sent-content')?.classList.remove('hidden')
      document.getElementById('history-received-content')?.classList.add('hidden')
      document.getElementById('history-sent-tab')?.classList.add('bg-purple-500/20', 'text-purple-300')
      document.getElementById('history-sent-tab')?.classList.remove('bg-gray-800', 'text-gray-400')
      document.getElementById('history-received-tab')?.classList.add('bg-gray-800', 'text-gray-400')
      document.getElementById('history-received-tab')?.classList.remove('bg-purple-500/20', 'text-purple-300')
      
      this.hideLoadingModal()
      this.setStatus(`✅ History loaded: ${sent.length} sent, ${received.length} received`)
    } catch (err) {
      console.error('❌ History load error:', err)
      this.hideLoadingModal()
      this.setStatus('❌ Failed to load history')
    }
  }

  private renderSentHistory(items: any[]) {
    const list = document.getElementById('sent-list')!
    const empty = document.getElementById('sent-empty')!

    list.innerHTML = ''

    if (items.length === 0) {
      empty.classList.remove('hidden')
      return
    }

    empty.classList.add('hidden')

    items.forEach(item => {
      const div = document.createElement('div')
      div.className = 'history-item glass-card p-4 rounded-xl'
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-gray-400">Link ID</p>
            <p class="font-mono text-white text-sm">${item.linkId}</p>
            <p class="text-xs text-gray-500">${new Date(item.createdAt).toLocaleString()}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-purple-400">${item.amount} SOL</p>
            <p class="text-xs ${item.claimed ? 'text-green-400' : 'text-yellow-400'}">
              ${item.claimed ? '✅ Claimed' : '⏳ Unclaimed'}
            </p>
          </div>
        </div>
      `
      list.appendChild(div)
    })
  }

  private renderReceivedHistory(items: any[]) {
    const list = document.getElementById('received-list')!
    const empty = document.getElementById('received-empty')!

    list.innerHTML = ''

    if (items.length === 0) {
      empty.classList.remove('hidden')
      return
    }

    empty.classList.add('hidden')

    items.forEach(item => {
      const div = document.createElement('div')
      div.className = 'history-item glass-card p-4 rounded-xl'
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-gray-400">From Link</p>
            <p class="font-mono text-white text-sm">${item.linkId}</p>
            <p class="text-xs text-gray-500">${new Date(item.claimedAt).toLocaleString()}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-cyan-400">${item.amount} SOL</p>
            <p class="text-xs text-green-400">✅ Claimed</p>
          </div>
        </div>
      `
      list.appendChild(div)
    })
  }
}

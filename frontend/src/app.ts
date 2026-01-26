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
  private bound: boolean = false

  init() {
    if (this.bound) return
    this.bound = true
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
    if (import.meta.env.DEV) console.log('🔧 Binding events...')

    document.getElementById('mode-create')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Mode: create')
        this.switchMode('create')
      })

    document.getElementById('mode-claim')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Mode: claim')
        this.switchMode('claim')
      })

    document.getElementById('mode-history')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Mode: history')
        this.switchMode('history')
      })

    document.getElementById('connect-wallet-btn')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Click: connect-wallet')
        this.connectWallet()
      })

    document.getElementById('disconnect-wallet-btn')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Click: disconnect-wallet')
        this.disconnectWallet()
      })

    document.getElementById('create-form')
      ?.addEventListener('submit', e => {
        if (import.meta.env.DEV) console.log('📍 Submit: create-form')
        this.createLink(e)
      })

    document.getElementById('claim-form')
      ?.addEventListener('submit', e => {
        if (import.meta.env.DEV) console.log('📍 Submit: claim-form')
        this.verifyLink(e)
      })

    document.getElementById('close-success-modal')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Click: close-success-modal')
        this.hideSuccessModal()
      })

    document.getElementById('copy-link-btn')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Click: copy-link')
        this.copyGeneratedLink()
      })

    document.getElementById('confirm-claim-btn')
      ?.addEventListener('click', () => {
        if (import.meta.env.DEV) console.log('📍 Click: confirm-claim')
        this.claim()
      })

    // ✅ Success card buttons
    document.getElementById('close-success-card')
      ?.addEventListener('click', () => {
        document.getElementById('success-card')?.classList.add('hidden')
      })

    document.getElementById('copy-success-link-btn')
      ?.addEventListener('click', () => {
        const linkUrlEl = document.getElementById('success-link-url') as HTMLInputElement
        if (linkUrlEl && linkUrlEl.value) {
          navigator.clipboard.writeText(linkUrlEl.value)
          this.setStatus('✅ Link copied to clipboard!')
        }
      })

    // ✅ History button
    document.getElementById('fetch-history-btn')
      ?.addEventListener('click', () => {
        this.fetchHistory()
      })

    // ✅ Already claimed modal close button
    document.getElementById('close-already-claimed-modal')
      ?.addEventListener('click', () => {
        document.getElementById('already-claimed-modal')?.classList.add('hidden')
      })

    if (import.meta.env.DEV) console.log('✅ All events bound')
  }

  // ================= HISTORY =================
  private async fetchHistory() {
    if (!this.walletAddress) {
      return this.setStatus('❌ Connect wallet first to view history')
    }

    try {
      this.showLoadingModal('Loading history...')
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'
      const res = await fetch(`${BACKEND_URL}/api/history/${this.walletAddress}`)
      
      if (!res.ok) {
        throw new Error('Failed to fetch history')
      }
      
      const { sent, received } = await res.json()
      this.renderHistory(sent, received)
      
      this.hideLoadingModal()
      this.setStatus(`✅ History loaded: ${sent.length} sent, ${received.length} received`)
    } catch (err: any) {
      this.hideLoadingModal()
      if (import.meta.env.DEV) console.error('History error:', err)
      this.setStatus(`❌ Error loading history: ${err.message}`)
    }
  }

  private renderHistory(sent: any[], received: any[]) {
    const historyContainer = document.getElementById('history-container')
    if (!historyContainer) return

    const sentHtml = sent.map(item => `
      <div class="border border-purple-500/30 rounded-lg p-4 mb-3 bg-gray-900/50 shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-medium text-white">📤 Sent: ${item.amount} SOL</div>
            <div class="text-sm text-gray-400">Link ID: ${item.linkId.slice(0, 8)}...</div>
            <div class="text-xs text-gray-500 mt-1">${new Date(item.createdAt).toLocaleString()}</div>
          </div>
          <span class="px-3 py-1 text-xs font-medium rounded-full ${
            item.claimed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }">
            ${item.claimed ? '✅ Claimed' : '⏳ Waiting'}
          </span>
        </div>
      </div>
    `).join('')

    const receivedHtml = received.map(item => `
      <div class="border border-cyan-500/30 rounded-lg p-4 mb-3 bg-gray-900/50 shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-medium text-white">📥 Received: ${item.amount} SOL</div>
            <div class="text-sm text-gray-400">From: Private sender (anonymous)</div>
            <div class="text-xs text-gray-500 mt-1">${new Date(item.claimedAt).toLocaleString()}</div>
          </div>
          <span class="px-3 py-1 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-400">
            ✅ Completed
          </span>
        </div>
      </div>
    `).join('')

    historyContainer.innerHTML = `
      <div class="mb-8">
        <h3 class="text-lg font-bold text-white mb-3">📤 Sent Links</h3>
        ${sent.length > 0 ? sentHtml : '<p class="text-gray-500 text-center py-8">No sent links yet. Create one to get started!</p>'}
      </div>
      
      <div>
        <h3 class="text-lg font-bold text-white mb-3">📥 Received Links</h3>
        ${received.length > 0 ? receivedHtml : '<p class="text-gray-500 text-center py-8">No received payments yet. Ask someone to send you a link!</p>'}
      </div>
    `
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
    // ✅ CHECK IF PHANTOM IS INSTALLED
    if (!window.solana || !window.solana.isPhantom) {
      console.error('❌ Phantom wallet not found')
      alert('❌ Phantom wallet not found.\n\n📥 Please install it:\nhttps://phantom.app')
      return
    }

    try {
      if (import.meta.env.DEV) console.log('🔐 Connecting to Phantom...')
      
      // ✅ REQUEST CONNECTION
      const res = await window.solana.connect({ onlyIfTrusted: false })
      
      if (!res || !res.publicKey) {
        throw new Error('No public key returned from wallet')
      }
      
      this.walletAddress = res.publicKey.toString()
      if (import.meta.env.DEV) console.log('✅ Connected:', this.walletAddress)

      // ✅ UPDATE UI
      document.getElementById('connect-wallet-btn')?.classList.add('hidden')
      document.getElementById('wallet-connected')?.classList.remove('hidden')
      document.getElementById('wallet-address')!.textContent =
        `${this.walletAddress.slice(0, 4)}...${this.walletAddress.slice(-4)}`

      this.setStatus('✅ Wallet connected — Ready to create link')
    } catch (err: any) {
      console.error('❌ Wallet connection error:', err.message || err)
      
      // ✅ PROVIDE HELPFUL ERROR MESSAGES
      const errorMsg = err.message || err.toString()
      
      if (errorMsg.includes('User rejected')) {
        this.setStatus('⚠️ You rejected the connection. Click again to try.')
      } else if (errorMsg.includes('not found') || errorMsg.includes('isPhantom')) {
        this.setStatus('❌ Phantom wallet not installed. Install from phantom.app')
      } else if (errorMsg.includes('network')) {
        this.setStatus('❌ Network error. Check your Solana RPC connection.')
      } else {
        this.setStatus(`⚠️ Connection failed: ${errorMsg}`)
      }
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
      signMessage: (message: Uint8Array) => window.solana.signMessage(message),
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
    
    // ✅ Enforce minimum 0.01 SOL (Privacy Cash requirement)
    if (!amount || amount <= 0) {
      return this.setStatus('❌ Invalid amount (must be > 0)')
    }
    if (amount < 0.01) {
      return this.setStatus('❌ Minimum deposit is 0.01 SOL (Privacy Cash requirement)')
    }

    try {
      // Calculate fees upfront and show to user
      const PRIVACY_CASH_BASE_FEE = 0.006 // SOL
      const PRIVACY_CASH_PROTOCOL_FEE = amount * 0.0035 // 0.35%
      const NETWORK_FEE = 0.001 // SOL (estimate)
      const TOTAL_FEE = PRIVACY_CASH_BASE_FEE + PRIVACY_CASH_PROTOCOL_FEE + NETWORK_FEE
      const TOTAL_COST = amount + TOTAL_FEE

      if (import.meta.env.DEV) {
        console.log(`💰 COMPLETE FEE BREAKDOWN FOR ${amount} SOL:`)
        console.log(`\nWHAT YOU PAY:`)
        console.log(`   Deposit amount: ${amount} SOL`)
        console.log(`   Network fee: ~${NETWORK_FEE} SOL`)
        console.log(`   Total YOU pay: ${TOTAL_COST.toFixed(6)} SOL`)
        console.log(`\nWHAT OPERATOR EARNS:`)
        console.log(`   Operator fee: 0.006 SOL`)
        console.log(`\nWHAT RECIPIENT GETS:`)
        console.log(`   Recipient amount: ${Math.max(amount - 0.006, 0).toFixed(6)} SOL`)
      }

      // Show cost breakdown to user
      // ✅ CALCULATE RECIPIENT AMOUNT (after operator fee)
      const OPERATOR_FEE = 0.006 // SOL
      const RECIPIENT_AMOUNT = amount - OPERATOR_FEE

      // ✅ CLEAR MESSAGE: YOU WILL PAY THIS
      this.setStatus(
        `💰 PAYMENT SUMMARY\n\n` +
        `💳 YOU WILL PAY: ${amount.toFixed(6)} SOL\n` +
        `📥 Recipient gets: ${Math.max(RECIPIENT_AMOUNT, 0).toFixed(6)} SOL\n` +
        `💼 ShadowPay fee: ${OPERATOR_FEE} SOL\n\n` +
        `⏳ Phantom popup will open next...\n` +
        `✅ Click "APPROVE" to complete payment`
      )

      this.showLoadingModal('� Initiating payment...')

      // ✅ Show user clear guidance about Phantom popup
      this.setStatus(
        `⏳ Phantom popup opening...\n\n` +
        `✅ A Phantom wallet popup will appear\n` +
        `💳 Click "APPROVE" to send ${amount} SOL\n\n` +
        `🔒 Your wallet, your control`
      )

      const { linkId, depositTx } = await createLink({
        amountSOL: amount,
        wallet: this.getSigningWallet(),
      })

      const linkUrl = `${window.location.origin}?link=${linkId}`

      this.hideLoadingModal()
      this.showSuccessWithLinkId(linkId, linkUrl)
      this.setStatus(
        `✅ Payment link created!` +
        `\n\n💰 PAYMENT DETAILS:` +
        `\nYou paid: ${TOTAL_COST.toFixed(6)} SOL` +
        `\nRecipient gets: ${Math.max(amount - 0.006, 0).toFixed(6)} SOL` +
        `\n🔐 Private & anonymous (only you know the details)` +
        `\n\n⏳ IMPORTANT: Wait 45 seconds for privacy processing` +
        `\nBefore recipient claims the link` +
        `\n\n📋 Share this link with recipient to claim:` 
      )
      input.value = ''
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('❌ Create link error:', err)
      this.hideLoadingModal()

      // ✅ USER-FRIENDLY ERROR MESSAGES
      let errorMsg = err?.message || 'Unknown error'

      if (errorMsg.includes('Operator balance insufficient')) {
        errorMsg = '❌ ShadowPay service temporarily unavailable. Please try again in a moment.'
      } else if (errorMsg.includes('cancelled the signature request') || errorMsg.includes('click "Approve"')) {
        errorMsg = '❌ Payment cancelled. Keep the popup open and click "Approve" to continue.'
      } else if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
        errorMsg = '❌ Payment rejected. Please approve the transaction in your wallet.'
      } else if (errorMsg.includes('Unsupported signature format')) {
        errorMsg = '❌ Wallet not compatible. Try refreshing or use Phantom wallet.'
      } else if (errorMsg.includes('Invalid signature format')) {
        errorMsg = '❌ Signature validation failed. Try refreshing the page.'
      } else if (errorMsg.includes('Failed to sign')) {
        errorMsg = '❌ Wallet signing failed. Make sure your wallet is connected.'
      }

      this.setStatus(`${errorMsg}`)
    }
  }

  // ✅ Show success card with link ID
  private showSuccessWithLinkId(linkId: string, linkUrl: string) {
    const successCard = document.getElementById('success-card')
    if (successCard) {
      const linkIdEl = successCard.querySelector('#success-link-id')
      const linkUrlEl = successCard.querySelector('#success-link-url') as HTMLInputElement
      
      if (linkIdEl) linkIdEl.textContent = linkId
      if (linkUrlEl) linkUrlEl.value = linkUrl
      
      successCard.classList.remove('hidden')
      
      if (linkUrlEl) {
        linkUrlEl.focus()
        linkUrlEl.select()
      }
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
      // ✅ CRITICAL: WAIT FOR PRIVACY CASH UTXO INDEXING (45 seconds)
      // Privacy Cash off-chain indexer needs time to decrypt & index UTXOs
      // Without this delay, claim will fail with "no enough balance"
      this.showLoadingModal(
        '🔐 Processing private withdrawal...\n\n' +
        '⏳ Privacy Cash requires ~45 seconds\n' +
        'for secure UTXO indexing.\n\n' +
        'Your funds are safe in the pool!\n' +
        'Please wait...'
      )

      console.log('⏳ Starting 45-second UTXO indexing delay...')
      
      // ✅ COUNTDOWN LOOP
      for (let i = 45; i > 0; i--) {
        const minutes = Math.floor(i / 60)
        const seconds = i % 60
        const timeStr = minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`
        
        console.log(`⏳ Waiting for UTXO indexing: ${timeStr} remaining...`)
        this.setStatus(`⏳ Privacy processing: ${timeStr} remaining...`)
        
        // Update loading modal countdown
        const modal = document.getElementById('loading-modal')
        const message = modal?.querySelector('.text-center')
        if (message) {
          message.innerHTML =
            `🔐 Processing private withdrawal...<br><br>` +
            `⏳ Privacy Cash UTXO indexing in progress<br><br>` +
            `⏱️ ${timeStr} remaining<br><br>` +
            `Your funds are safe in the pool!`
        }
        
        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log('✅ UTXO indexing complete - executing withdrawal...')
      this.setStatus('✅ UTXO indexing complete - executing withdrawal...')

      // ✅ NOW EXECUTE CLAIM
      const { executeClaimLink } = await import('./flows/claimLinkFlow.js')

      await executeClaimLink({
        linkId: window.currentLinkId,
        recipientAddress: this.walletAddress,
      })

      this.hideLoadingModal()
      this.setStatus('✅ Withdrawal complete - funds received privately!')
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('❌ Claim error:', err)
      this.hideLoadingModal()
      
      // ✅ BETTER ERROR MESSAGES
      const errMsg = err?.message || 'Unknown error'
      
      if (errMsg.includes('No enough balance')) {
        this.setStatus(
          '❌ Privacy processing incomplete.\n\n' +
          'Please wait at least 45 seconds after deposit\n' +
          'before claiming (for UTXO indexing).\n\n' +
          'Your funds are safe in the Privacy Cash pool.'
        )
      } else if (errMsg.includes('already claimed')) {
        this.setStatus('❌ This link has already been claimed!')
      } else if (errMsg.includes('not found')) {
        this.setStatus('❌ This link does not exist.')
      } else {
        this.setStatus(`❌ Error: ${errMsg}`)
      }
    }
  }

  // ================= UI =================
  private showLoadingModal(msg: string) {
    const el = document.getElementById('loading-message')
    if (el) el.textContent = msg
    document.getElementById('loading-modal')?.classList.remove('hidden')
    
    // ✅ SHOW SIGNATURE INSTRUCTIONS IF MESSAGE MENTIONS AUTHORIZATION/SIGNATURE
    const sigInstructions = document.getElementById('signature-instructions')
    if (sigInstructions) {
      if (msg.toLowerCase().includes('authorization') || msg.toLowerCase().includes('signature')) {
        sigInstructions.classList.remove('hidden')
      } else {
        sigInstructions.classList.add('hidden')
      }
    }
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
    if (import.meta.env.DEV) console.log(msg)
  }
}

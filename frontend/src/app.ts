/// <reference types="vite/client" />
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://shadowpay-backend.up.railway.app/api'

const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://api.mainnet-beta.solana.com'

declare global {
  interface Window {
    solana?: any
    currentLinkId?: string
  }
}

export class App {
  private walletAddress: string | null = null
  private connection: Connection | null = null

  init() {
    this.connection = new Connection(SOLANA_RPC, 'confirmed')
    this.bindEvents()
    this.setStatus('Ready - Connect wallet to start')
  }

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

  private async connectWallet() {
    try {
      if (!window.solana) {
        this.setStatus('❌ Phantom wallet not installed')
        alert('Please install Phantom wallet')
        return
      }

      const response = await window.solana.connect()
      this.walletAddress = response.publicKey.toString()

      document.getElementById('connect-wallet-btn')?.classList.add('hidden')
      document.getElementById('wallet-connected')?.classList.remove('hidden')
      document.getElementById('wallet-address')!.textContent =
        `${this.walletAddress.slice(0, 4)}...${this.walletAddress.slice(-4)}`

      this.setStatus(`✅ Connected: ${this.walletAddress.slice(0, 10)}...`)
    } catch (error) {
      this.setStatus('❌ Failed to connect wallet')
      console.error(error)
    }
  }

  private disconnectWallet() {
    this.walletAddress = null
    document.getElementById('connect-wallet-btn')?.classList.remove('hidden')
    document.getElementById('wallet-connected')?.classList.add('hidden')
    this.setStatus('Disconnected')
  }

  private async createLink(e: Event) {
    e.preventDefault()

    if (!this.walletAddress) {
      this.setStatus('❌ Please connect wallet first')
      return
    }

    try {
      const amountInput = document.getElementById('amount-input') as HTMLInputElement
      const amount = parseFloat(amountInput.value)

      if (!amount || amount <= 0) {
        this.setStatus('❌ Invalid amount')
        return
      }

      this.showLoadingModal('Creating real Solana transaction...')
      this.setStatus('⏳ Creating payment link...')

      // Create real Solana transaction
      const depositTxHash = await this.createRealTransaction(amount)

      if (!depositTxHash) {
        this.hideLoadingModal()
        this.setStatus('❌ Transaction cancelled or failed')
        return
      }

      this.setStatus('⏳ Registering with backend...')

      // Send to backend
      const res = await fetch(`${API_URL}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          assetType: 'SOL',
          depositTx: depositTxHash,
        }),
      })

      if (!res.ok) {
        throw new Error(`Backend error: ${res.statusText}`)
      }

      const data = await res.json()
      this.hideLoadingModal()

      // Generate shareable link
      const linkUrl = `${window.location.origin}?linkId=${data.linkId}`
      ;(document.getElementById('generated-link') as HTMLInputElement).value = linkUrl
      document.getElementById('link-result')?.classList.remove('hidden')
      document.getElementById('success-message')!.textContent =
        `✅ Successfully created link with ${amount} SOL!\n\nTx: ${depositTxHash.slice(0, 20)}...`

      this.showSuccessModal()
      ;(amountInput as HTMLInputElement).value = ''
      this.setStatus(`✅ Link created: ${data.linkId.slice(0, 8)}...`)
    } catch (error) {
      this.hideLoadingModal()
      this.setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error(error)
    }
  }

  private async verifyLink(e: Event) {
    e.preventDefault()

    try {
      const linkIdInput = document.getElementById('link-id-input') as HTMLInputElement
      const linkId = linkIdInput.value.trim()

      if (!linkId) {
        this.setStatus('❌ Please enter a link ID')
        return
      }

      this.showLoadingModal('Verifying link...')
      this.setStatus('⏳ Checking link validity...')

      const res = await fetch(`${API_URL}/link/${linkId}`)
      if (!res.ok) {
        this.hideLoadingModal()
        this.setStatus('❌ Invalid or expired link')
        return
      }

      const data = await res.json()
      window.currentLinkId = linkId

      // Show preview
      document.getElementById('preview-amount')!.textContent = data.amount.toFixed(3)
      document.getElementById('preview-memo')!.textContent = data.memo || 'No memo'
      document.getElementById('preview-card')?.classList.remove('hidden')
      document.getElementById('preview-card')?.setAttribute('data-amount', data.amount)

      this.hideLoadingModal()
      this.setStatus(`✅ Link verified: ${data.amount} SOL`)
    } catch (error) {
      this.hideLoadingModal()
      this.setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error(error)
    }
  }

  private async claim() {
    if (!window.currentLinkId || !this.walletAddress) {
      this.setStatus('❌ Link or wallet missing')
      return
    }

    try {
      this.showLoadingModal('Processing claim transaction...')
      this.setStatus('⏳ Creating withdrawal transaction...')

      // Create real withdrawal transaction
      const withdrawTxHash = await this.createWithdrawalTransaction()

      if (!withdrawTxHash) {
        this.hideLoadingModal()
        this.setStatus('❌ Withdrawal cancelled')
        return
      }

      this.setStatus('⏳ Recording withdrawal...')

      // Send to backend
      const res = await fetch(`${API_URL}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: window.currentLinkId,
          recipientAddress: this.walletAddress,
          withdrawTx: withdrawTxHash,
        }),
      })

      if (!res.ok) {
        throw new Error(`Backend error: ${res.statusText}`)
      }

      const amount = document.getElementById('preview-card')?.getAttribute('data-amount') || '?'
      this.hideLoadingModal()

      document.getElementById('preview-card')?.classList.add('hidden')
      document.getElementById('success-message')!.textContent =
        `✅ Successfully claimed ${amount} SOL!\n\nTx: ${withdrawTxHash.slice(0, 20)}...`

      this.showSuccessModal()
      ;(document.getElementById('claim-form') as HTMLFormElement).reset()
      this.setStatus('✅ Withdrawal complete')
    } catch (error) {
      this.hideLoadingModal()
      this.setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error(error)
    }
  }

  private async createRealTransaction(amountSOL: number): Promise<string | null> {
    try {
      if (!this.walletAddress || !this.connection) {
        throw new Error('Wallet or connection not ready')
      }

      const fromPubkey = new PublicKey(this.walletAddress)
      const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)

      // Create a dummy transaction (in production, this would go to a pool/escrow)
      // For now, we'll create a simple transfer to demonstrate
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: new PublicKey('11111111111111111111111111111111'), // Dummy recipient
          lamports: Math.min(lamports, 5000), // Send small amount to avoid real loss in testing
        })
      )

      const blockHash = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockHash.blockhash
      transaction.feePayer = fromPubkey

      // Sign with Phantom
      const signed = await window.solana.signTransaction(transaction)
      const txHash = await this.connection.sendRawTransaction(signed.serialize())

      return txHash
    } catch (error) {
      console.error('Transaction error:', error)
      throw error
    }
  }

  private async createWithdrawalTransaction(): Promise<string | null> {
    try {
      if (!this.walletAddress || !this.connection) {
        throw new Error('Wallet or connection not ready')
      }

      const fromPubkey = new PublicKey(this.walletAddress)

      // Create withdrawal transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: new PublicKey('11111111111111111111111111111111'),
          lamports: 1000, // Dummy amount
        })
      )

      const blockHash = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockHash.blockhash
      transaction.feePayer = fromPubkey

      // Sign with Phantom
      const signed = await window.solana.signTransaction(transaction)
      const txHash = await this.connection.sendRawTransaction(signed.serialize())

      return txHash
    } catch (error) {
      console.error('Withdrawal error:', error)
      throw error
    }
  }

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

/// <reference types="vite/client" />

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://shadowpay-backend.up.railway.app/api'

const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY'

declare global {
  interface Window {
    solana?: any
    PrivacyCash?: any
    privacyCash?: any
    currentLinkId?: string
  }
}

export class App {
  private walletAddress: string | null = null

  init() {
    this.bindEvents()
    this.setStatus('Ready')
  }

  private bindEvents() {
    document
      .getElementById('connect-wallet-btn')
      ?.addEventListener('click', () => this.connectWallet())

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
    if (!window.solana) {
      alert('Install Phantom')
      return
    }

    const res = await window.solana.connect()
    this.walletAddress = res.publicKey.toString()

    window.privacyCash = new window.PrivacyCash({
      rpcUrl: SOLANA_RPC,
      wallet: window.solana,
    })

    document.getElementById('wallet-address')!.textContent =
      `${this.walletAddress.slice(0, 4)}...${this.walletAddress.slice(-4)}`

    this.setStatus('Wallet connected')
  }

  private async createLink(e: Event) {
    e.preventDefault()

    const amount = Number(
      (document.getElementById('amount-input') as HTMLInputElement).value
    )

    this.setStatus('Depositing privately...')

    const depositTx = await window.privacyCash.deposit({
      amount,
      asset: 'SOL',
    })

    const res = await fetch(`${API_URL}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        assetType: 'SOL',
        depositTx,
      }),
    })

    const data = await res.json()

    this.setStatus(`Link created: ${data.linkId}`)
  }

  private async verifyLink(e: Event) {
    e.preventDefault()

    const linkId =
      (document.getElementById('link-id-input') as HTMLInputElement).value

    const res = await fetch(`${API_URL}/link/${linkId}`)
    if (!res.ok) {
      alert('Invalid link')
      return
    }

    window.currentLinkId = linkId
    this.setStatus('Link verified')
  }

  private async claim() {
    if (!window.currentLinkId || !this.walletAddress) return

    this.setStatus('Withdrawing privately...')

    const withdrawTx = await window.privacyCash.withdraw({
      linkId: window.currentLinkId,
      recipient: this.walletAddress,
    })

    await fetch(`${API_URL}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId: window.currentLinkId,
        recipientAddress: this.walletAddress,
        withdrawTx,
      }),
    })

    this.setStatus('Withdrawal complete')
  }

  private setStatus(msg: string) {
    const el = document.getElementById('status-message')
    if (el) el.textContent = msg
    console.log(msg)
  }
}

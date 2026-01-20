// src/app.ts

import { PrivacyCash } from 'privacy-cash-sdk';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// --- Types ---
interface Transaction {
  id: string;
  amount: number;
  memo: string;
  status: 'pending' | 'claimed' | 'received';
  date: number;
  linkId?: string;
}

type History = {
  sent: Transaction[];
  received: Transaction[];
};

// --- Constants ---
const defaultConfig = {
  app_title: 'ShadowPay',
  tagline: 'Send SOL Privately',
  create_button_text: 'Deposit & Create Link',
  claim_button_text: 'Claim Payment',
};

// --- State ---
let walletState = {
  connected: false,
  address: '' as string | null,
  isProcessing: false,
  publicKey: null as PublicKey | null,
};

let transactionHistory: History = {
  sent: [],
  received: [],
};

// --- SDK Instance ---
let privacyCash: PrivacyCash | null = null;

// --- DOM Elements ---
const elements = {
  connectWalletBtn: document.getElementById('connect-wallet-btn')!,
  disconnectWalletBtn: document.getElementById('disconnect-wallet-btn')!,
  walletConnected: document.getElementById('wallet-connected')!,
  walletAddress: document.getElementById('wallet-address')!,
  createForm: document.getElementById('create-form')!,
  claimForm: document.getElementById('claim-form')!,
  previewCard: document.getElementById('preview-card')!,
  previewAmount: document.getElementById('preview-amount')!,
  previewMemo: document.getElementById('preview-memo')!,
  previewExpiry: document.getElementById('preview-expiry')!,
  generatedLink: document.getElementById('generated-link')!,
  successMessage: document.getElementById('success-message')!,
  linkResult: document.getElementById('link-result')!,
  loadingMessage: document.getElementById('loading-message')!,
  copyNotification: document.getElementById('copy-notification')!,
};

// --- Initialize SDK ---
async function initPrivacyCash() {
  try {
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
    // Untuk testing, ganti ke devnet:
    // const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    privacyCash = new PrivacyCash({
      connection,
      // Jika ada relayer, tambahkan:
      // relayerUrl: 'https://your-relayer.com/api'
    });

    console.log('✅ PrivacyCash SDK initialized');
  } catch (err) {
    console.error('❌ Failed to initialize PrivacyCash SDK:', err);
    showErrorModal('SDK initialization failed. Please check console.');
  }
}

// --- Wallet Connection (Phantom-like) ---
async function connectWallet() {
  if (walletState.isProcessing || !window.solana) {
    alert('Please install Phantom or compatible Solana wallet');
    return;
  }

  try {
    walletState.isProcessing = true;
    showLoadingModal('Connecting to wallet...');

    const resp = await window.solana.connect();
    const pubKey = new PublicKey(resp.publicKey);
    walletState.connected = true;
    walletState.publicKey = pubKey;
    walletState.address = pubKey.toBase58();
    walletState.isProcessing = false;

    elements.connectWalletBtn.classList.add('hidden');
    elements.walletConnected.classList.remove('hidden');
    elements.walletAddress.textContent = formatAddress(walletState.address);

    hideLoadingModal();
    showNotification('Wallet connected successfully!');
  } catch (err: any) {
    walletState.isProcessing = false;
    hideLoadingModal();
    showErrorModal(`Failed to connect wallet: ${err.message || 'Unknown error'}`);
  }
}

function disconnectWallet() {
  walletState = {
    connected: false,
    address: null,
    isProcessing: false,
    publicKey: null,
  };
  elements.connectWalletBtn.classList.remove('hidden');
  elements.walletConnected.classList.add('hidden');
}

// --- Create Private Link ---
async function handleCreateLink(e: Event) {
  e.preventDefault();
  if (!walletState.connected || !privacyCash) {
    showErrorModal('Please connect your wallet first');
    return;
  }

  const form = e.target as HTMLFormElement;
  const amountInput = form.querySelector('#amount-input') as HTMLInputElement;
  const memoInput = form.querySelector('#memo-input') as HTMLInputElement;
  const expirySelect = form.querySelector('#expiry-select') as HTMLSelectElement;

  const amount = parseFloat(amountInput.value);
  const memo = memoInput.value.trim() || 'No memo';
  const expirySecs = parseInt(expirySelect.value, 10);

  if (!amount || amount <= 0) {
    showErrorModal('Please enter a valid amount');
    return;
  }

  try {
    walletState.isProcessing = true;
    showLoadingModal(
      'Depositing SOL to Privacy Cash pool...<br><small class="text-gray-500">Backend processing with shielded transaction</small>'
    );

    // 🔑 Panggil SDK asli
    const linkId = await privacyCash.deposit({
      amountSol: amount,
      memo,
      expirySeconds: expirySecs,
      sender: walletState.publicKey!,
    });

    const linkUrl = `https://shadowpay.app/claim/${linkId}`;

    transactionHistory.sent.unshift({
      id: Date.now().toString(),
      amount,
      memo,
      status: 'pending',
      date: Date.now(),
      linkId,
    });

    walletState.isProcessing = false;
    hideLoadingModal();

    elements.generatedLink.value = linkUrl;
    elements.linkResult.classList.remove('hidden');
    elements.successMessage.textContent = `Successfully deposited ${amount} SOL! Share this link with the recipient.`;
    showSuccessModal();

    form.reset();
  } catch (err: any) {
    walletState.isProcessing = false;
    hideLoadingModal();
    showErrorModal(`Deposit failed: ${err.message || 'Unknown error'}`);
  }
}

// --- Claim Link ---
async function handleCheckLink(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const input = form.querySelector('#link-id-input') as HTMLInputElement;
  const linkId = input.value.trim();

  if (!linkId) {
    showErrorModal('Please enter a payment link ID');
    return;
  }

  if (!privacyCash) {
    showErrorModal('SDK not initialized');
    return;
  }

  try {
    showLoadingModal('Checking link validity...');
    const info = await privacyCash.getLinkInfo(linkId);

    if (!info) throw new Error('Invalid or expired link');

    elements.previewAmount.textContent = info.amount.toString();
    elements.previewMemo.textContent = info.memo || 'No memo';
    elements.previewExpiry.textContent = formatExpiry(info.expiryAt); // Anda bisa ubah sesuai kebutuhan

    elements.previewCard.dataset.amount = info.amount.toString();
    elements.previewCard.dataset.memo = info.memo || '';
    elements.previewCard.classList.remove('hidden');

    hideLoadingModal();
  } catch (err: any) {
    hideLoadingModal();
    showErrorModal('Invalid link ID or link has expired');
  }
}

async function handleConfirmClaim() {
  if (!walletState.connected || !privacyCash) {
    showErrorModal('Please connect your wallet first');
    return;
  }

  const amount = elements.previewCard.dataset.amount;
  const memo = elements.previewCard.dataset.memo || '';

  if (!amount) {
    showErrorModal('No valid claim data');
    return;
  }

  try {
    showLoadingModal(
      'Processing claim...<br><small class="text-gray-500">Backend executing private withdrawal</small>'
    );

    await privacyCash.withdraw({
      linkId: (document.getElementById('link-id-input') as HTMLInputElement).value.trim(),
      recipient: walletState.publicKey!,
    });

    transactionHistory.received.unshift({
      id: Date.now().toString(),
      amount: parseFloat(amount),
      memo,
      status: 'received',
      date: Date.now(),
    });

    hideLoadingModal();
    elements.previewCard.classList.add('hidden');
    elements.linkResult.classList.add('hidden');
    elements.successMessage.textContent = `Successfully claimed ${amount} SOL! Funds sent to your wallet privately.`;
    showSuccessModal();

    (document.getElementById('claim-form') as HTMLFormElement).reset();
  } catch (err: any) {
    hideLoadingModal();
    showErrorModal(`Claim failed: ${err.message || 'Unknown error'}`);
  }
}

// --- Utility Functions ---
function formatAddress(addr: string): string {
  return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;
}

function formatExpiry(timestamp: number): string {
  const diff = timestamp - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

// --- UI Helpers ---
function showSuccessModal() {
  document.getElementById('success-modal')!.classList.remove('hidden');
}
function hideSuccessModal() {
  document.getElementById('success-modal')!.classList.add('hidden');
  elements.linkResult.classList.add('hidden');
}
function showLoadingModal(message: string) {
  elements.loadingMessage.innerHTML = message;
  document.getElementById('loading-modal')!.classList.remove('hidden');
}
function hideLoadingModal() {
  document.getElementById('loading-modal')!.classList.add('hidden');
}
function showErrorModal(message: string) {
  elements.successMessage.textContent = message;
  elements.linkResult.classList.add('hidden');
  showSuccessModal();
}
function showNotification(message: string) {
  const span = elements.copyNotification.querySelector('span')!;
  span.textContent = message;
  elements.copyNotification.classList.remove('hidden');
  setTimeout(() => elements.copyNotification.classList.add('hidden'), 3000);
}
function copyLink() {
  elements.generatedLink.select();
  navigator.clipboard.writeText(elements.generatedLink.value).then(() => {
    showNotification('Link copied to clipboard!');
  });
}

// --- Tab Switching Logic ---
function switchMode(mode: 'create' | 'claim' | 'history') {
  ['create', 'claim', 'history'].forEach(sec => {
    document.getElementById(`section-${sec}`)!.classList.add('hidden');
  });
  ['mode-create', 'mode-claim', 'mode-history'].forEach(btn => {
    const el = document.getElementById(btn)!;
    el.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white');
    el.classList.add('text-gray-400');
  });
  document.getElementById(`section-${mode}`)!.classList.remove('hidden');
  const activeBtn = document.getElementById(`mode-${mode}`)!;
  activeBtn.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white');
  activeBtn.classList.remove('text-gray-400');
  if (mode === 'history') renderHistory();
}

function switchHistoryTab(tab: 'sent' | 'received') {
  ['sent', 'received'].forEach(t => {
    const tabBtn = document.getElementById(`history-${t}-tab`)!;
    const content = document.getElementById(`history-${t}-content`)!;
    if (t === tab) {
      tabBtn.classList.add('bg-purple-500/20', 'text-purple-300');
      tabBtn.classList.remove('bg-gray-800', 'text-gray-400');
      content.classList.remove('hidden');
    } else {
      tabBtn.classList.remove('bg-purple-500/20', 'text-purple-300');
      tabBtn.classList.add('bg-gray-800', 'text-gray-400');
      content.classList.add('hidden');
    }
  });
}

function renderHistory() {
  const sentList = document.getElementById('sent-list')!;
  const receivedList = document.getElementById('received-list')!;
  const sentEmpty = document.getElementById('sent-empty')!;
  const receivedEmpty = document.getElementById('received-empty')!;
  sentList.innerHTML = '';
  receivedList.innerHTML = '';
  if (transactionHistory.sent.length === 0) {
    sentEmpty.classList.remove('hidden');
  } else {
    sentEmpty.classList.add('hidden');
    transactionHistory.sent.forEach(tx => {
      sentList.appendChild(createHistoryItem(tx, 'sent'));
    });
  }
  if (transactionHistory.received.length === 0) {
    receivedEmpty.classList.remove('hidden');
  } else {
    receivedEmpty.classList.add('hidden');
    transactionHistory.received.forEach(tx => {
      receivedList.appendChild(createHistoryItem(tx, 'received'));
    });
  }
}

function createHistoryItem(tx: Transaction, type: 'sent' | 'received') {
  const div = document.createElement('div');
  div.className = 'history-item gradient-border rounded-2xl p-6 glow-effect';

  const statusBadge = type === 'sent'
    ? (tx.status === 'claimed'
        ? '<span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">✓ Claimed</span>'
        : '<span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">⏳ Pending</span>')
    : '<span class="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">✓ Received</span>';

  const timeAgo = getTimeAgo(tx.date);

  div.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${type === 'sent' ? 'from-purple-600 to-blue-600' : 'from-cyan-600 to-blue-600'} flex items-center justify-center">
          <span class="text-lg">${type === 'sent' ? '📤' : '📥'}</span>
        </div>
        <div>
          <p class="text-2xl font-display font-bold text-white">${tx.amount} SOL</p>
          <p class="text-xs text-gray-500">${timeAgo}</p>
        </div>
      </div>
      ${statusBadge}
    </div>
    <div class="space-y-2">
      ${tx.memo ? `<p class="text-sm text-gray-400"><strong class="text-gray-300">Memo:</strong> ${tx.memo}</p>` : ''}
      ${type === 'sent' && tx.linkId ? `
        <div class="flex items-center gap-2">
          <p class="text-xs text-gray-500 font-mono flex-1">${tx.linkId}</p>
          <button onclick="copyLinkId('${tx.linkId}')" class="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30 transition-colors">
            Copy ID
          </button>
        </div>
      ` : ''}
    </div>
  `;

  return div;
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function copyLinkId(linkId: string) {
  navigator.clipboard.writeText(linkId).then(() => {
    showNotification('Link ID copied!');
  });
}

// --- Event Listeners ---
document.getElementById('mode-create')!.addEventListener('click', () => switchMode('create'));
document.getElementById('mode-claim')!.addEventListener('click', () => switchMode('claim'));
document.getElementById('mode-history')!.addEventListener('click', () => switchMode('history'));
document.getElementById('history-sent-tab')!.addEventListener('click', () => switchHistoryTab('sent'));
document.getElementById('history-received-tab')!.addEventListener('click', () => switchHistoryTab('received'));
elements.connectWalletBtn.addEventListener('click', connectWallet);
elements.disconnectWalletBtn.addEventListener('click', disconnectWallet);
elements.createForm.addEventListener('submit', handleCreateLink);
elements.claimForm.addEventListener('submit', handleCheckLink);
document.getElementById('confirm-claim-btn')!.addEventListener('click', handleConfirmClaim);
document.getElementById('close-success-modal')!.addEventListener('click', hideSuccessModal);
document.getElementById('copy-link-btn')!.addEventListener('click', copyLink);

// --- Init ---
initPrivacyCash();

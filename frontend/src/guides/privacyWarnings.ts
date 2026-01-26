/**
 * Privacy Warnings & User Alerts
 * Critical information users need to know about Privacy Cash
 */

export const PRIVACY_WARNINGS = {
  critical: [
    {
      id: 'phishing-key',
      title: '⚠️ Critical: Never Sign Messages on Phishing Sites',
      severity: 'critical',
      message:
        'Your encryption key is derived from your signature. If you sign on a phishing site, your encryption key can be compromised and your funds stolen.',
      action: 'Only sign transactions on official Privacy Cash or ShadowPay interfaces',
      icon: '🔒',
    },
    {
      id: 'private-key-safety',
      title: '⚠️ Critical: Keep Your Private Key Secret',
      severity: 'critical',
      message:
        'Your private key should never be shared with anyone, including relayers, support staff, or bot operators. If compromised, anyone can access your funds.',
      action: 'Store your private key in a secure password manager or hardware wallet',
      icon: '🔐',
    },
  ],

  important: [
    {
      id: 'clean-wallet',
      title: '✓ Recommended: Use Clean Wallet for Final Transfer',
      severity: 'important',
      message:
        'Withdraw to a new clean non-custodial wallet (Phantom, Solflare, Backpack) before sending to CEXs or other platforms. This adds an extra layer of privacy.',
      action: 'Create a new wallet and withdraw there first',
      icon: '📱',
    },
    {
      id: 'amount-correlation',
      title: '⚠️ Warning: Avoid Unique Amounts',
      severity: 'important',
      message:
        'Observers may correlate deposits and withdrawals using on-chain analysis. Depositing and withdrawing the same unique amount (e.g., 10.237 SOL) makes correlation obvious.',
      action: 'Deposit round amounts (10 SOL not 10.237 SOL) and split withdrawals',
      icon: '📊',
    },
    {
      id: 'timing-analysis',
      title: '⚠️ Warning: Timing Patterns Visible',
      severity: 'important',
      message:
        'Although Privacy Cash breaks the on-chain link between deposits and withdrawals, observers can still analyze timing patterns. Instant deposit followed by instant withdrawal is suspicious.',
      action: 'Wait at least 24 hours before withdrawing',
      icon: '⏱️',
    },
  ],

  informational: [
    {
      id: 'cex-delays',
      title: 'ℹ️ Note: CEX Processing May Take Days',
      severity: 'informational',
      message:
        'Centralized exchanges may require manual processing, which can take days or longer. They may also ask questions about the source of funds.',
      action:
        'Be prepared for delays and have documentation ready if asked about withdrawal source',
      icon: '⏳',
    },
    {
      id: 'network-fees',
      title: 'ℹ️ Info: Network Fees on Deposits',
      severity: 'informational',
      message:
        'You pay Solana network fees on deposits. These are typically small (0.002-0.005 SOL) but vary based on network congestion.',
      action: 'Budget for network fees when making deposits',
      icon: '💰',
    },
  ],
}

export const PRIVACY_CHECKLIST = {
  title: 'Privacy Checklist: Before Withdrawing',
  checks: [
    {
      id: 'clean-wallet-ready',
      text: '✓ Clean non-custodial wallet created (Phantom, Solflare, etc)',
      priority: 'high',
      completed: false,
    },
    {
      id: 'wait-24h',
      text: '✓ Waited at least 24 hours since deposit',
      priority: 'high',
      completed: false,
    },
    {
      id: 'round-amounts',
      text: '✓ Deposited round amounts (10 SOL not 10.237 SOL)',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'split-plan',
      text: '✓ Plan to split withdrawal into 2-3 chunks',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'not-urgent',
      text: '✓ Not withdrawing because you need money urgently',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'understand-risks',
      text: '✓ Understand privacy is technical not guaranteed',
      priority: 'high',
      completed: false,
    },
  ],
}

export const PRIVACY_MISCONCEPTIONS = [
  {
    myth: 'Privacy Cash is 100% anonymous',
    fact: 'Privacy Cash breaks the on-chain link but observers can still make educated guesses using timing/amount analysis. Follow best practices for stronger privacy.',
  },
  {
    myth: 'I need to trust the relayer with my funds',
    fact: 'No. Zero-knowledge proofs ensure relayers cannot modify your withdrawal. Any tampering causes the transaction to fail.',
  },
  {
    myth: 'The relayer can see my private key or encryption key',
    fact: 'No. Your keys never leave your client and are not shared with anyone. The relayer signs transactions but cannot access your encryption key.',
  },
  {
    myth: 'I can withdraw instantly with full privacy',
    fact: 'Instant deposits and withdrawals create obvious timing correlations. Wait at least 24 hours for better privacy.',
  },
  {
    myth: 'Unique amounts are safe',
    fact: 'Unique amounts make amount-based correlation obvious. Use round amounts (10 SOL not 10.237 SOL) and split withdrawals.',
  },
  {
    myth: 'Privacy Cash is illegal',
    fact: 'No. Privacy Cash complies with regulations through CipherOwl screening. It\'s fully audited (14 times) and formally verified.',
  },
]

export const PRIVACY_LEVELS_EXPLAINED = {
  minimal: {
    level: 'Minimal Privacy',
    description: 'Basic transaction privacy only',
    example: 'Deposit and withdraw on the same day',
    score: 2,
    timeNeeded: '10 minutes',
    techniques: ['Single deposit', 'Single withdrawal'],
    risk: 'Very high - obvious timing and amount correlation',
  },

  standard: {
    level: 'Standard Privacy',
    description: 'Recommended minimum privacy',
    example: 'Deposit on Day 1, withdraw on Day 2',
    score: 5,
    timeNeeded: '1+ days',
    techniques: ['Wait 24+ hours before withdrawing', 'Use clean wallet', 'Round amounts'],
    risk: 'Medium - timing correlation reduced',
  },

  enhanced: {
    level: 'Enhanced Privacy',
    description: 'Good privacy with multiple transactions',
    example: '10 SOL split into 3 withdrawals (3, 3, 4) on different days',
    score: 7,
    timeNeeded: '3+ days',
    techniques: [
      'Wait 24+ hours',
      'Split withdrawals (3+ chunks)',
      'Use clean wallet',
      'Space withdrawals over time',
      'Round amounts',
    ],
    risk: 'Low - amount and timing correlation both reduced',
  },

  maximum: {
    level: 'Maximum Privacy',
    description: 'Strongest practical privacy',
    example: '10 SOL → 50% swap to USDC → split into 4 withdrawals over 1 week',
    score: 9,
    timeNeeded: '1+ weeks',
    techniques: [
      'Wait 1+ weeks',
      'Multiple small withdrawals (4+)',
      'Spread over time (1+ days between each)',
      'Swap tokens (SOL → USDC/USDT)',
      'Use clean wallet',
      'Round amounts',
      'Use multiple clean wallets',
    ],
    risk: 'Very low - comprehensive correlation prevention',
  },
}

export const SECURITY_CREDENTIALS = {
  audits: {
    count: 14,
    details: 'Smart contracts and ZK circuits fully audited',
    status: '✓ Complete',
  },
  formalVerification: {
    verifier: 'Veridise',
    status: '✓ Formally Verified',
    details: 'Highest level of cryptographic assurance',
  },
  openSource: {
    status: '✓ Fully Open-Source',
    components: ['On-chain program', 'ZK circuits', 'SDK'],
  },
  onChainVerified: {
    status: '✓ On-Chain Verified',
    details: 'Code is verified on Solana blockchain',
  },
  volume: {
    amount: '$190M+',
    details: 'Successfully transferred privately',
  },
  backing: {
    status: '✓ Backed by AllianceDAO',
    details: 'Supported by leading crypto organization',
  },
}

export const EMERGENCY_CONTACTS = {
  support: {
    title: 'Support',
    email: 'support@privacycash.org',
    docs: 'https://privacycash.org/docs',
  },
  security: {
    title: 'Security Issues',
    email: 'security@privacycash.org',
    details: 'Report security issues responsibly',
  },
  status: {
    title: 'System Status',
    url: 'https://status.privacycash.org',
    details: 'Check Privacy Cash service status',
  },
}

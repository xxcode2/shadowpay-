/**
 * Privacy Cash User Education Guide
 * Comprehensive information about Privacy Cash protocol for end users
 */

export const PRIVACY_CASH_GUIDE = {
  overview: {
    title: 'What is Privacy Cash?',
    description: 'Privacy Cash is a privacy protocol on Solana that enables private transfers without linking your wallet addresses or transaction history.',
    keyPoints: [
      'Built with zero-knowledge proofs',
      'Uses append-only Merkle tree',
      'Relayer system for anonymity',
      'Breaks on-chain link between deposits and withdrawals',
      'Verified secure: 14 audits + formal verification',
      '$190M+ in volume transferred privately',
      'Fully open-source and on-chain verified',
    ],
    backing: 'Backed by AllianceDAO',
  },

  privateTransfers: {
    title: 'How Private Transfers Work',
    overview:
      'Privacy Cash lets you transfer funds to a clean wallet without linking past addresses or transaction history.',

    steps: [
      {
        number: 1,
        title: 'Deposit',
        description: 'You deposit your tokens into Privacy Cash',
        details: 'Your deposit is signed by you and submitted to a relayer',
      },
      {
        number: 2,
        title: 'Screening',
        description: 'Relayer screens your wallet through CipherOwl',
        details:
          'If your address is flagged as malicious, the deposit is rejected. This complies with regulations.',
      },
      {
        number: 3,
        title: 'Private Storage',
        description: 'Tokens are stored encrypted in Privacy Cash pool',
        details: 'Only you can decrypt your UTXOs with your encryption key',
      },
      {
        number: 4,
        title: 'Withdrawal',
        description: 'Withdraw to recipient address later',
        details: 'Relayer signs the withdrawal transaction (not you)',
      },
      {
        number: 5,
        title: 'Zero-Knowledge Proof',
        description: 'Client generates ZK proof to verify withdrawal',
        details: 'Proves amount and recipient are correct without revealing identity',
      },
      {
        number: 6,
        title: 'Anonymity',
        description: 'On-chain transaction shows no link to original depositor',
        details: 'Observers cannot connect deposit and withdrawal transactions',
      },
    ],

    technicalDetails: {
      encryption: 'Encryption key is deterministically derived when you sign a fixed message on client',
      keyManagement: 'Encryption key never leaves your device unless you leak it',
      utxos: 'Each deposit/withdrawal creates an encrypted UTXO on-chain',
      merkleTree: 'Append-only Merkle tree prevents double-spending',
      zkProof: 'Zero-knowledge proof ensures relayer cannot modify parameters',
    },

    security: {
      userControls: 'You control encryption key - relayer cannot access your funds',
      proofVerification:
        'Any relayer tampering with amount, recipient, or other parameters will cause transaction to fail',
      warning: 'Never sign messages on phishing sites - your encryption key could be compromised',
    },
  },

  privateSwaps: {
    title: 'How Private Swaps Work',
    overview:
      'Swap your private tokens to different tokens (e.g., SOL to USDC) without revealing your wallet address on-chain.',

    steps: [
      {
        number: 1,
        title: 'Unshield',
        description: 'Your input token is temporarily converted to ephemeral wallet',
        details: 'This wallet only exists on-chain for the swap transaction',
      },
      {
        number: 2,
        title: 'Swap',
        description: 'Ephemeral wallet executes swap via Jupiter',
        details: 'Your main wallet never appears in the swap transaction',
      },
      {
        number: 3,
        title: 'Reshield',
        description: 'Output token is converted back to your shielded wallet',
        details: 'Funds return to your private pool',
      },
    ],

    benefits: [
      'Main wallet address never exposed on-chain during swap',
      'Improves anonymity by splitting token types',
      'Makes amount-based analysis harder for observers',
      'Can swap private SOL to private USDC/USDT/ORE/etc.',
    ],
  },

  fees: {
    deposits: {
      label: 'Deposit Fees',
      amount: 'Free',
      details: 'You pay Solana network fees on deposit',
      whoPaysFees: 'User pays Solana network fees',
    },
    withdrawals: {
      label: 'Withdrawal Fees',
      description: '0.006 SOL (or SPL equivalent) per recipient + 0.35% of amount',
      example: 'Withdrawing 1 SOL = 0.006 SOL fee + 0.0035 SOL (0.35%) = ~0.0095 SOL total',
      whoPaysFees: 'Relayers pay Solana network fees (you don\'t pay network fees)',
    },
    swaps: {
      label: 'Swap Fees',
      description: '0.008 SOL (or SPL equivalent) + 0.35% of amount + Jupiter fees',
      whoPaysFees: 'You pay all swap fees',
    },
  },

  bestPractices: {
    title: 'Privacy Best Practices',
    warning:
      'Although Privacy Cash breaks the technical link between deposits and withdrawals, observers can still make educated guesses by analyzing on-chain patterns. Follow these practices for maximum privacy:',

    practices: [
      {
        title: 'Use a Clean Wallet',
        description: 'Highly recommended to withdraw to a new non-custodial wallet first',
        details:
          'Use Phantom, Solflare, or Backpack. Then send from this clean wallet to centralized apps (CEXs may require manual processing, taking days or longer).',
      },
      {
        title: 'Deposit Round Amounts',
        description: 'Avoid unique or unusual amounts',
        example: 'Deposit 10 SOL instead of 10.237 SOL',
        reason: 'Makes it harder to correlate deposits and withdrawals by amount',
      },
      {
        title: 'Wait Before Withdrawing',
        description: 'Don\'t withdraw immediately after depositing',
        example: 'Deposit on Day 1, withdraw on Day 2 or later',
        reason: 'Breaks timing-based correlation that observers might use',
      },
      {
        title: 'Split Withdrawals',
        description: 'Withdraw in multiple chunks over time',
        example: 'Deposit 10 SOL, withdraw 3 SOL, then 4 SOL, then 3 SOL on different days',
        reason: 'Makes amount analysis much harder for outside observers',
      },
      {
        title: 'Swap Tokens',
        description: 'Swap some of your tokens to a different token type',
        example: 'Swap 30% of your SOL to USDC, withdraw both separately',
        reason: 'Increases anonymity through token diversity and amount obfuscation',
      },
    ],

    summary: 'These best practices help prevent timing and amount-based correlation attacks.',
  },

  security: {
    title: 'Security & Privacy Assurances',
    audits: {
      total: 14,
      details: 'Complete audit history of Smart contracts and ZK circuits',
    },
    formalVerification: {
      verifier: 'Veridise',
      status: 'Formally verified - highest level of security proof',
    },
    openSource: {
      status: 'Fully open-source',
      components: ['On-chain program', 'Zero-knowledge circuits', 'SDK'],
    },
    onChainVerified: 'All components verified on-chain',
  },

  caveats: {
    title: 'Important Caveats',
    items: [
      {
        title: 'Use Clean Wallets for Final Transfer',
        description:
          'Withdraw to a new clean non-custodial wallet (Phantom, Solflare, Backpack) before sending to centralized apps. CEXs may require manual processing.',
      },
      {
        title: 'Amount Analysis Risk',
        description:
          'Observers may still make educated guesses by analyzing on-chain activity. A unique amount deposited and withdrawn at the same time is suspicious.',
      },
      {
        title: 'Timing Patterns',
        description:
          'Instant deposits and withdrawals create obvious timing correlations. Space them out over multiple days.',
      },
      {
        title: 'Phishing Risk',
        description:
          'Never sign messages on phishing sites. Your encryption key is derived from your signature and should never be revealed.',
      },
      {
        title: 'CEX Limitations',
        description:
          'Centralized exchanges may have manual processing requirements, which could take days or longer.',
      },
    ],
  },

  technicalArchitecture: {
    title: 'Technical Architecture',
    components: [
      {
        name: 'Zero-Knowledge Proofs',
        description: 'Cryptographic proofs that verify transactions without revealing identities',
      },
      {
        name: 'Merkle Tree',
        description: 'Append-only data structure that prevents double-spending and enables verification',
      },
      {
        name: 'Relayer System',
        description:
          'Relayers pay for network fees and sign withdrawal transactions to break on-chain links',
      },
      {
        name: 'UTXOs',
        description: 'Unspent transaction outputs that are encrypted and stored on Solana',
      },
      {
        name: 'Encryption Keys',
        description: 'Client-derived keys that only you can use to decrypt your UTXOs',
      },
      {
        name: 'CipherOwl Screening',
        description: 'Regulatory compliance layer that screens wallet addresses for known malicious actors',
      },
    ],
  },
}

export const PRIVACY_TIPS = [
  'Deposit round, integer amounts (e.g., 10 SOL not 10.237 SOL)',
  'Wait at least 1 day before withdrawing',
  'Split large withdrawals into multiple smaller chunks',
  'Use a clean wallet before sending to CEXs or other platforms',
  'Swap tokens to diversify and increase anonymity',
  'Spread withdrawals over multiple days',
  'Never sign messages on untrusted websites',
  'Each action adds a layer to your privacy - combine multiple strategies',
]

export const PRIVACY_LEVELS = {
  minimal: {
    level: 'Minimal',
    description: 'Basic privacy - single deposit and withdrawal',
    timeRequired: '10 minutes',
    privacyScore: 2,
    tips: ['Deposit and withdraw same day'],
  },
  standard: {
    level: 'Standard',
    description: 'Good privacy - wait before withdrawing and use clean wallet',
    timeRequired: '1+ days',
    privacyScore: 5,
    tips: ['Wait 24 hours before withdrawing', 'Use new clean wallet'],
  },
  enhanced: {
    level: 'Enhanced',
    description: 'Better privacy - split withdrawals and use clean wallet',
    timeRequired: '3+ days',
    privacyScore: 7,
    tips: ['Split into 3+ withdrawals', 'Wait between each withdrawal', 'Use clean wallet'],
  },
  maximum: {
    level: 'Maximum',
    description: 'Maximum privacy - combine all strategies',
    timeRequired: '1+ weeks',
    privacyScore: 9,
    tips: [
      'Deposit round amounts',
      'Wait multiple days between actions',
      'Split into many small withdrawals',
      'Swap tokens to different types',
      'Use clean wallet',
      'Space out withdrawals over time',
    ],
  },
}

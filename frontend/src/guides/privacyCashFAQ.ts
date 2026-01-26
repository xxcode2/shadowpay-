/**
 * Privacy Cash FAQ
 * Frequently asked questions about Privacy Cash SDK and integration
 */

export const PRIVACY_CASH_FAQ = [
  {
    category: 'Network Fees',
    questions: [
      {
        id: 'who-pays-network-fees',
        q: 'Who pays for the network fees?',
        a: 'On deposit, you pay Solana network fees. On withdrawal, relayers pay the Solana network fees for you. After SDK integration, you don\'t need to pay any fees beyond the Privacy Cash protocol fees (0.006 SOL + 0.35% per withdrawal).',
      },
      {
        id: 'network-fee-amount',
        q: 'How much are Solana network fees?',
        a: 'Solana network fees are typically very small (0.002-0.005 SOL) but vary based on network congestion.',
      },
    ],
  },
  {
    category: 'Withdrawals',
    questions: [
      {
        id: 'minimum-withdrawal',
        q: 'What is the minimum withdrawal amount?',
        a: 'Check the minimum_withdrawal field in the Privacy Cash config at https://api3.privacycash.org/config',
      },
      {
        id: 'withdrawal-timing',
        q: 'How long does a withdrawal take?',
        a: 'Withdrawals typically confirm within a few seconds to a minute after submission, depending on Solana network conditions.',
      },
      {
        id: 'multiple-withdrawals',
        q: 'Can I withdraw multiple times from the same deposit?',
        a: 'Yes. Each withdrawal is a separate transaction. You can withdraw your entire balance in one transaction or split it across multiple withdrawals.',
      },
    ],
  },
  {
    category: 'Development & Integration',
    questions: [
      {
        id: 'devnet-support',
        q: 'Is there devnet support?',
        a: 'Not currently. Please test on mainnet - SDK integration is straightforward and works directly with mainnet.',
      },
      {
        id: 'private-key-to-relayer',
        q: 'Does the client/user ever need to pass their private key or encryption key to the relayer?',
        a: 'No. Private keys and encryption keys belong entirely to the user and should never leave the client. The SDK is designed to keep keys on the client side.',
      },
      {
        id: 'sponsor-gas-fees',
        q: 'Can SDK integration developers sponsor gas fees for users?',
        a: 'Not currently. Users must pay or relayers must cover the fees.',
      },
      {
        id: 'add-fees-on-integration',
        q: 'Can SDK integration developers charge fees to users?',
        a: 'Yes! You can add a fee transfer instruction on deposit and charge users additional fees. Several projects already integrated the SDK and added their own fees.',
      },
    ],
  },
  {
    category: 'Security & Privacy',
    questions: [
      {
        id: 'how-private-is-it',
        q: 'How private is Privacy Cash really?',
        a: 'Privacy Cash breaks the on-chain link between deposits and withdrawals using zero-knowledge proofs. However, observers can still make educated guesses using timing and amount analysis. Follow best practices (wait before withdrawing, split amounts, use clean wallets) for maximum privacy.',
      },
      {
        id: 'zero-knowledge-proofs',
        q: 'What are zero-knowledge proofs and why do they matter?',
        a: 'ZK proofs allow you to prove something is true without revealing how you know it\'s true. Privacy Cash uses them to prove a withdrawal is valid without revealing the original depositor\'s identity.',
      },
      {
        id: 'relayer-trust',
        q: 'Do I have to trust the relayer?',
        a: 'No. Zero-knowledge proofs ensure relayers cannot modify your withdrawal parameters. Any tampering causes the on-chain transaction to fail.',
      },
      {
        id: 'encryption-key-safety',
        q: 'Is my encryption key safe?',
        a: 'Your encryption key is derived from signing a fixed message and never leaves your device unless you leak it (e.g., through phishing). Never sign messages on untrusted sites.',
      },
    ],
  },
  {
    category: 'Tokens & Swaps',
    questions: [
      {
        id: 'supported-tokens',
        q: 'What tokens does Privacy Cash support?',
        a: 'SOL, USDC, USDT, ZEC, ORE, STORE, and more SPL tokens. Check the API for the complete list.',
      },
      {
        id: 'private-swaps',
        q: 'How do private swaps work?',
        a: 'Your token is temporarily converted to an ephemeral wallet, swapped via Jupiter, and converted back to your shielded wallet. Your main wallet never appears in the swap transaction on-chain.',
      },
      {
        id: 'swap-fees',
        q: 'What are private swap fees?',
        a: '0.008 SOL (or SPL equivalent) + 0.35% of swap amount + Jupiter swap fees.',
      },
    ],
  },
  {
    category: 'Regulatory & Compliance',
    questions: [
      {
        id: 'aml-compliance',
        q: 'Does Privacy Cash comply with regulations?',
        a: 'Yes. Privacy Cash uses CipherOwl to screen wallet addresses against known malicious actors. Deposits from flagged addresses are rejected for regulatory compliance.',
      },
      {
        id: 'cex-withdrawals',
        q: 'Can I withdraw to a centralized exchange?',
        a: 'Technically yes, but we recommend withdrawing to a clean non-custodial wallet first (Phantom, Solflare, Backpack), then sending to CEXs. Some CEXs may require manual processing, which can take days or longer.',
      },
    ],
  },
  {
    category: 'Best Practices',
    questions: [
      {
        id: 'privacy-best-practices',
        q: 'What are best practices for maximum privacy?',
        a: 'Deposit round amounts, wait at least 24 hours before withdrawing, split withdrawals into multiple chunks over time, use a clean wallet, and consider swapping tokens. See the Privacy Best Practices section for details.',
      },
      {
        id: 'unique-amounts',
        q: 'Why should I avoid unique amounts?',
        a: 'Observers can use amount analysis to correlate deposits and withdrawals. Unique amounts make this correlation obvious. Use round amounts like 10 SOL instead of 10.237 SOL.',
      },
      {
        id: 'timing-matters',
        q: 'Why does timing matter for privacy?',
        a: 'Instant deposit followed by instant withdrawal creates obvious timing correlation. Spacing actions over multiple days prevents this type of analysis.',
      },
    ],
  },
  {
    category: 'Technical Details',
    questions: [
      {
        id: 'merkle-tree',
        q: 'What is the Merkle tree used for?',
        a: 'The append-only Merkle tree prevents double-spending and allows users to verify that their UTXO is in the shielded pool without revealing their balance.',
      },
      {
        id: 'utxo-storage',
        q: 'Where are UTXOs stored?',
        a: 'UTXOs are encrypted and stored on-chain in the Solana blockchain. Only users with the encryption key can decrypt and spend them.',
      },
      {
        id: 'circuit-verification',
        q: 'How are zero-knowledge circuits verified?',
        a: 'Privacy Cash circuits are verified on-chain. All components are open-sourced and have passed 14 audits plus formal verification by Veridise.',
      },
    ],
  },
]

export const FAQ_BY_CATEGORY = PRIVACY_CASH_FAQ.reduce(
  (acc, faqGroup) => ({
    ...acc,
    [faqGroup.category]: faqGroup.questions,
  }),
  {} as Record<string, typeof PRIVACY_CASH_FAQ[0]['questions']>
)

export const FAQ_BY_ID = PRIVACY_CASH_FAQ.reduce(
  (acc, faqGroup) => ({
    ...acc,
    ...faqGroup.questions.reduce(
      (q, item) => ({
        ...q,
        [item.id]: item,
      }),
      {}
    ),
  }),
  {} as Record<string, (typeof PRIVACY_CASH_FAQ[0]['questions'][0])>
)

export function getFAQsByCategory(category: string) {
  return FAQ_BY_CATEGORY[category] || []
}

export function getFAQById(id: string) {
  return FAQ_BY_ID[id]
}

export function searchFAQ(query: string) {
  const lowerQuery = query.toLowerCase()
  return PRIVACY_CASH_FAQ.flatMap(group =>
    group.questions
      .filter(
        q => q.q.toLowerCase().includes(lowerQuery) || q.a.toLowerCase().includes(lowerQuery)
      )
      .map(q => ({
        ...q,
        category: group.category,
      }))
  )
}

export const FAQ_CATEGORIES = PRIVACY_CASH_FAQ.map(group => group.category)

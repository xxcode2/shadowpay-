/**
 * Privacy Education Component
 * Displays Privacy Cash education, FAQ, and best practices to users
 */

import { PRIVACY_CASH_GUIDE, PRIVACY_TIPS, PRIVACY_LEVELS } from '../guides/privacyCashGuide.js'
import { PRIVACY_CASH_FAQ, FAQ_CATEGORIES, searchFAQ } from '../guides/privacyCashFAQ.js'
import {
  PRIVACY_WARNINGS,
  PRIVACY_CHECKLIST,
  PRIVACY_MISCONCEPTIONS,
  PRIVACY_LEVELS_EXPLAINED,
} from '../guides/privacyWarnings.js'

/**
 * Display Privacy Cash overview
 */
export function displayPrivacyCashOverview(): string {
  const guide = PRIVACY_CASH_GUIDE.overview

  return `
🔒 What is Privacy Cash?
═══════════════════════════════════════════════════════════════

${guide.description}

Key Features:
${guide.keyPoints.map(point => `  ✓ ${point}`).join('\n')}

Backed by: ${guide.backing}

Learn more: https://privacycash.org
  `
}

/**
 * Display how private transfers work
 */
export function displayPrivateTransfersGuide(): string {
  const guide = PRIVACY_CASH_GUIDE.privateTransfers

  let output = `
🔄 ${guide.title}
═══════════════════════════════════════════════════════════════

${guide.overview}

How It Works (6 Steps):
`

  guide.steps.forEach(step => {
    output += `
${step.number}. ${step.title}
   ${step.description}
   → ${step.details}
`
  })

  return output
}

/**
 * Display privacy best practices
 */
export function displayPrivacyBestPractices(): string {
  const guide = PRIVACY_CASH_GUIDE.bestPractices

  let output = `
🎯 ${guide.title}
═══════════════════════════════════════════════════════════════

⚠️ ${guide.warning}

Recommended Practices:
`

  guide.practices.forEach(practice => {
    output += `
📌 ${practice.title}
   ${practice.description}`
    if (practice.example) output += `\n   Example: ${practice.example}`
    if (practice.reason) output += `\n   Why: ${practice.reason}`
    output += '\n'
  })

  return output
}

/**
 * Display privacy tips
 */
export function displayPrivacyTips(): string {
  return `
💡 Quick Privacy Tips
═══════════════════════════════════════════════════════════════

${PRIVACY_TIPS.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}
  `
}

/**
 * Display privacy level explanation
 */
export function displayPrivacyLevels(): string {
  let output = `
🔐 Privacy Levels Explained
═══════════════════════════════════════════════════════════════

`

  Object.values(PRIVACY_LEVELS).forEach(level => {
    output += `
${level.level} (Score: ${level.privacyScore}/10)
  Time: ${level.timeRequired}
  ${level.description}
  Tips: ${level.tips.join(' • ')}
`
  })

  return output
}

/**
 * Display critical warnings
 */
export function displayCriticalWarnings(): string {
  let output = `
🚨 Critical Security Warnings
═══════════════════════════════════════════════════════════════

`

  PRIVACY_WARNINGS.critical.forEach(warning => {
    output += `
${warning.icon} ${warning.title}
   ⚠️ ${warning.message}
   ✓ ${warning.action}
`
  })

  return output
}

/**
 * Display all warnings
 */
export function displayAllWarnings(): string {
  let output = `
⚠️ Important Safety Information
═══════════════════════════════════════════════════════════════

`

  // Critical warnings
  output += '\n🔴 CRITICAL:\n'
  PRIVACY_WARNINGS.critical.forEach(w => {
    output += `  ${w.title}\n    ${w.message}\n`
  })

  // Important warnings
  output += '\n🟡 IMPORTANT:\n'
  PRIVACY_WARNINGS.important.forEach(w => {
    output += `  ${w.title}\n    ${w.message}\n`
  })

  // Informational
  output += '\n🔵 INFORMATIONAL:\n'
  PRIVACY_WARNINGS.informational.forEach(w => {
    output += `  ${w.title}\n    ${w.message}\n`
  })

  return output
}

/**
 * Display FAQ by category
 */
export function displayFAQCategory(category: string): string {
  const faqs = PRIVACY_CASH_FAQ.find(f => f.category === category)

  if (!faqs) {
    return `❌ Category "${category}" not found\n\nAvailable categories: ${FAQ_CATEGORIES.join(', ')}`
  }

  let output = `
❓ ${category}
═══════════════════════════════════════════════════════════════

`

  faqs.questions.forEach(q => {
    output += `Q: ${q.q}\n`
    output += `A: ${q.a}\n\n`
  })

  return output
}

/**
 * Display all FAQs
 */
export function displayAllFAQs(): string {
  let output = `
❓ Frequently Asked Questions (FAQ)
═══════════════════════════════════════════════════════════════

`

  PRIVACY_CASH_FAQ.forEach(faqGroup => {
    output += `\n${faqGroup.category}\n`
    output += `${'─'.repeat(50)}\n`

    faqGroup.questions.forEach(q => {
      output += `Q: ${q.q}\n`
      output += `A: ${q.a}\n\n`
    })
  })

  return output
}

/**
 * Search FAQ
 */
export function searchPrivacyCashFAQ(query: string): string {
  const results = searchFAQ(query)

  if (results.length === 0) {
    return `No results found for: "${query}"\n\nTry searching for terms like: privacy, fees, wallet, withdrawal`
  }

  let output = `
❓ Search Results for: "${query}"
═══════════════════════════════════════════════════════════════

Found ${results.length} result${results.length === 1 ? '' : 's'}:

`

  results.forEach(result => {
    output += `[${result.category}] Q: ${result.q}\n`
    output += `A: ${result.a}\n\n`
  })

  return output
}

/**
 * Display privacy misconceptions
 */
export function displayMisconceptions(): string {
  let output = `
🤔 Common Privacy Misconceptions
═══════════════════════════════════════════════════════════════

`

  PRIVACY_MISCONCEPTIONS.forEach(item => {
    output += `
❌ Myth: "${item.myth}"
✓ Fact: ${item.fact}
`
  })

  return output
}

/**
 * Display pre-withdrawal checklist
 */
export function displayWithdrawalChecklist(): string {
  let output = `
✓ Privacy Checklist: Before Withdrawing
═══════════════════════════════════════════════════════════════

Complete these steps for maximum privacy:

`

  PRIVACY_CHECKLIST.checks.forEach(check => {
    output += `☐ [${check.priority.toUpperCase()}] ${check.text}\n`
  })

  output += `
💡 Tip: Checking these boxes will significantly improve your privacy.
`

  return output
}

/**
 * Display fees and costs
 */
export function displayFees(): string {
  const fees = PRIVACY_CASH_GUIDE.fees

  return `
💰 Fees
═══════════════════════════════════════════════════════════════

📥 Deposits:
   ${fees.deposits.label}: ${fees.deposits.amount}
   You pay: ${fees.deposits.whoPaysFees}

📤 Withdrawals:
   ${fees.withdrawals.label}: ${fees.withdrawals.description}
   Example: ${fees.withdrawals.example}
   Who pays: ${fees.withdrawals.whoPaysFees}

🔄 Private Swaps:
   ${fees.swaps.label}: ${fees.swaps.description}
   Who pays: ${fees.swaps.whoPaysFees}
  `
}

/**
 * Display technical architecture
 */
export function displayTechnicalArchitecture(): string {
  const arch = PRIVACY_CASH_GUIDE.technicalArchitecture

  let output = `
⚙️ ${arch.title}
═══════════════════════════════════════════════════════════════

`

  arch.components.forEach(component => {
    output += `${component.name}\n  ${component.description}\n\n`
  })

  return output
}

/**
 * Get all available guides/topics
 */
export function getAvailableGuides(): string[] {
  return [
    'overview',
    'private-transfers',
    'best-practices',
    'tips',
    'privacy-levels',
    'warnings',
    'faq',
    'misconceptions',
    'checklist',
    'fees',
    'technical',
  ]
}

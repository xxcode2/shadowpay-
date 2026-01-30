/**
 * ⚠️  DEPRECATED FILE
 * 
 * This file is deprecated as of v2.0
 * 
 * ✅ NEW ARCHITECTURE:
 * - Backend handles Privacy Cash SDK
 * - Frontend only calls backend APIs
 * - Use: import { createPaymentLink, claimPaymentLink, getPaymentLink } from './linkAPI'
 * 
 * See linkAPI.ts for the correct implementation
 */

export function createPaymentLink(): never {
  throw new Error(
    '❌ DEPRECATED: createPaymentLink() has moved\n' +
    'Use: import { createPaymentLink } from "./linkAPI"\n' +
    'Backend now handles Privacy Cash SDK'
  )
}

export function claimPaymentLink(): never {
  throw new Error(
    '❌ DEPRECATED: claimPaymentLink() has moved\n' +
    'Use: import { claimPaymentLink } from "./linkAPI"\n' +
    'Backend now handles Privacy Cash SDK'
  )
}

export const PrivacyCashIntegration = {
  createPaymentLink,
  claimPaymentLink,
}

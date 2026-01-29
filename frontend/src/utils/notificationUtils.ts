/**
 * Notification utilities for user feedback
 * Uses beautiful toast notifications instead of ugly alerts
 */

import { showSuccess as toastSuccess, showError as toastError, showWarning as toastWarning, showInfo as toastInfo } from './toast'

/**
 * Show success message to user
 */
export function showSuccess(message: string): void {
  console.log('✅ SUCCESS:', message)
  toastSuccess(message)
}

/**
 * Show error message to user
 */
export function showError(message: string): void {
  console.error('❌ ERROR:', message)
  toastError(message)
}

/**
 * Show warning message to user
 */
export function showWarning(message: string): void {
  console.warn('⚠️ WARNING:', message)
  toastWarning(message)
}

/**
 * Show info message to user
 */
export function showInfo(message: string): void {
  console.info('ℹ️ INFO:', message)
  toastInfo(message)}
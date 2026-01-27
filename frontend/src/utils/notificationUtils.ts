/**
 * Notification utilities for user feedback
 */

/**
 * Show success message to user
 */
export function showSuccess(message: string): void {
  console.log('✅ SUCCESS:', message)
  // In a real app, show toast/notification
  alert(message)
}

/**
 * Show error message to user
 */
export function showError(message: string): void {
  console.error('❌ ERROR:', message)
  // In a real app, show toast/notification
  alert(message)
}

/**
 * Show warning message to user
 */
export function showWarning(message: string): void {
  console.warn('⚠️ WARNING:', message)
  // In a real app, show toast/notification
  alert(message)
}

/**
 * Show info message to user
 */
export function showInfo(message: string): void {
  console.info('ℹ️ INFO:', message)
  // In a real app, show toast/notification
  alert(message)
}

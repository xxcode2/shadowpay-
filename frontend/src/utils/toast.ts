/**
 * 🎨 Beautiful Toast Notification System
 * Replaces ugly browser alerts with styled notifications
 */

interface ToastOptions {
  duration?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

function createToastElement(message: string, type: 'success' | 'error' | 'warning' | 'info'): HTMLElement {
  const toast = document.createElement('div')
  
  // Icons
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  // Colors
  const colors = {
    success: 'from-green-500 to-emerald-600',
    error: 'from-red-500 to-rose-600',
    warning: 'from-yellow-500 to-orange-600',
    info: 'from-blue-500 to-cyan-600'
  }

  const borderColors = {
    success: 'border-green-400/50',
    error: 'border-red-400/50',
    warning: 'border-yellow-400/50',
    info: 'border-blue-400/50'
  }

  toast.className = `
    fixed top-6 right-6 z-[9999]
    px-6 py-4 rounded-xl
    bg-gradient-to-r ${colors[type]}
    border ${borderColors[type]}
    text-white font-medium
    shadow-2xl backdrop-blur-md
    animate-in slide-in-from-top-4 duration-300
    max-w-md
  `.trim()

  toast.innerHTML = `
    <div class="flex items-start gap-4">
      <span class="text-2xl flex-shrink-0">${icons[type]}</span>
      <div class="flex-1">
        <p class="text-sm leading-relaxed">${escapeHtml(message)}</p>
      </div>
      <button class="flex-shrink-0 text-white/70 hover:text-white transition-colors ml-2">
        ✕
      </button>
    </div>
  `

  // Close button handler
  const closeBtn = toast.querySelector('button')
  closeBtn?.addEventListener('click', () => {
    toast.classList.remove('animate-in')
    toast.classList.add('animate-out', 'slide-out-to-top-4')
    setTimeout(() => toast.remove(), 200)
  })

  return toast
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info', options: ToastOptions = {}): void {
  const { duration = 5000, position = 'top-right' } = options

  const toast = createToastElement(message, type)
  document.body.appendChild(toast)

  // Auto remove
  const timeoutId = setTimeout(() => {
    toast.classList.add('animate-out', 'slide-out-to-top-4')
    setTimeout(() => toast.remove(), 200)
  }, duration)

  // Manual close
  toast.addEventListener('click', () => {
    clearTimeout(timeoutId)
    toast.classList.add('animate-out', 'slide-out-to-top-4')
    setTimeout(() => toast.remove(), 200)
  })
}

export function showSuccess(message: string, options?: ToastOptions): void {
  console.log('✅ SUCCESS:', message)
  showToast(message, 'success', options)
}

export function showError(message: string, options?: ToastOptions): void {
  console.error('❌ ERROR:', message)
  showToast(message, 'error', { duration: 7000, ...options })
}

export function showWarning(message: string, options?: ToastOptions): void {
  console.warn('⚠️ WARNING:', message)
  showToast(message, 'warning', { duration: 6000, ...options })
}

export function showInfo(message: string, options?: ToastOptions): void {
  console.info('ℹ️ INFO:', message)
  showToast(message, 'info', options)
}

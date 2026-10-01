// components/Toast.jsx — lightweight toast notification
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'

// eslint-disable-next-line react-refresh/only-export-components
export { useToast } from '../hooks/useToast'

export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [message, onClose])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {type === 'success' ? (
            <CheckCircle size={18} weight="bold" className="shrink-0 text-emerald-700 dark:text-emerald-500" />
          ) : (
            <WarningCircle size={18} weight="bold" className="shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            aria-label="Dismiss"
          >
            <X size={14} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

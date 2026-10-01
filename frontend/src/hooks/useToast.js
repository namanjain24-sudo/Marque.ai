// hooks/useToast.js — standalone hook so Toast.jsx stays component-only (react-refresh)
import { useCallback, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, showToast, hideToast }
}

// context/BrandContext.jsx — global brand state.
// Starts null, then fetches the real seeded demo brand from the backend.
// No login/auth: the whole app runs on the real `brand_burgerlab` brand so
// F1-F4 are testable end to end without onboarding first.
import { createContext, useContext, useEffect, useState } from 'react'
import { DEMO_BRAND_ID } from '../data/demoBrand'
import { api } from '../lib/api'

const BrandContext = createContext(null)

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .getBrand(DEMO_BRAND_ID)
      .then((live) => {
        if (!cancelled && live) setBrand(live)
      })
      .catch(() => {
        // backend not up / brand missing — brand stays null, UI guards with brand?.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <BrandContext.Provider value={{ brand, setBrand, loading }}>
      {children}
    </BrandContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used inside BrandProvider')
  return ctx
}

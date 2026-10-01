// context/BrandContext.jsx — global brand state.
// Paints instantly from the mock brand, then (dev mode) fetches the real
// seeded demo brand from the backend and swaps it in. No login/auth: the
// whole app runs on the real `brand_burgerlab` brand so F1-F4 are testable
// end to end without onboarding first.
import { createContext, useContext, useEffect, useState } from 'react'
import brandData from '../mock/brand.json'
import { DEMO_BRAND_ID } from '../data/demoBrand'
import { api } from '../lib/api'

const BrandContext = createContext(null)

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState({ ...brandData })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .getBrand(DEMO_BRAND_ID)
      .then((live) => {
        if (!cancelled && live) setBrand(live)
      })
      .catch(() => {
        // backend not up / brand missing — keep the mock so the UI still renders
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

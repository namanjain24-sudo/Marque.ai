// context/BrandContext.jsx — global brand state, no localStorage
import { createContext, useContext, useState } from 'react'
import brandData from '../mock/brand.json'

const BrandContext = createContext(null)

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState({ ...brandData })

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used inside BrandProvider')
  return ctx
}

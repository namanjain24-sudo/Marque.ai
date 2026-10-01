import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "../components/Button"
import { Container } from "../components/Container"
import { api } from "../lib/api"

function BrandRow({ brand }) {
  const swatches = brand.palette ? Object.values(brand.palette).slice(0, 3) : []
  return (
    <Link
      to={`/brand/${brand.id}`}
      className="group flex items-center justify-between gap-6 border-b border-zinc-200 py-5 transition-colors first:pt-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 -space-x-1">
          {swatches.map((hex, i) => (
            <span key={i} className="h-7 w-7 border border-white dark:border-zinc-950" style={{ backgroundColor: hex }} />
          ))}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-zinc-900 dark:text-zinc-50">{brand.name}</p>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-500">
            {brand.category}
            {brand.city ? `, ${brand.city}` : ""}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-zinc-400 transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-500">
        View
      </span>
    </Link>
  )
}

export function Brands() {
  const [brands, setBrands] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listBrands()
      .then(setBrands)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <section className="py-16 sm:py-20">
      <Container className="max-w-2xl">
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Live brands
          </h1>
          <Button to="/onboard" variant="secondary" className="shrink-0">
            New brand
          </Button>
        </div>

        <div className="mt-8">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              Couldn&rsquo;t reach the API: {error}
            </p>
          )}

          {!brands && !error && (
            <div className="animate-pulse space-y-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 border-b border-zinc-200 py-5 dark:border-zinc-800">
                  <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-900" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {brands?.length === 0 && (
            <p className="py-10 text-center text-[15px] text-zinc-500 dark:text-zinc-500">
              No brands yet. Create the first one.
            </p>
          )}

          {brands?.map((brand) => <BrandRow key={brand.id} brand={brand} />)}
        </div>
      </Container>
    </section>
  )
}

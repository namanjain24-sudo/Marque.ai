// pages/Library.jsx — filter tabs, search, asset grid with brand health strip.
// Real data: assets saved via Signal Check (save-on-check), alerts from the
// latest brand audit.
import { X } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AssetCard } from "../components/AssetCard"
import { BrandifyPanel } from "../components/BrandifyPanel"
import { Container } from "../components/Container"
import { api } from "../lib/api"
import { useBrand } from "../context/BrandContext"

const FILTER_TABS = ["All", "Posters", "Posts", "Stories", "WhatsApp", "Uploads"]

const TAB_TYPE = {
  All: null,
  Posters: "poster",
  Posts: "post",
  Stories: "story",
  WhatsApp: "whatsapp",
  Uploads: "other",
}

export function Library() {
  const { brand } = useBrand()
  const [assets, setAssets] = useState([])
  const [alerts, setAlerts] = useState([])
  const [activeTab, setActiveTab] = useState("All")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  // Bumped by the Retry button to re-trigger the load effect. Resetting the
  // loading/error state happens here (an event handler), not inside the effect,
  // so the effect body never calls setState synchronously.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!brand?.id) return
    let cancelled = false
    api
      .listAssets(brand.id)
      .then((list) => { if (!cancelled) setAssets(list ?? []) })
      .catch((err) => { if (!cancelled) setLoadError(err.message ?? "Could not load assets.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    api
      .listAudits(brand.id)
      .then((audits) => { if (!cancelled) setAlerts(audits?.[0]?.report?.alerts ?? []) })
      .catch(() => { if (!cancelled) setAlerts([]) })
    return () => { cancelled = true }
  }, [brand?.id, reloadKey])

  async function removeAsset(assetId) {
    if (!brand?.id || deletingId) return
    setDeletingId(assetId)
    try {
      await api.deleteAsset(brand.id, assetId)
      setAssets((list) => list.filter((a) => a.id !== assetId))
    } catch {
      // Keep the card; the next list refresh will reconcile.
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = useMemo(() => {
    let list = assets
    const type = TAB_TYPE[activeTab]
    if (type) list = list.filter((a) => a.type === type)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) =>
        [a.label, a.slots?.headline, a.slots?.subline]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(q)),
      )
    }
    return list
  }, [assets, activeTab, search])

  const avgMatch = assets.length
    ? Math.round(assets.reduce((s, a) => s + (a.signal_match ?? 0), 0) / assets.length)
    : 0

  return (
    <div className="py-10">
      <Container>
        <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">Library</h1>

        {/* Brand-ify an uploaded image into a brand-consistent asset */}
        {brand?.id && (
          <div className="mt-6">
            <BrandifyPanel brandId={brand.id} onDone={reload} />
          </div>
        )}

        {/* Dashboard strip */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Brand health</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{avgMatch}</p>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-500">avg signal match</p>
          </div>
          <div className="border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Assets</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{assets.length}</p>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-500">total</p>
          </div>
          {alerts.map((alert, i) => (
            <div key={i} className="border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="font-mono text-[11px] uppercase tracking-widest text-amber-600 dark:text-amber-400">Alert</p>
              <p className="mt-1 text-[13px] text-amber-900 dark:text-amber-300">{alert}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="flex gap-1 rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-sm px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-emerald-700 text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>

        {/* Error state */}
        {loadError && !loading && (
          <div className="mt-8 flex items-center justify-between gap-4 border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={reload}
              className="rounded-md border border-amber-300 px-3 py-1 font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse border border-zinc-200 dark:border-zinc-800" />
            ))}

          {!loading &&
            !loadError &&
            filtered.map((asset) => (
              <div key={asset.id} className="group relative">
                <button
                  type="button"
                  onClick={() => removeAsset(asset.id)}
                  disabled={deletingId === asset.id}
                  aria-label="Delete asset"
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-200 bg-white/90 text-zinc-500 opacity-0 transition-opacity hover:text-red-600 disabled:opacity-40 group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-400"
                >
                  <X size={13} weight="bold" />
                </button>
                <AssetCard asset={asset} />
              </div>
            ))}

          {!loading && !loadError && filtered.length === 0 && (
            <p className="col-span-4 py-8 text-center text-[15px] text-zinc-400 dark:text-zinc-600">
              {assets.length === 0
                ? "No saved assets yet — run a Signal Check and hit Save to library."
                : "No assets match."}
            </p>
          )}
        </div>
      </Container>
    </div>
  )
}

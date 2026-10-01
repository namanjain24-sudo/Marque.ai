// pages/Library.jsx — filter tabs, search, asset grid with brand health strip.
// Real data: assets saved via Signal Check (save-on-check), alerts from the
// latest brand audit.
import { useEffect, useMemo, useState } from "react"
import { AssetCard } from "../components/AssetCard"
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

  useEffect(() => {
    if (!brand?.id) return
    api.listAssets(brand.id).then(setAssets).catch(() => setAssets([]))
    api
      .listAudits(brand.id)
      .then((audits) => setAlerts(audits?.[0]?.report?.alerts ?? []))
      .catch(() => setAlerts([]))
  }, [brand?.id])

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

        {/* Grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
          {filtered.length === 0 && (
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

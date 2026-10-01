// pages/Editor.jsx — asset editor with live preview, rules check, signal card.
// Loads the real asset by id from the API (GET /v1/brands/{id}/assets/{assetId}),
// seeds local edit state from it, and lets the user tweak slots/knobs. The inner
// component is remounted by key once the asset loads so useState re-seeds cleanly
// (same pattern as Brand.jsx's BrandEditorInner).
import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { AssetPreview } from "../components/AssetPreview"
import { AutoFixResult } from "../components/AutoFixResult"
import { Container } from "../components/Container"
import { Toast, useToast } from "../components/Toast"
import { useBrand } from "../context/BrandContext"
import { useAutoFix } from "../hooks/useAutoFix"
import { api } from "../lib/api"
import { rasterize } from "../lib/rasterize"
import { rulesStatusList } from "../lib/rules"

const SIZE_TABS = [
  { label: "4:5", type: "poster" },
  { label: "1:1", type: "post" },
  { label: "9:16", type: "story" },
]

const VARIANT_OPTIONS = ["left", "center", "split"]

// Defaults for an asset that carries no rendered slots/knobs (e.g. an upload).
const DEFAULT_SLOTS = { headline: "", subline: "", price: "", cta: "", logo: "" }
const DEFAULT_KNOBS = {
  density: "balanced",
  font_style: "display_bold",
  photo_tone: "warm",
  accent_usage: 0.6,
  overlay: 0.4,
  layout_variant: "left",
}

const RULE_STATUS_ICON = {
  ok: <CheckCircle size={14} weight="bold" className="text-emerald-700 dark:text-emerald-500" />,
  warn: <WarningCircle size={14} weight="bold" className="text-amber-600 dark:text-amber-400" />,
  error: <XCircle size={14} weight="bold" className="text-red-600 dark:text-red-400" />,
}

// Outer: resolve the asset from the API by route param, then render the editor.
export function Editor() {
  const { assetId } = useParams()
  const { brand } = useBrand()
  const [asset, setAsset] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!brand?.id || !assetId) return
    let cancelled = false
    api
      .getAsset(brand.id, assetId)
      .then((data) => { if (!cancelled) setAsset(data) })
      .catch((err) => { if (!cancelled) setLoadError(err.message ?? "Could not load this asset.") })
    return () => { cancelled = true }
  }, [brand?.id, assetId])

  if (loadError) {
    return (
      <div className="py-8">
        <Container>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {loadError}
          </p>
        </Container>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="py-8">
        <Container>
          <div className="h-96 animate-pulse border border-zinc-200 dark:border-zinc-800" />
        </Container>
      </div>
    )
  }

  // Remount on asset id so local edit state re-seeds from the loaded asset.
  return <EditorInner key={asset.id} asset={asset} />
}

function EditorInner({ asset: baseAsset }) {
  const { brand } = useBrand()
  const { toast, showToast, hideToast } = useToast()

  const [slots, setSlots] = useState({ ...DEFAULT_SLOTS, ...(baseAsset.slots ?? {}) })
  const [knobs, setKnobs] = useState({ ...DEFAULT_KNOBS, ...(baseAsset.knobs ?? {}) })
  const [activeSize, setActiveSize] = useState(baseAsset.type === "other" ? "poster" : baseAsset.type)

  const previewRef = useRef(null)
  const { run, rounds, running, error, reset } = useAutoFix(brand?.id)
  const [exporting, setExporting] = useState(false)

  function updateSlot(key, value) {
    setSlots((s) => ({ ...s, [key]: value }))
  }

  function updateKnob(key, value) {
    setKnobs((k) => ({ ...k, [key]: value }))
  }

  async function exportPng() {
    if (exporting || !previewRef.current) return
    setExporting(true)
    try {
      const file = await rasterize(previewRef.current, { name: `${slots.headline ?? "asset"}.png` })
      const url = URL.createObjectURL(file)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showToast(err.message ?? "Export failed.", "info")
    } finally {
      setExporting(false)
    }
  }

  // Real F4 auto-fix loop: rasterize the live preview, check it, and if it
  // needs fixing, apply the critic's knobs (which re-renders this very
  // preview) and re-check — up to 2 rounds.
  async function recheck() {
    reset()
    await run({
      getNode: () => previewRef.current,
      applyKnobs: (next) => setKnobs(next),
      knobs,
    })
  }

  // Brand is normally loaded by the time an asset resolves, but guard anyway so
  // a null brand never crashes the editor (BrandContext seeds brand as null).
  const palette = brand?.palette ?? {}
  const rules = rulesStatusList({ slots, knobs, palette, brand })

  return (
    <div className="py-8">
      <Container>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-50">Editor</h1>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={recheck}
              disabled={running}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {running ? "Checking…" : "Check & auto-fix"}
            </button>
            <button
              type="button"
              onClick={exportPng}
              disabled={exporting}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export PNG"}
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Left — preview */}
          <div className="space-y-4">
            {/* Size tabs */}
            <div className="flex gap-2 rounded-md border border-zinc-200 p-1 w-fit dark:border-zinc-800">
              {SIZE_TABS.map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => setActiveSize(tab.type)}
                  className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeSize === tab.type
                      ? "bg-emerald-700 text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              {/* ref wraps only the asset so the rasterized PNG is the asset itself */}
              <div ref={previewRef} className="mx-auto w-full max-w-[360px]">
                <AssetPreview
                  type={activeSize}
                  slots={slots}
                  knobs={knobs}
                  palette={palette}
                  fonts={brand?.fonts}
                />
              </div>
            </div>
          </div>

          {/* Right — edit panel */}
          <div className="space-y-6">
            {/* Text slots */}
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Text</h2>
              <div className="mt-4 space-y-4">
                {[
                  { key: "headline", label: "Headline", placeholder: "Headline…" },
                  { key: "subline", label: "Subline", placeholder: "Subline…" },
                  { key: "price", label: "Price", placeholder: "₹399" },
                  { key: "cta", label: "CTA", placeholder: "Order on WhatsApp" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="grid gap-1.5">
                    <label className="text-[12px] font-medium text-zinc-500 dark:text-zinc-500">{label}</label>
                    <input
                      value={slots[key] ?? ""}
                      onChange={(e) => updateSlot(key, e.target.value)}
                      placeholder={placeholder}
                      className="min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Layout knobs */}
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Layout</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-zinc-500 dark:text-zinc-500">Variant</label>
                  <div className="mt-2 flex gap-2">
                    {VARIANT_OPTIONS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => updateKnob("layout_variant", v)}
                        className={`rounded-sm border px-3 py-1 text-[13px] capitalize transition-colors ${
                          knobs.layout_variant === v
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-medium text-zinc-500 dark:text-zinc-500">
                    Overlay <span className="font-mono text-zinc-400">{knobs.overlay?.toFixed(1)}</span>
                  </label>
                  <input
                    type="range" min={0} max={0.8} step={0.05}
                    value={knobs.overlay ?? 0.4}
                    onChange={(e) => updateKnob("overlay", parseFloat(e.target.value))}
                    className="mt-2 w-full accent-emerald-700"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-medium text-zinc-500 dark:text-zinc-500">
                    Accent usage <span className="font-mono text-zinc-400">{knobs.accent_usage?.toFixed(1)}</span>
                  </label>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={knobs.accent_usage ?? 0.6}
                    onChange={(e) => updateKnob("accent_usage", parseFloat(e.target.value))}
                    className="mt-2 w-full accent-emerald-700"
                  />
                </div>
              </div>
            </div>

            {/* Palette swatches */}
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Brand palette</h2>
              <div className="mt-3 flex gap-2">
                {Object.entries(palette).map(([key, hex]) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className="h-8 w-8 border border-zinc-200 dark:border-zinc-800" style={{ background: hex }} title={hex} />
                    <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-600">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand rules status */}
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Brand rules</h2>
              <ul className="mt-3 space-y-2">
                {rules.map((r) => (
                  <li key={r.label} className="flex items-center gap-2.5 text-[13px]">
                    {RULE_STATUS_ICON[r.status]}
                    <span className="text-zinc-700 dark:text-zinc-300">{r.label}</span>
                    <span className="ml-auto text-zinc-400 dark:text-zinc-600">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Live Signal Check + auto-fix result */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Signal Check</h2>
              <AutoFixResult rounds={rounds} running={running} error={error} />
            </div>
          </div>
        </div>
      </Container>

      <Toast message={toast?.message} type={toast?.type} onClose={hideToast} />
    </div>
  )
}

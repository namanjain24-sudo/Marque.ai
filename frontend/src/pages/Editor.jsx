// pages/Editor.jsx — asset editor with live preview, rules check, signal card
import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react"
import { useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { AssetPreview } from "../components/AssetPreview"
import { AutoFixResult } from "../components/AutoFixResult"
import { Container } from "../components/Container"
import { Toast, useToast } from "../components/Toast"
import { useBrand } from "../context/BrandContext"
import { useAutoFix } from "../hooks/useAutoFix"
import campaignData from "../mock/campaign.json"
import { rulesStatusList } from "../lib/rules"

// Find asset across all campaigns
function findAsset(id) {
  for (const c of campaignData.campaigns) {
    const a = c.assets.find((a) => a.id === id)
    if (a) return a
  }
  return campaignData.campaigns[0].assets[0]
}

const SIZE_TABS = [
  { label: "4:5", type: "poster" },
  { label: "1:1", type: "post" },
  { label: "9:16", type: "story" },
]

const VARIANT_OPTIONS = ["left", "center", "split"]

const RULE_STATUS_ICON = {
  ok: <CheckCircle size={14} weight="bold" className="text-emerald-700 dark:text-emerald-500" />,
  warn: <WarningCircle size={14} weight="bold" className="text-amber-600 dark:text-amber-400" />,
  error: <XCircle size={14} weight="bold" className="text-red-600 dark:text-red-400" />,
}

export function Editor() {
  const { assetId } = useParams()
  const { brand } = useBrand()
  const { toast, showToast, hideToast } = useToast()

  const baseAsset = findAsset(assetId)
  const [slots, setSlots] = useState({ ...baseAsset.slots })
  const [knobs, setKnobs] = useState({ ...baseAsset.knobs })
  const [activeSize, setActiveSize] = useState(baseAsset.type)

  const previewRef = useRef(null)
  const { run, rounds, running, error, reset } = useAutoFix(brand?.id)

  function updateSlot(key, value) {
    setSlots((s) => ({ ...s, [key]: value }))
  }

  function updateKnob(key, value) {
    setKnobs((k) => ({ ...k, [key]: value }))
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

  const rules = rulesStatusList({ slots, knobs, palette: brand.palette, brand })

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
              onClick={() => showToast("Export will work after backend is connected.", "info")}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Export PNG
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
                  palette={brand.palette}
                  fonts={brand.fonts}
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
                {Object.entries(brand.palette).map(([key, hex]) => (
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

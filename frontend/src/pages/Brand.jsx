// pages/Brand.jsx — brand profile editor with sliders, chips, identity tabs
import { Check } from "@phosphor-icons/react"
import { useState } from "react"
import { BrandIdentityCard } from "../components/BrandIdentityCard"
import { Button } from "../components/Button"
import { ChipList } from "../components/ChipList"
import { Container } from "../components/Container"
import { SignalCard } from "../components/SignalCard"
import { SliderRow } from "../components/SliderRow"
import { Toast, useToast } from "../components/Toast"
import { useBrand } from "../context/BrandContext"
import { directionLabel } from "../lib/fonts"

const AXES = [
  { key: "premium", left: "Accessible", right: "Premium" },
  { key: "modern", left: "Traditional", right: "Modern" },
  { key: "playful", left: "Serious", right: "Playful" },
  { key: "niche", left: "Mass-market", right: "Niche" },
]

const SWATCH_KEYS = ["primary", "secondary", "accent", "light", "dark"]

export function Brand() {
  const { brand, setBrand } = useBrand()
  const { toast, showToast, hideToast } = useToast()
  const [positioning, setPositioning] = useState({ ...brand.positioning })
  const [doRules, setDoRules] = useState([...brand.do])
  const [dontRules, setDontRules] = useState([...brand.dont])
  const [activeDir, setActiveDir] = useState("bold_premium")

  function updateAxis(key, value) {
    setPositioning((p) => ({ ...p, [key]: value }))
  }

  function save() {
    setBrand({ ...brand, positioning, do: doRules, dont: dontRules })
    showToast("Brand saved.", "success")
  }

  const dirs = ["bold_premium", "modern_minimal"]

  return (
    <div className="py-10">
      <Container>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">{brand.name}</h1>
            <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-500">{brand.category} · {brand.city}</p>
          </div>
          <Button onClick={save} className="px-4 py-2 text-sm">Save to Brand</Button>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
          {/* Left column */}
          <div className="space-y-12">
            {/* Brand profile card */}
            <BrandIdentityCard profile={brand} />

            {/* Palette */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Palette</h2>
              <div className="mt-4 flex gap-3">
                {SWATCH_KEYS.map((key) => (
                  <div key={key} className="flex flex-col items-center gap-1.5">
                    <span
                      className="h-10 w-10 border border-zinc-200 dark:border-zinc-800"
                      style={{ background: brand.palette[key] }}
                      title={`${key}: ${brand.palette[key]}`}
                    />
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{brand.palette[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Font pair */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Fonts</h2>
              <div className="mt-4 grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="bg-white p-4 dark:bg-zinc-900">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Heading</p>
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: `'${brand.fonts.heading}', sans-serif` }}>{brand.fonts.heading}</p>
                </div>
                <div className="bg-white p-4 dark:bg-zinc-900">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Body</p>
                  <p className="mt-1 text-lg text-zinc-900 dark:text-zinc-100" style={{ fontFamily: `'${brand.fonts.body}', sans-serif` }}>{brand.fonts.body}</p>
                </div>
              </div>
            </div>

            {/* Do / Don't chips */}
            <div className="grid gap-8 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-800">
              <ChipList title="Do" items={doRules} onChange={setDoRules} accent />
              <div className="sm:pl-8">
                <ChipList title="Don't" items={dontRules} onChange={setDontRules} />
              </div>
            </div>

            {/* Voice */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Voice</h2>
              <dl className="mt-4 space-y-2">
                {Object.entries(brand.voice ?? {}).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 text-[14px] dark:border-zinc-900">
                    <dt className="font-mono text-zinc-400 dark:text-zinc-600">{k}</dt>
                    <dd className="text-right text-zinc-700 dark:text-zinc-300">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Products */}
            {brand.personality?.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Personality</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {brand.personality.map((p) => (
                    <span key={p} className="rounded-sm border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[13px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Identity direction tabs */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Identity direction</h2>
              <div className="mt-4 flex gap-2 rounded-md border border-zinc-200 p-1 dark:border-zinc-800 w-fit">
                {dirs.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveDir(key)}
                    className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                      activeDir === key
                        ? "bg-emerald-700 text-white"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {directionLabel(key).name}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[14px] text-zinc-500 dark:text-zinc-500">{directionLabel(activeDir).description}</p>
            </div>
          </div>

          {/* Right column — sliders + signal card */}
          <div className="space-y-8">
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Positioning</h2>
              <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-500">Set target values. Signal check compares detected vs these.</p>
              <div className="mt-6 space-y-6">
                {AXES.map((axis) => (
                  <SliderRow
                    key={axis.key}
                    label={axis.key}
                    leftPole={axis.left}
                    rightPole={axis.right}
                    value={positioning[axis.key] ?? 50}
                    onChange={(v) => updateAxis(axis.key, v)}
                  />
                ))}
              </div>
            </div>

            <SignalCard />
          </div>
        </div>
      </Container>

      <Toast message={toast?.message} type={toast?.type} onClose={hideToast} />
    </div>
  )
}

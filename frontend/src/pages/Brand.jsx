// pages/Brand.jsx — the real Brand Memory editor. Every control here persists
// to the backend (PATCH /memory, GET/POST /identity) and re-reads the brand,
// so this is the live brand, not a local mock.
import { useEffect, useState } from "react"
import { BrandIdentityCard } from "../components/BrandIdentityCard"
import { Button } from "../components/Button"
import { ChipList } from "../components/ChipList"
import { Container } from "../components/Container"
import { SliderRow } from "../components/SliderRow"
import { Toast, useToast } from "../components/Toast"
import { useBrand } from "../context/BrandContext"
import { api } from "../lib/api"
import { directionLabel } from "../lib/fonts"

const AXES = [
  { key: "premium", left: "Accessible", right: "Premium" },
  { key: "modern", left: "Traditional", right: "Modern" },
  { key: "playful", left: "Serious", right: "Playful" },
  { key: "niche", left: "Mass-market", right: "Niche" },
]

const SWATCH_KEYS = ["primary", "secondary", "accent", "light", "dark"]

// Shallow-equal check so "Save" can be disabled when nothing changed.
function sameArray(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i])
}
function samePositioning(a, b) {
  return AXES.every((ax) => a[ax.key] === b[ax.key])
}

// Inner editor, remounted whenever the brand identity/version changes (via the
// `key` on <BrandEditor> below). Remounting re-seeds the local edit state from
// the freshly loaded brand without a setState-in-effect sync.
function BrandEditorInner() {
  const { brand, setBrand } = useBrand()
  const { toast, showToast, hideToast } = useToast()

  const [positioning, setPositioning] = useState({ ...brand.positioning })
  const [doRules, setDoRules] = useState([...brand.do])
  const [dontRules, setDontRules] = useState([...brand.dont])
  const [directions, setDirections] = useState([])
  const [saving, setSaving] = useState(false)
  const [applyingKey, setApplyingKey] = useState(null)

  // Real identity directions proposed for this brand's current positioning.
  // The component remounts on brand version change, so brand.id is enough here.
  useEffect(() => {
    if (!brand?.id) return
    api
      .getIdentityDirections(brand.id)
      .then((dirs) => setDirections(dirs ?? []))
      .catch(() => setDirections([]))
  }, [brand?.id])

  const dirty =
    !samePositioning(positioning, brand.positioning) ||
    !sameArray(doRules, brand.do) ||
    !sameArray(dontRules, brand.dont)

  async function save() {
    if (!brand?.id || saving) return
    setSaving(true)
    try {
      const updated = await api.patchMemory(brand.id, {
        positioning,
        do: doRules,
        dont: dontRules,
      })
      setBrand(updated)
      showToast("Saved to Brand Memory.", "success")
    } catch (err) {
      showToast(err.message || "Could not save.", "error")
    } finally {
      setSaving(false)
    }
  }

  async function applyDirection(key) {
    if (!brand?.id || applyingKey) return
    setApplyingKey(key)
    try {
      const updated = await api.applyIdentity(brand.id, key)
      setBrand(updated)
      showToast(`Applied the "${directionLabel(key).name}" direction.`, "success")
    } catch (err) {
      showToast(err.message || "Could not apply this direction.", "error")
    } finally {
      setApplyingKey(null)
    }
  }

  // Is a proposed direction already the brand's current look? (palette + fonts match)
  function isActive(dir) {
    return (
      brand.palette?.primary === dir.palette?.primary &&
      brand.fonts?.heading === dir.fonts?.heading
    )
  }

  return (
    <div className="py-10">
      <Container>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">{brand.name}</h1>
            <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-500">
              {[brand.category, brand.city].filter(Boolean).join(" · ")}
              {brand.version ? ` · v${brand.version}` : ""}
            </p>
          </div>
          <Button onClick={save} disabled={!dirty || saving} className="px-4 py-2 text-sm">
            {saving ? "Saving…" : dirty ? "Save to Brand" : "Saved"}
          </Button>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
          {/* Left column */}
          <div className="space-y-12">
            <BrandIdentityCard profile={brand} />

            {/* Palette */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Palette</h2>
              <div className="mt-4 flex gap-3">
                {SWATCH_KEYS.map((key) => (
                  <div key={key} className="flex flex-col items-center gap-1.5">
                    <span
                      className="h-10 w-10 border border-zinc-200 dark:border-zinc-800"
                      style={{ background: brand.palette?.[key] }}
                      title={`${key}: ${brand.palette?.[key]}`}
                    />
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{brand.palette?.[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fonts */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Fonts</h2>
              <div className="mt-4 grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="bg-white p-4 dark:bg-zinc-900">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Heading</p>
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: `'${brand.fonts?.heading}', sans-serif` }}>{brand.fonts?.heading}</p>
                </div>
                <div className="bg-white p-4 dark:bg-zinc-900">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Body</p>
                  <p className="mt-1 text-lg text-zinc-900 dark:text-zinc-100" style={{ fontFamily: `'${brand.fonts?.body}', sans-serif` }}>{brand.fonts?.body}</p>
                </div>
              </div>
            </div>

            {/* Do / Don't — edits persist on Save */}
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

            {/* Personality */}
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

            {/* Real identity directions with a working Apply */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Identity directions</h2>
              <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-500">
                Two directions proposed for this brand&rsquo;s positioning. Applying one locks its palette, fonts and meaning into Brand Memory.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {directions.length === 0 && (
                  <p className="text-[14px] text-zinc-400 dark:text-zinc-600">Loading directions…</p>
                )}
                {directions.map((dir) => {
                  const label = directionLabel(dir.key)
                  const active = isActive(dir)
                  return (
                    <div key={dir.key} className="border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{label.name}</p>
                        {active && (
                          <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        {SWATCH_KEYS.map((k) => (
                          <span key={k} className="h-6 w-6 border border-zinc-200 dark:border-zinc-800" style={{ background: dir.palette[k] }} />
                        ))}
                      </div>
                      <p className="mt-3 text-[13px] text-zinc-500 dark:text-zinc-500" style={{ fontFamily: `'${dir.fonts.heading}', sans-serif` }}>
                        {dir.fonts.heading} / {dir.fonts.body}
                      </p>
                      <button
                        type="button"
                        onClick={() => applyDirection(dir.key)}
                        disabled={active || applyingKey === dir.key}
                        className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-[13px] font-medium text-zinc-700 hover:border-emerald-700 hover:text-emerald-700 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {active ? "Applied" : applyingKey === dir.key ? "Applying…" : "Apply this direction"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right column — positioning sliders (the Signal Check targets) */}
          <div className="space-y-8">
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Positioning</h2>
              <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-500">
                The target every asset is scored against. Edit, then Save to Brand.
              </p>
              <div className="mt-6 space-y-6">
                {AXES.map((axis) => (
                  <SliderRow
                    key={axis.key}
                    label={axis.key}
                    leftPole={axis.left}
                    rightPole={axis.right}
                    value={positioning[axis.key] ?? 50}
                    onChange={(v) => setPositioning((p) => ({ ...p, [axis.key]: v }))}
                  />
                ))}
              </div>
            </div>

            {/* What the identity means — real meaning map from Brand Memory */}
            {brand.meaning && Object.keys(brand.meaning).length > 0 && (
              <div className="border border-zinc-200 p-5 dark:border-zinc-800">
                <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">What it signals</h2>
                <dl className="mt-4 space-y-2.5">
                  {Object.entries(brand.meaning).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{k}</dt>
                      <dd className="text-[13px] text-zinc-500 dark:text-zinc-500">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </Container>

      <Toast message={toast?.message} type={toast?.type} onClose={hideToast} />
    </div>
  )
}

export function Brand() {
  const { brand, loading } = useBrand()

  if (loading && !brand?.id) {
    return (
      <div className="py-10">
        <Container>
          <div className="h-48 animate-pulse border border-zinc-200 dark:border-zinc-800" />
        </Container>
      </div>
    )
  }
  // Remount on brand id + version so local edit state re-seeds from the latest
  // saved brand (no setState-in-effect needed).
  return <BrandEditorInner key={`${brand.id}:${brand.version ?? 0}`} />
}

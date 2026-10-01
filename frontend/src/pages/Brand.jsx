// pages/Brand.jsx — the real Brand Memory editor. Every control here persists
// to the backend (PATCH /memory, GET/POST /identity) and re-reads the brand,
// so this is the live brand, not a local mock.
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
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
function sameProducts(a, b) {
  if (a.length !== b.length) return false
  return a.every((p, i) => p.name === b[i].name && p.price === b[i].price)
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
  const [preferences, setPreferences] = useState([...(brand.preferences ?? [])])
  const [products, setProducts] = useState([...(brand.products ?? [])])
  const [directions, setDirections] = useState([])
  const [saving, setSaving] = useState(false)
  const [applyingKey, setApplyingKey] = useState(null)
  const [latestAudit, setLatestAudit] = useState(undefined)

  // Tone edit state (auto-save on blur, not part of the main Save button)
  const [tone, setTone] = useState(brand.voice?.tone ?? "")
  const toneRef = useRef(brand.voice?.tone ?? "")

  // Photo style edit state (auto-save on blur)
  const [photoStyle, setPhotoStyle] = useState(brand.photo_style ?? "")
  const photoStyleRef = useRef(brand.photo_style ?? "")

  // Palette color-picker refs (one hidden input per swatch)
  const colorInputRefs = useRef({})

  // New-product row refs for auto-focus
  const newProductNameRef = useRef(null)

  // Real identity directions proposed for this brand's current positioning.
  // The component remounts on brand version change, so brand.id is enough here.
  useEffect(() => {
    if (!brand?.id) return
    api
      .getIdentityDirections(brand.id)
      .then((dirs) => setDirections(dirs ?? []))
      .catch(() => setDirections([]))
  }, [brand?.id])

  // Load latest audit for the Last Audit section
  useEffect(() => {
    if (!brand?.id) return
    api
      .listAudits(brand.id)
      .then((audits) => setLatestAudit(audits?.[0] ?? null))
      .catch(() => setLatestAudit(null))
  }, [brand?.id])

  const dirty =
    !samePositioning(positioning, brand.positioning) ||
    !sameArray(doRules, brand.do) ||
    !sameArray(dontRules, brand.dont) ||
    !sameArray(preferences, brand.preferences ?? []) ||
    !sameProducts(products, brand.products ?? [])

  async function save() {
    if (!brand?.id || saving) return
    setSaving(true)
    try {
      const updated = await api.patchMemory(brand.id, {
        positioning,
        do: doRules,
        dont: dontRules,
        preferences,
        products,
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

  // Auto-save tone on blur
  async function saveTone() {
    const newTone = tone.trim()
    if (newTone === toneRef.current) return
    toneRef.current = newTone
    try {
      const updated = await api.patchMemory(brand.id, {
        voice: { ...brand.voice, tone: newTone },
      })
      setBrand(updated)
      showToast("Saved to Brand Memory.", "success")
    } catch (err) {
      showToast(err.message || "Could not save.", "error")
    }
  }

  // Auto-save photo style on blur
  async function savePhotoStyle() {
    const newVal = photoStyle.trim()
    if (newVal === photoStyleRef.current) return
    photoStyleRef.current = newVal
    try {
      const updated = await api.patchMemory(brand.id, { photo_style: newVal })
      setBrand(updated)
      showToast("Saved to Brand Memory.", "success")
    } catch (err) {
      showToast(err.message || "Could not save.", "error")
    }
  }

  // Auto-save palette swatch on blur
  async function saveSwatch(key, newHex) {
    if (newHex === brand.palette?.[key]) return
    try {
      const updated = await api.patchMemory(brand.id, {
        palette: { ...brand.palette, [key]: newHex },
      })
      setBrand(updated)
      showToast("Palette updated.", "success")
    } catch (err) {
      showToast(err.message || "Could not update palette.", "error")
    }
  }

  // Products helpers
  function addProduct() {
    setProducts((prev) => {
      const next = [...prev, { name: "", price: null }]
      // Auto-focus the new row's name input on next render
      setTimeout(() => {
        if (newProductNameRef.current) newProductNameRef.current.focus()
      }, 0)
      return next
    })
  }

  function updateProduct(index, field, value) {
    setProducts((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, [field]: field === "price" ? (value === "" ? null : Number(value)) : value }
          : p,
      ),
    )
  }

  function removeProduct(index) {
    setProducts((prev) => prev.filter((_, i) => i !== index))
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
                    <button
                      type="button"
                      className="relative h-10 w-10 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      style={{ background: brand.palette?.[key] }}
                      title={`${key}: ${brand.palette?.[key]} — click to edit`}
                      onClick={() => colorInputRefs.current[key]?.click()}
                    >
                      <input
                        type="color"
                        ref={(el) => { colorInputRefs.current[key] = el }}
                        defaultValue={brand.palette?.[key] ?? "#000000"}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        onBlur={(e) => saveSwatch(key, e.target.value)}
                      />
                    </button>
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

            {/* Photo style */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Photo style</h2>
              <div className="mt-4">
                <input
                  type="text"
                  value={photoStyle}
                  onChange={(e) => setPhotoStyle(e.target.value)}
                  onBlur={savePhotoStyle}
                  placeholder="e.g. dark, moody, close-up product shots"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Do / Don't — edits persist on Save */}
            <div className="grid gap-8 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-800">
              <ChipList title="Do" items={doRules} onChange={setDoRules} accent />
              <div className="sm:pl-8">
                <ChipList title="Don't" items={dontRules} onChange={setDontRules} />
              </div>
            </div>

            {/* Preferences */}
            <div>
              <ChipList title="Preferences" items={preferences} onChange={setPreferences} />
            </div>

            {/* Voice */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Voice</h2>
              <dl className="mt-4 space-y-2">
                {Object.entries(brand.voice ?? {}).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 text-[14px] dark:border-zinc-900">
                    <dt className="font-mono text-zinc-400 dark:text-zinc-600">{k}</dt>
                    {k === "tone" ? (
                      <dd className="min-w-0 flex-1 text-right">
                        <input
                          type="text"
                          maxLength={300}
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          onBlur={saveTone}
                          placeholder="e.g. confident-casual, urgent, warm"
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-right text-[14px] text-zinc-700 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder:text-zinc-600"
                        />
                      </dd>
                    ) : (
                      <dd className="text-right text-zinc-700 dark:text-zinc-300">{v}</dd>
                    )}
                  </div>
                ))}
                {/* If voice has no tone key yet, show a standalone tone input */}
                {brand.voice && !Object.prototype.hasOwnProperty.call(brand.voice, "tone") && (
                  <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 text-[14px] dark:border-zinc-900">
                    <dt className="font-mono text-zinc-400 dark:text-zinc-600">tone</dt>
                    <dd className="min-w-0 flex-1 text-right">
                      <input
                        type="text"
                        maxLength={300}
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        onBlur={saveTone}
                        placeholder="e.g. confident-casual, urgent, warm"
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-right text-[14px] text-zinc-700 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder:text-zinc-600"
                      />
                    </dd>
                  </div>
                )}
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

            {/* Products */}
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Products</h2>
              <div className="mt-4 space-y-2">
                {products.length === 0 ? (
                  <p className="text-[13px] italic text-zinc-400">No products yet. Add your menu items.</p>
                ) : (
                  products.map((product, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        ref={idx === products.length - 1 ? newProductNameRef : null}
                        value={product.name}
                        onChange={(e) => updateProduct(idx, "name", e.target.value)}
                        placeholder="Product name"
                        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price ?? ""}
                        onChange={(e) => updateProduct(idx, "price", e.target.value)}
                        placeholder="Price"
                        className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeProduct(idx)}
                        aria-label={`Remove product ${product.name || idx}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={addProduct}
                className="mt-3 text-[13px] font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                + Add product
              </button>
            </div>

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

            {/* Last audit */}
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Last audit</h2>
              <div className="mt-4">
                {latestAudit === undefined ? (
                  <p className="text-[13px] text-zinc-400 dark:text-zinc-600">Loading…</p>
                ) : latestAudit === null ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-500">
                      No audit yet. Upload 2–5 assets to check consistency.
                    </p>
                    <Link
                      to="/audit"
                      className="inline-block text-[13px] font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      → Run audit
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {latestAudit.report?.consistency_score != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-zinc-500 dark:text-zinc-500">Consistency</span>
                        <span className="rounded-sm bg-zinc-100 px-2 py-0.5 font-mono text-[13px] font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                          {latestAudit.report.consistency_score}
                        </span>
                      </div>
                    )}
                    <Link
                      to="/audit"
                      className="inline-block text-[13px] font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      → Run audit
                    </Link>
                  </div>
                )}
              </div>
            </div>
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

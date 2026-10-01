// pages/Onboarding.jsx — full onboarding flow with mock 2-second progress
import { Plus, X } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/Button"
import { Container } from "../components/Container"
import { useBrand } from "../context/BrandContext"
import brandData from "../mock/brand.json"

const PRICE_LEVELS = [
  { value: 1, label: "₹", hint: "Budget" },
  { value: 2, label: "₹₹", hint: "Mid-range" },
  { value: 3, label: "₹₹₹", hint: "Premium" },
]

const AGENT_MESSAGES = [
  "Reading your details…",
  "Picking colours and fonts…",
  "Drafting rules…",
]

const inputClass =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 w-full"

function Field({ label, hint, children, id }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-zinc-500 dark:text-zinc-500">{hint}</p>}
    </div>
  )
}

export function Onboarding() {
  const navigate = useNavigate()
  const { setBrand } = useBrand()
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [city, setCity] = useState("")
  const [audience, setAudience] = useState("")
  const [priceLevel, setPriceLevel] = useState(2)
  const [personality, setPersonality] = useState([])
  const [personalityDraft, setPersonalityDraft] = useState("")
  const [products, setProducts] = useState([{ name: "", price: "" }])
  const [website, setWebsite] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [agentMsg, setAgentMsg] = useState(0)
  const [error, setError] = useState(null)

  function addPersonality() {
    const word = personalityDraft.trim()
    if (!word || personality.includes(word) || personality.length >= 20) {
      setPersonalityDraft(""); return
    }
    setPersonality([...personality, word])
    setPersonalityDraft("")
  }

  function updateProduct(i, field, value) {
    setProducts(products.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !category.trim()) {
      setError("Business name and category are required."); return
    }
    setError(null)
    setSubmitting(true)

    // Simulate agent progress messages
    for (let i = 0; i < AGENT_MESSAGES.length; i++) {
      setAgentMsg(i)
      await new Promise((r) => setTimeout(r, 700))
    }

    // Use Burger Lab as the drafted brand result (mock)
    setBrand({ ...brandData, name: name.trim(), category: category.trim(), city: city.trim() || brandData.city })
    navigate("/brand")
  }

  return (
    <section className="py-16 sm:py-20">
      <Container className="max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tell us about the business
        </h1>
        <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-400">
          A handful of questions is enough. Marque drafts the rest, and every field below stays editable afterward.
        </p>

        <AnimatePresence>
          {submitting && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
              <p className="text-[15px] font-medium text-emerald-900 dark:text-emerald-300">
                {AGENT_MESSAGES[agentMsg]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="mt-10 grid gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Business name" id="ob-name">
              <input id="ob-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
            </Field>
            <Field label="Category" id="ob-cat" hint="e.g. Restaurant, D2C fashion, Gym">
              <input id="ob-cat" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={200} required />
            </Field>
            <Field label="City" id="ob-city" hint="Optional">
              <input id="ob-city" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Audience" id="ob-audience" hint="Optional, e.g. 18-30, urban">
              <input id="ob-audience" className={inputClass} value={audience} onChange={(e) => setAudience(e.target.value)} />
            </Field>
          </div>

          <Field label="Price level" id="ob-price">
            <div id="ob-price" className="inline-flex w-fit gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
              {PRICE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setPriceLevel(level.value)}
                  title={level.hint}
                  className={`rounded-sm px-5 py-1.5 text-sm font-medium transition-colors ${
                    priceLevel === level.value
                      ? "bg-emerald-700 text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Personality" id="ob-personality" hint="Words that describe the brand. Press Enter to add. Optional.">
            <div className="flex flex-wrap items-center gap-2">
              {personality.map((word) => (
                <span key={word} className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {word}
                  <button type="button" onClick={() => setPersonality(personality.filter((w) => w !== word))} aria-label={`Remove ${word}`} className="text-zinc-400 hover:text-zinc-700">
                    <X size={12} weight="bold" />
                  </button>
                </span>
              ))}
              <input
                id="ob-personality"
                className="min-w-[8rem] flex-1 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                placeholder="bold, playful, …"
                value={personalityDraft}
                onChange={(e) => setPersonalityDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPersonality() } }}
              />
            </div>
          </Field>

          {/* Products */}
          <div className="grid gap-3">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Products</p>
            <p className="-mt-2 text-[13px] text-zinc-500 dark:text-zinc-500">Optional, add as many as apply.</p>
            {products.map((product, i) => (
              <div key={i} className="flex gap-3">
                <input className={`${inputClass} flex-1`} placeholder="Product name" value={product.name} onChange={(e) => updateProduct(i, "name", e.target.value)} />
                <input className={`${inputClass} w-28`} placeholder="₹ Price" type="number" min="0" value={product.price} onChange={(e) => updateProduct(i, "price", e.target.value)} />
                <button type="button" onClick={() => setProducts(products.filter((_, idx) => idx !== i))} aria-label="Remove product" className="flex w-10 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:text-zinc-100">
                  <X size={15} weight="bold" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setProducts([...products, { name: "", price: "" }])} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-500">
              <Plus size={14} weight="bold" /> Add a product
            </button>
          </div>

          <Field label="Website" id="ob-website" hint="Optional">
            <input id="ob-website" className={inputClass} placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} type="url" />
          </Field>

          {/* Logo / screenshot upload UI only */}
          <div className="grid gap-3">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Logo & screenshots</p>
            <p className="-mt-2 text-[13px] text-zinc-500 dark:text-zinc-500">Optional. Upload will work after backend is connected.</p>
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-zinc-300 text-[13px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
              Drop files here — UI only
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Drafting…" : "Draft my brand"}
            </Button>
          </div>
        </form>
      </Container>
    </section>
  )
}

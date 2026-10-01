import { Plus, X } from "@phosphor-icons/react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../components/Button"
import { Container } from "../components/Container"
import { api } from "../lib/api"

const PRICE_LEVELS = [
  { value: 1, label: "Budget" },
  { value: 2, label: "Mid-range" },
  { value: 3, label: "Premium" },
]

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

const inputClass =
  "min-w-0 rounded-md border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"

export function Onboard() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [city, setCity] = useState("")
  const [audience, setAudience] = useState("")
  const [priceLevel, setPriceLevel] = useState(2)
  const [personality, setPersonality] = useState([])
  const [personalityDraft, setPersonalityDraft] = useState("")
  const [products, setProducts] = useState([{ name: "", price: "" }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function addPersonality() {
    const word = personalityDraft.trim()
    if (!word || personality.includes(word) || personality.length >= 20) {
      setPersonalityDraft("")
      return
    }
    setPersonality([...personality, word])
    setPersonalityDraft("")
  }

  function updateProduct(index, field, value) {
    setProducts(products.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  function removeProduct(index) {
    setProducts(products.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !category.trim()) {
      setError("Business name and category are required.")
      return
    }

    const cleanProducts = products
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        price: p.price === "" ? null : Number(p.price),
      }))

    setSubmitting(true)
    try {
      const brand = await api.createBrand({
        name: name.trim(),
        category: category.trim(),
        city: city.trim() || null,
        audience: audience.trim() || null,
        price_level: priceLevel,
        personality,
        products: cleanProducts,
      })
      navigate(`/brand/${brand.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <section className="py-16 sm:py-20">
      <Container className="max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tell us about the business
        </h1>
        <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-400">
          A handful of questions is enough. Marque drafts the rest, and every field below stays editable
          afterward.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 grid gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Business name" id="name">
              <input
                id="name"
                className={`${inputClass} w-full`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required
              />
            </Field>
            <Field label="Category" id="category" hint="e.g. Restaurant, D2C fashion, Gym">
              <input
                id="category"
                className={`${inputClass} w-full`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={200}
                required
              />
            </Field>
            <Field label="City" id="city" hint="Optional">
              <input id="city" className={`${inputClass} w-full`} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Audience" id="audience" hint="Optional, e.g. 18-30, urban">
              <input
                id="audience"
                className={`${inputClass} w-full`}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Price level" id="price">
            <div
              id="price"
              className="inline-flex w-fit gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700"
            >
              {PRICE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setPriceLevel(level.value)}
                  className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
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

          <Field
            label="Personality"
            id="personality"
            hint="Words that describe the brand. Press Enter to add each one. Optional."
          >
            <div className="flex flex-wrap items-center gap-2">
              {personality.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {word}
                  <button
                    type="button"
                    onClick={() => setPersonality(personality.filter((w) => w !== word))}
                    aria-label={`Remove ${word}`}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
                  >
                    <X size={13} weight="bold" />
                  </button>
                </span>
              ))}
              <input
                id="personality"
                className="min-w-[8rem] flex-1 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                placeholder="bold, playful, ..."
                value={personalityDraft}
                onChange={(e) => setPersonalityDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addPersonality()
                  }
                }}
              />
            </div>
          </Field>

          <div className="grid gap-3">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Products</p>
            <p className="-mt-2 text-[13px] text-zinc-500 dark:text-zinc-500">Optional, add as many as apply.</p>
            {products.map((product, i) => (
              <div key={i} className="flex gap-3">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="Product name"
                  value={product.name}
                  onChange={(e) => updateProduct(i, "name", e.target.value)}
                />
                <input
                  className={`${inputClass} w-28`}
                  placeholder="Price"
                  type="number"
                  min="0"
                  value={product.price}
                  onChange={(e) => updateProduct(i, "price", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeProduct(i)}
                  aria-label="Remove product"
                  className="flex w-10 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:text-zinc-100"
                >
                  <X size={15} weight="bold" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setProducts([...products, { name: "", price: "" }])}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-500 dark:hover:text-emerald-400"
            >
              <Plus size={15} weight="bold" />
              Add a product
            </button>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create brand"}
            </Button>
          </div>
        </form>
      </Container>
    </section>
  )
}

import { Check } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { Button } from "../components/Button"
import { BrandIdentityCard } from "../components/BrandIdentityCard"
import { Container } from "../components/Container"
import { RuleList } from "../components/RuleList"
import { ApiError, api } from "../lib/api"
import { directionLabel } from "../lib/fonts"

const PRICE_LABELS = { 1: "Budget", 2: "Mid-range", 3: "Premium" }
const AXES = ["premium", "modern", "playful", "niche"]

function PositioningAxis({ label, value }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm capitalize text-zinc-700 dark:text-zinc-300">{label}</p>
        <p className="font-mono text-[13px] text-zinc-400 dark:text-zinc-500">{value}</p>
      </div>
      <div className="relative mt-2 h-px bg-zinc-200 dark:bg-zinc-800">
        <span
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 bg-emerald-700 dark:bg-emerald-500"
          style={{ left: `calc(${value}% - 4px)` }}
        />
      </div>
    </div>
  )
}

function DirectionOption({ brandId, direction, isActive, onApplied }) {
  const [applying, setApplying] = useState(false)
  const [justApplied, setJustApplied] = useState(false)
  const [error, setError] = useState(null)
  const label = directionLabel(direction.key)

  async function apply() {
    setApplying(true)
    setError(null)
    try {
      const updated = await api.applyIdentity(brandId, direction.key)
      onApplied(updated)
      setJustApplied(true)
      setTimeout(() => setJustApplied(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div>
      <BrandIdentityCard profile={{ name: label.name, category: label.description, ...direction }} />
      <div className="mt-3">
        <Button
          variant={isActive ? "secondary" : "primary"}
          onClick={apply}
          disabled={applying}
          className="w-full px-4 py-2 text-sm"
        >
          {justApplied ? (
            <>
              <Check size={15} weight="bold" /> Applied
            </>
          ) : applying ? (
            "Applying..."
          ) : isActive ? (
            "Currently applied"
          ) : (
            "Apply this direction"
          )}
        </Button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}

export function BrandDashboard() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [directions, setDirections] = useState([])
  const [error, setError] = useState(null)
  const [loadedFor, setLoadedFor] = useState(null)

  // Navigating from one brand to another keeps this same component mounted
  // (only the :id param changes), so stale state needs clearing. Doing that
  // here, during render, avoids the extra cascading render an effect-based
  // reset would cause. See "Adjusting state when a prop changes" in the
  // React docs.
  if (id !== loadedFor) {
    setLoadedFor(id)
    setProfile(null)
    setError(null)
  }

  useEffect(() => {
    Promise.all([api.getBrand(id), api.getIdentityDirections(id)])
      .then(([brand, dirs]) => {
        setProfile(brand)
        setDirections(dirs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this brand."))
  }, [id])

  if (error) {
    return (
      <Container className="max-w-2xl py-20 text-center">
        <p className="text-[15px] text-zinc-600 dark:text-zinc-400">{error}</p>
        <Button to="/brands" variant="secondary" className="mt-6">
          Back to live brands
        </Button>
      </Container>
    )
  }

  if (!profile) {
    return (
      <Container className="max-w-2xl py-20">
        <div className="h-64 animate-pulse border border-zinc-200 dark:border-zinc-800" />
      </Container>
    )
  }

  return (
    <section className="py-12 sm:py-16">
      <Container className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-500">
          {profile.city && <span>{profile.city}</span>}
          {profile.audience && <span>{profile.audience}</span>}
          <span>{PRICE_LABELS[profile.price_level]}</span>
          {profile.voice?.tone && <span>{profile.voice.tone}</span>}
        </div>

        <div className="mt-6">
          <BrandIdentityCard profile={profile} />
        </div>

        <div className="mt-14">
          <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-50">Positioning</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:gap-x-10">
            {AXES.map((axis) => (
              <PositioningAxis key={axis} label={axis} value={profile.positioning[axis]} />
            ))}
          </div>
        </div>

        {directions.length > 0 && (
          <div className="mt-14">
            <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-50">Identity directions</h2>
            <p className="mt-1.5 text-[15px] text-zinc-600 dark:text-zinc-400">
              Proposed from this brand&rsquo;s positioning. Applying one replaces the palette, fonts, and
              meaning below.
            </p>
            <div className="mt-6 grid gap-8 sm:grid-cols-2">
              {directions.map((direction) => (
                <DirectionOption
                  key={direction.key}
                  brandId={id}
                  direction={direction}
                  isActive={profile.palette?.primary === direction.palette.primary}
                  onApplied={setProfile}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-14 grid gap-10 border-t border-zinc-200 pt-10 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 dark:border-zinc-800 dark:sm:divide-zinc-800">
          <RuleList brandId={id} field="do" title="Do" rules={profile.do} onChange={setProfile} />
          <div className="sm:pl-10">
            <RuleList brandId={id} field="dont" title="Don’t" rules={profile.dont} onChange={setProfile} />
          </div>
        </div>
        <div className="mt-10">
          <RuleList
            brandId={id}
            field="preferences"
            title="Preferences"
            rules={profile.preferences}
            onChange={setProfile}
          />
        </div>
      </Container>
    </section>
  )
}

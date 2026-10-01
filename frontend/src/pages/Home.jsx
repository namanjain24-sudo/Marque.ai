import { Barbell, Check, Coffee, Scissors, TShirt, X } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { AskBar } from "../components/AskBar"
import { AssetPreview } from "../components/AssetPreview"
import { BrandIdentityCard } from "../components/BrandIdentityCard"
import { Container } from "../components/Container"
import { LandingButton as Button } from "../components/landing/LandingButton"
import { MiniSignalCard } from "../components/landing/MiniSignalCard"
import { MiniTraceList } from "../components/landing/MiniTraceList"
import { ProductReel } from "../components/landing/ProductReel"
import { Reveal } from "../components/Reveal"
import { ContainerScroll } from "../components/ui/container-scroll-animation"
import { demoDirections, demoProfile, DEMO_BRAND_ID } from "../data/demoBrand"
import { api } from "../lib/api"
import { directionLabel } from "../lib/fonts"
import campaignData from "../mock/campaign.json"
import traceEvents from "../mock/trace.json"

const CAPABILITIES = [
  {
    title: "Draft your brand DNA",
    body: "Answer a few questions about the business. Marque proposes positioning, tone, and starting rules in under a second, no blank page to stare at.",
    featured: true,
  },
  {
    title: "Pick a direction",
    body: "Two complete identity directions, palette and fonts already paired. Apply the whole thing, or keep the current fonts and take only the colors.",
  },
  {
    title: "Teach it your rules",
    body: "Say it once, in plain language. Never use neon colors. It remembers, and nothing overrides that rule by accident later.",
  },
]

const ASSET_STEPS = [
  {
    icon: "01",
    title: "Give one goal.",
    body: 'Say what you\'re launching, like "truffle burger at ₹399 this weekend".',
  },
  {
    icon: "02",
    title: "Get four assets.",
    body: "Poster, Instagram post, story and WhatsApp creative, all sharing one message and price.",
  },
  {
    icon: "03",
    title: "Approve and export.",
    body: "You edit, approve and download. Marque.ai never posts for you.",
  },
]

const FORMAT_TABS = [
  { key: "poster", label: "Poster", size: "1080×1350" },
  { key: "post", label: "Instagram", size: "1080×1080" },
  { key: "story", label: "Story", size: "1080×1920" },
  { key: "whatsapp", label: "WhatsApp", size: "1080×1080" },
]

const CATEGORIES = [
  { label: "Restaurants & cafes", icon: Coffee },
  { label: "D2C & fashion", icon: TShirt },
  { label: "Gyms & studios", icon: Barbell },
  { label: "Salons & services", icon: Scissors },
]

// Demo asset from campaign mock
const DEMO_ASSET = campaignData.campaigns[0].assets[0]

export function Home() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [profile, setProfile] = useState(demoProfile)
  const [directions, setDirections] = useState(demoDirections)
  const [activeDirection, setActiveDirection] = useState(0)
  const [activeFormat, setActiveFormat] = useState("poster")

  useEffect(() => {
    let cancelled = false
    api
      .getBrand(DEMO_BRAND_ID)
      .then((live) => !cancelled && live && setProfile(live))
      .catch(() => {})
    api
      .getIdentityDirections(DEMO_BRAND_ID)
      .then((live) => !cancelled && live.length && setDirections(live))
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selected = directions[activeDirection] ?? directions[0]
  const activeFormatTab = FORMAT_TABS.find((t) => t.key === activeFormat) ?? FORMAT_TABS[0]

  function handleHeroPrompt(message) {
    navigate("/workspace", { state: { initialMessage: message } })
  }

  return (
    <div className="bg-(--color-paper) dark:bg-(--color-paper-dark)">
      {/* ── Hero: centered, with a live prompt into the workspace ──────── */}
      <section className="pt-16 pb-20 sm:pt-20 lg:pb-24">
        <Container className="flex flex-col items-center text-center">
          <h1 className="font-display max-w-3xl text-4xl font-extrabold tracking-tight text-(--color-ink) sm:text-5xl lg:text-6xl lg:leading-[1.05] dark:text-(--color-ink-inverse)">
            Brand identity that remembers the rules.
          </h1>
          <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
            Tell us about the business. We draft a complete brand identity, then remember every rule
            added to it afterward.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button to="/onboard">Get started</Button>
            <Button to={`/brand/${DEMO_BRAND_ID}`} variant="secondary">
              See a live brand
            </Button>
          </div>

          <Reveal delay={0.1} className="mt-10 w-full max-w-xl">
            <p className="mb-3 text-sm text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)">Or give it a goal right now</p>
            <AskBar onSubmit={handleHeroPrompt} showExamples={false} variant="hero" />
          </Reveal>
        </Container>
      </section>

      {/* ── Hero motion graphic: scroll-tilt showcase ───────────────────── */}
      <ContainerScroll>
        <ProductReel />
      </ContainerScroll>

      {/* ── What Marque.ai does ───────────────────────────────────────── */}
      <section className="border-y border-(--color-line) py-16 dark:border-(--color-line-dark)">
        <Container>
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">What Marque.ai does</h2>
          </Reveal>
          <div className="mt-10 grid gap-10 divide-(--color-line) md:grid-cols-[3fr_2fr_2fr] md:gap-0 md:divide-x dark:divide-(--color-line-dark)">
            {CAPABILITIES.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08} className={i > 0 ? "md:pl-10" : "md:pr-10"}>
                <h3
                  className={`font-display font-bold text-(--color-ink) dark:text-(--color-ink-inverse) ${item.featured ? "text-xl" : "text-lg"}`}
                >
                  {item.title}
                </h3>
                <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── SECTION A: From one goal to four assets ───────────────────── */}
      <section className="py-16">
        <Container>
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
              From one goal to four assets
            </h2>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
              Describe what you want to promote. Marque.ai handles the rest.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-10 divide-(--color-line) md:grid-cols-3 md:gap-0 md:divide-x dark:divide-(--color-line-dark)">
            {ASSET_STEPS.map((step, i) => (
              <Reveal key={step.icon} delay={i * 0.08} className={i > 0 ? "md:pl-10" : "md:pr-10"}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-(--color-gold-text) dark:text-(--color-gold-text-dark)">
                  {step.icon}
                </p>
                <h3 className="mt-2 font-display text-lg font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Two directions ────────────────────────────────────────────── */}
      <section className="border-y border-(--color-line) py-20 dark:border-(--color-line-dark)">
        <Container className="flex flex-col items-center text-center">
          <Reveal className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
              Two directions, one real brand
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
              Burger Lab&rsquo;s actual positioning, run through Marque&rsquo;s identity proposals. Switch
              between the two below.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 flex gap-2 rounded-md border border-(--color-line) p-1 dark:border-(--color-line-dark)">
            {directions.map((d, i) => {
              const label = directionLabel(d.key)
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setActiveDirection(i)}
                  className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                    i === activeDirection
                      ? "bg-(--color-gold) text-(--color-ink)"
                      : "text-(--color-ink-dim) hover:text-(--color-ink) dark:text-(--color-ink-inverse-dim) dark:hover:text-(--color-ink-inverse)"
                  }`}
                >
                  {label.name}
                </button>
              )
            })}
          </Reveal>

          {selected && (
            <div className="mt-8 w-full max-w-md text-left">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selected.key}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <BrandIdentityCard profile={{ name: profile.name, category: profile.category, ...selected }} />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </Container>
      </section>

      {/* ── SECTION B: Checks what customers will feel ───────────────── */}
      <section className="py-20">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
              Checks what customers will feel
            </h2>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
              Every asset is scored on premium, modern, playful and niche. If it misses your target,
              Marque.ai fixes it by itself, up to two rounds.
            </p>
            <div className="mt-8">
              <Button to="/workspace">See a live check</Button>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <MiniSignalCard />
          </Reveal>
        </Container>
      </section>

      {/* ── SECTION C: One idea, four formats ────────────────────────── */}
      <section className="border-y border-(--color-line) py-20 dark:border-(--color-line-dark)">
        <Container>
          <div className="flex flex-col items-center text-center">
            <Reveal className="max-w-xl">
              <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
                One idea, four formats
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
                One brief, four ready-to-use assets. Switch between formats below.
              </p>
            </Reveal>

            {/* Tab switcher */}
            <Reveal delay={0.1} className="mt-8 flex gap-2 rounded-md border border-(--color-line) p-1 dark:border-(--color-line-dark)">
              {FORMAT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFormat(tab.key)}
                  className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                    activeFormat === tab.key
                      ? "bg-(--color-gold) text-(--color-ink)"
                      : "text-(--color-ink-dim) hover:text-(--color-ink) dark:text-(--color-ink-inverse-dim) dark:hover:text-(--color-ink-inverse)"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </Reveal>
          </div>

          {/* Asset preview card */}
          <div className="mt-10 mx-auto max-w-sm">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeFormat}
                initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="border border-(--color-line) dark:border-(--color-line-dark)"
              >
                <div className="p-4">
                  <AssetPreview
                    type={activeFormat}
                    slots={DEMO_ASSET.slots}
                    knobs={DEMO_ASSET.knobs}
                    palette={profile.palette}
                    fonts={profile.fonts}
                  />
                </div>
                <div className="border-t border-(--color-line) p-4 dark:border-(--color-line-dark)">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)">
                    {activeFormatTab.size}
                  </p>
                  <dl className="mt-3 space-y-1.5">
                    {[
                      ["headline", DEMO_ASSET.slots.headline],
                      ["price", DEMO_ASSET.slots.price],
                      ["cta", DEMO_ASSET.slots.cta],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-4 text-[13px]">
                        <dt className="font-mono text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)">{k}</dt>
                        <dd className="text-right text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </Container>
      </section>

      {/* ── What Burger Lab has already taught it ────────────────────── */}
      <section className="py-16">
        <Container>
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
              What Burger Lab has already taught it
            </h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
              Added once, enforced every time after. These are live rules on a real brand in this system
              right now.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:divide-x sm:divide-(--color-line) dark:sm:divide-(--color-line-dark)">
            <Reveal delay={0.05} className="sm:pr-10">
              <h3 className="text-sm font-semibold text-(--color-ink) dark:text-(--color-ink-inverse)">Do</h3>
              <ul className="mt-4 space-y-3">
                {profile.do.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-[15px] text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
                    <Check size={17} weight="bold" className="mt-0.5 shrink-0 text-(--color-gold-text) dark:text-(--color-gold-text-dark)" />
                    {rule}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1} className="sm:pl-10">
              <h3 className="text-sm font-semibold text-(--color-ink) dark:text-(--color-ink-inverse)">Don&rsquo;t</h3>
              <ul className="mt-4 space-y-3">
                {profile.dont.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-[15px] text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
                    <X size={17} weight="bold" className="mt-0.5 shrink-0 text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)" />
                    {rule}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ── SECTION D: Watch it work ──────────────────────────────────── */}
      <section className="border-y border-(--color-line) py-16 dark:border-(--color-line-dark)">
        <Container>
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
              Watch it work
            </h2>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
              This is a live mock trace of the agent planning and scoring a campaign.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <MiniTraceList events={traceEvents} />
          </Reveal>
        </Container>
      </section>

      {/* ── Built for small business owners ──────────────────────────── */}
      <section className="py-20">
        <Container>
          <Reveal className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-(--color-ink) dark:text-(--color-ink-inverse)">
              Built for small business owners, not enterprises
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
              No procurement calls, no agency retainer. Marque is built around how a single owner
              actually makes brand decisions.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            {CATEGORIES.map((cat) => (
              <span key={cat.label} className="inline-flex items-center gap-2.5">
                <cat.icon size={18} weight="regular" className="shrink-0 text-(--color-gold-text) dark:text-(--color-gold-text-dark)" />
                <span className="text-[15px] font-medium text-(--color-ink) dark:text-(--color-ink-inverse)">{cat.label}</span>
              </span>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-(--color-line) py-20 dark:border-(--color-line-dark)">
        <Container className="flex flex-col items-center text-center">
          <Reveal>
            <h2 className="font-display max-w-2xl text-3xl font-extrabold tracking-tight text-(--color-ink) sm:text-4xl dark:text-(--color-ink-inverse)">
              Your brand already has an identity. Let&rsquo;s write it down.
            </h2>
            <p className="mt-4 text-[15px] text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)">Takes about two minutes.</p>
            <div className="mt-8">
              <Button to="/onboard">Get started</Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </div>
  )
}

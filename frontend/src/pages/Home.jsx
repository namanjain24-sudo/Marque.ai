import { Barbell, Check, Coffee, Scissors, TShirt, X } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { BrandIdentityCard } from "../components/BrandIdentityCard"
import { Button } from "../components/Button"
import { Container } from "../components/Container"
import { Reveal } from "../components/Reveal"
import { demoDirections, demoProfile, DEMO_BRAND_ID } from "../data/demoBrand"
import { api } from "../lib/api"
import { directionLabel } from "../lib/fonts"

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

const CATEGORIES = [
  { label: "Restaurants & cafes", icon: Coffee, tint: "bg-emerald-50 dark:bg-emerald-950/40" },
  { label: "D2C & fashion", icon: TShirt, tint: "bg-zinc-100 dark:bg-zinc-900" },
  { label: "Gyms & studios", icon: Barbell, tint: "bg-zinc-100 dark:bg-zinc-900" },
  { label: "Salons & services", icon: Scissors, tint: "bg-emerald-50 dark:bg-emerald-950/40" },
]

export function Home() {
  const [profile, setProfile] = useState(demoProfile)
  const [directions, setDirections] = useState(demoDirections)
  const [activeDirection, setActiveDirection] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    api
      .getBrand(DEMO_BRAND_ID)
      .then((live) => !cancelled && setProfile(live))
      .catch(() => {})
    api
      .getIdentityDirections(DEMO_BRAND_ID)
      .then((live) => !cancelled && live.length && setDirections(live))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const selected = directions[activeDirection] ?? directions[0]

  return (
    <>
      {/* Hero: asymmetric split. Left carries the value prop, right is a real,
          live BrandIdentityCard (the same component the dashboard uses) so the
          first thing a visitor sees is actual product output, not a mockup. */}
      <section className="pt-16 pb-20 sm:pt-20 lg:pb-28">
        <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-[3.3rem] lg:leading-[1.08] dark:text-zinc-50">
              Brand identity that remembers the rules.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Tell us about the business. We draft a complete brand identity, then remember every rule
              added to it afterward.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button to="/onboard">Get started</Button>
              <Button to={`/brand/${DEMO_BRAND_ID}`} variant="secondary">
                See a live brand
              </Button>
            </div>
          </div>

          <Reveal delay={0.1}>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-500">An actual Marque.ai brand profile</p>
            <BrandIdentityCard profile={profile} />
          </Reveal>
        </Container>
      </section>

      {/* What it does: a divided, unevenly-weighted strip, not three equal cards. */}
      <section className="border-y border-zinc-200 py-16 dark:border-zinc-800">
        <Container>
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">What Marque.ai does</h2>
          </Reveal>
          <div className="mt-10 grid gap-10 divide-zinc-200 md:grid-cols-[3fr_2fr_2fr] md:gap-0 md:divide-x dark:divide-zinc-800">
            {CAPABILITIES.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08} className={i > 0 ? "md:pl-10" : "md:pr-10"}>
                <h3
                  className={`font-display font-bold text-zinc-900 dark:text-zinc-50 ${item.featured ? "text-xl" : "text-lg"}`}
                >
                  {item.title}
                </h3>
                <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Try it: centered stack, not another split, so the page doesn't fall
          into a left-text/right-visual rhythm. Switching direction is a real
          state change against the live API data fetched above. */}
      <section className="py-20">
        <Container className="flex flex-col items-center text-center">
          <Reveal className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Two directions, one real brand
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Burger Lab&rsquo;s actual positioning, run through Marque&rsquo;s identity proposals. Switch
              between the two below.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 flex gap-2 rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
            {directions.map((d, i) => {
              const label = directionLabel(d.key)
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setActiveDirection(i)}
                  className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                    i === activeDirection
                      ? "bg-emerald-700 text-white"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {label.name}
                </button>
              )
            })}
          </Reveal>

          {selected && (
            <div className="mt-8 w-full max-w-md text-left">
              {/* Feedback on a click, not scroll storytelling, so this fades
                  in immediately rather than waiting on viewport intersection
                  like Reveal does. */}
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

      {/* Brand memory: a two-column list, deliberately plain, to carry a real
          example rather than another visual set piece. */}
      <section className="border-y border-zinc-200 py-16 dark:border-zinc-800">
        <Container>
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              What Burger Lab has already taught it
            </h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Added once, enforced every time after. These are live rules on a real brand in this system
              right now.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-800">
            <Reveal delay={0.05} className="sm:pr-10">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Do</h3>
              <ul className="mt-4 space-y-3">
                {profile.do.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-[15px] text-zinc-700 dark:text-zinc-300">
                    <Check size={17} weight="bold" className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-500" />
                    {rule}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1} className="sm:pl-10">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Don&rsquo;t</h3>
              <ul className="mt-4 space-y-3">
                {profile.dont.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-[15px] text-zinc-700 dark:text-zinc-300">
                    <X size={17} weight="bold" className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-600" />
                    {rule}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Built for: a tinted bento rather than stock photography, since a
          random photo keyed to a seed can't be trusted to actually depict
          the category it's labeled with. */}
      <section className="py-20">
        <Container>
          <Reveal className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Built for small business owners, not enterprises
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              No procurement calls, no agency retainer. Marque is built around how a single owner
              actually makes brand decisions.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CATEGORIES.map((cat, i) => (
              <Reveal key={cat.label} delay={i * 0.06}>
                <div className={`flex aspect-square w-full items-center justify-center ${cat.tint}`}>
                  <cat.icon size={30} weight="regular" className="text-emerald-700 dark:text-emerald-500" />
                </div>
                <p className="mt-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">{cat.label}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing CTA: full-width centered stack, deliberately plain after the
          photo section so the ask is the last thing in the eye. */}
      <section className="border-t border-zinc-200 py-20 dark:border-zinc-800">
        <Container className="flex flex-col items-center text-center">
          <Reveal>
            <h2 className="font-display max-w-2xl text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
              Your brand already has an identity. Let&rsquo;s write it down.
            </h2>
            <p className="mt-4 text-[15px] text-zinc-500 dark:text-zinc-500">Takes about two minutes.</p>
            <div className="mt-8">
              <Button to="/onboard">Get started</Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  )
}

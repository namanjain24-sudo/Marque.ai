// components/landing/ProductReel.jsx — landing-page-only motion graphic.
// Not a video (no asset exists for one); instead a looping, code-driven
// reconstruction of an actual Marque.ai run, built from the same mock data
// (mock/trace.json, mock/campaign.json) every other demo on this page uses -
// real trace strings, a real asset's real slots, the PRD's own worked
// 74 -> 91 signal example. Nothing here is invented copy.
import { CheckCircle, Spinner } from "@phosphor-icons/react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { AssetPreview } from "../AssetPreview"
import { demoProfile } from "../../data/demoBrand"
import campaignData from "../../mock/campaign.json"
import traceEvents from "../../mock/trace.json"

const GOAL = "Launch our truffle burger at ₹399 this weekend"
const ASSET = campaignData.campaigns[0].assets[0]
const SIGNAL_START = 74
const SIGNAL_END = 91
// Index of the trace line after which the poster card appears, and after
// which the signal meter starts climbing (matches the real trace order:
// render happens before the signal check).
const ASSET_AT = 3
const SIGNAL_AT = traceEvents.findIndex((e) => e.startsWith("Signal"))

// Driven by Motion's imperative `animate()` rather than a manual
// setInterval/rAF loop: the effect's own body never calls setState
// synchronously (only inside animate's onUpdate callback), and `active`
// flipping true re-runs the effect from scratch, so there's no separate
// "reset" step to manage either.
function useTypewriter(text, active, charsPerSecond = 32) {
  const [out, setOut] = useState("")
  useEffect(() => {
    if (!active) return
    const controls = animate(0, text.length, {
      duration: text.length / charsPerSecond,
      ease: "linear",
      onUpdate: (v) => setOut(text.slice(0, Math.round(v))),
    })
    return () => controls.stop()
  }, [active, text, charsPerSecond])
  return out
}

function useCountUp(from, to, active, duration = 0.9) {
  const [value, setValue] = useState(from)
  useEffect(() => {
    if (!active) return
    const controls = animate(from, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [active, from, to, duration])
  return value
}

export function ProductReel() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(reduce ? traceEvents.length : -1)
  const timeouts = useRef([])

  useEffect(() => {
    if (reduce) return
    function clearAll() {
      timeouts.current.forEach(clearTimeout)
      timeouts.current = []
    }
    function run() {
      clearAll()
      setStep(-1)
      timeouts.current.push(setTimeout(() => setStep(0), 1400))
      for (let i = 1; i <= traceEvents.length; i++) {
        timeouts.current.push(setTimeout(() => setStep(i), 1400 + i * 650))
      }
      const total = 1400 + (traceEvents.length + 1) * 650
      timeouts.current.push(setTimeout(run, total + 3200))
    }
    run()
    return clearAll
  }, [reduce])

  const goalDone = step >= 0
  const typed = useTypewriter(GOAL, goalDone && !reduce)
  const visibleTrace = traceEvents.slice(0, Math.max(0, step))
  const assetVisible = step > ASSET_AT
  const signalVisible = step > SIGNAL_AT
  const score = useCountUp(SIGNAL_START, SIGNAL_END, signalVisible && !reduce)
  const scoreFinal = reduce ? SIGNAL_END : score
  const passed = scoreFinal >= SIGNAL_END

  return (
    <div className="grid h-full grid-cols-1 gap-0 md:grid-cols-[1.1fr_1fr]">
      {/* Left: goal + live trace */}
      <div className="flex flex-col justify-center border-b border-white/10 p-6 md:border-b-0 md:border-r md:p-10">
        <p className="font-mono text-[11px] uppercase tracking-widest text-(--color-gold)">Ask bar</p>
        <p className="mt-2 min-h-[2.5em] font-display text-lg font-semibold text-(--color-ink-inverse) sm:text-xl">
          {reduce ? GOAL : typed}
          {!reduce && goalDone && typed.length < GOAL.length && (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-(--color-gold) align-middle" />
          )}
        </p>

        <ul className="mt-6 space-y-2">
          {visibleTrace.map((event) => (
            <motion.li
              key={event}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 font-mono text-[12.5px] text-(--color-ink-inverse-dim)"
            >
              <CheckCircle size={13} weight="bold" className="shrink-0 text-(--color-gold)" />
              {event}
            </motion.li>
          ))}
          {!reduce && goalDone && visibleTrace.length < traceEvents.length && visibleTrace.length > 0 && (
            <li className="flex items-center gap-2 font-mono text-[12.5px] text-(--color-ink-inverse-dim)/60">
              <Spinner size={13} weight="bold" className="shrink-0 animate-spin" />
              working…
            </li>
          )}
        </ul>
      </div>

      {/* Right: the asset it produced + the signal check score */}
      <div className="flex flex-col items-center justify-center gap-5 p-6 md:p-10">
        <AnimatePresence>
          {(assetVisible || reduce) && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[220px] overflow-hidden rounded-lg border border-white/10"
            >
              <AssetPreview
                type="poster"
                slots={ASSET.slots}
                knobs={ASSET.knobs}
                palette={demoProfile.palette}
                fonts={demoProfile.fonts}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(signalVisible || reduce) && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex w-full max-w-[220px] items-center justify-between border border-white/10 bg-white/5 px-4 py-2.5"
            >
              <span className="font-mono text-[12px] text-(--color-ink-inverse-dim)">Signal match</span>
              <span className="flex items-center gap-1.5 font-mono text-[13px] font-semibold text-(--color-ink-inverse)">
                {scoreFinal}/100
                {passed && <CheckCircle size={14} weight="bold" className="text-(--color-gold)" />}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

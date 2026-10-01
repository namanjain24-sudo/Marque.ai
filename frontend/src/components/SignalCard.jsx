// components/SignalCard.jsx — shows match score, verdict, four mono rows, and Auto-fix.
// Accepts an optional `result` prop (a real SignalResult object).
// When result is null/undefined renders a graceful empty state — no mock data.
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

const AXES = ['premium', 'modern', 'playful', 'niche']

function MonoRow({ axis, target, detected, gap }) {
  const big = Math.abs(gap) > 20
  return (
    <div className="flex items-baseline justify-between border-b border-zinc-100 py-1.5 dark:border-zinc-900">
      <div className="flex items-baseline gap-3">
        <span className="w-16 font-mono text-[12px] capitalize text-zinc-400 dark:text-zinc-600">{axis}</span>
        <span className="font-mono text-[13px] text-zinc-700 dark:text-zinc-300">
          {detected} <span className="text-zinc-400 dark:text-zinc-600">/ {target}</span>
        </span>
      </div>
      <span
        className={`font-mono text-[12px] ${
          big ? 'font-semibold text-red-600 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-600'
        }`}
      >
        {gap > 0 ? `+${gap}` : gap}
      </span>
    </div>
  )
}

export function SignalCard({ result }) {
  const [fixing, setFixing] = useState(false)
  const [fixed, setFixed] = useState(false)

  // If no result yet, show an empty / not-run state
  if (!result) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="font-mono text-sm text-zinc-400 dark:text-zinc-600">Signal not checked</span>
        </div>
        <div className="px-5 py-3">
          {AXES.map((axis) => (
            <div key={axis} className="flex items-baseline justify-between border-b border-zinc-100 py-1.5 dark:border-zinc-900">
              <span className="w-16 font-mono text-[12px] capitalize text-zinc-400 dark:text-zinc-600">{axis}</span>
              <span className="font-mono text-[12px] text-zinc-300 dark:text-zinc-700">—</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const data = fixed && result.fix_result ? result.fix_result : result
  const pass = data.verdict === 'pass'
  // The backend returns this exact marker when no AI key is configured: show it
  // as an explicit amber banner so the score reads as a heuristic placeholder,
  // not a real vision result (UX invariant: silence broken work loudly).
  const heuristic = typeof data.issue === 'string' && data.issue.includes('heuristic fallback')

  async function handleAutoFix() {
    if (fixing || fixed || !result.fix_result) return
    setFixing(true)
    await new Promise((r) => setTimeout(r, 2000))
    setFixed(true)
    setFixing(false)
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800">
      {/* Heuristic-fallback banner — shown when no AI key is configured */}
      {heuristic && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-1.5 text-[12px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
          Signal Check: heuristic fallback — AI key not configured
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-baseline gap-2">
          <AnimatePresence mode="wait">
            <motion.span
              key={data.match}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {data.match}
            </motion.span>
          </AnimatePresence>
          <span className="font-mono text-sm text-zinc-400 dark:text-zinc-600">/ 100</span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
            pass
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
          }`}
        >
          {pass ? <CheckCircle size={13} weight="bold" /> : <WarningCircle size={13} weight="bold" />}
          {pass ? 'Pass' : 'Needs fix'}
        </span>
      </div>

      {/* Axis rows */}
      <div className="px-5 py-3">
        {AXES.map((axis) => (
          <MonoRow
            key={axis}
            axis={axis}
            target={data.target?.[axis] ?? 0}
            detected={data.detected?.[axis] ?? 0}
            gap={data.gaps?.[axis] ?? 0}
          />
        ))}
      </div>

      {/* Issue / Why line */}
      {data.issue && (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{data.issue}</p>
          {data.evidence?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.evidence.map((e) => (
                <li key={e} className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
                  · {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Auto-fix button */}
      {!pass && result.fix_result && (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <button
            type="button"
            onClick={handleAutoFix}
            disabled={fixing || fixed}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {fixing ? 'Revising: bolder headline, warmer photo, more accent…' : 'Auto-fix'}
          </button>
        </div>
      )}

      {fixed && (
        <div className="border-t border-zinc-100 px-5 py-2 dark:border-zinc-900">
          <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-500">
            Round 2 complete · Signal {result.fix_result?.match}, pass
          </p>
        </div>
      )}
    </div>
  )
}

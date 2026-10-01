// components/SignalCard.jsx — shows match score, verdict, four mono rows, and Auto-fix
// Uses mock data from signal.json, animates score from 74 → 91 on Auto-fix
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import signalData from '../mock/signal.json'

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

export function SignalCard() {
  const [round, setRound] = useState(1)
  const [fixing, setFixing] = useState(false)
  const data = round === 1 ? signalData.round1 : signalData.round2
  const pass = data.verdict === 'pass'

  async function handleAutoFix() {
    if (fixing || round === 2) return
    setFixing(true)
    await new Promise((r) => setTimeout(r, 2000))
    setRound(2)
    setFixing(false)
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800">
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
            target={data.target[axis]}
            detected={data.detected[axis]}
            gap={data.gaps[axis]}
          />
        ))}
      </div>

      {/* Issue / Why line */}
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

      {/* Auto-fix button */}
      {!pass && (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <button
            type="button"
            onClick={handleAutoFix}
            disabled={fixing || round === 2}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {fixing ? 'Revising: bolder headline, warmer photo, more accent…' : 'Auto-fix'}
          </button>
        </div>
      )}

      {round === 2 && (
        <div className="border-t border-zinc-100 px-5 py-2 dark:border-zinc-900">
          <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-500">Round 2 complete · Signal 91, pass</p>
        </div>
      )}
    </div>
  )
}

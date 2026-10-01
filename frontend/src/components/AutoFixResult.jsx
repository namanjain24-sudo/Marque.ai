// components/AutoFixResult.jsx — live F4 Signal Check result (one or two rounds).
// Driven by real SignalResult objects from the auto-fix loop (useAutoFix),
// unlike SignalCard which is a static marketing demo.
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'

const AXES = ['premium', 'modern', 'playful', 'niche']
const KNOB_LABELS = {
  density: 'Density',
  font_style: 'Font style',
  photo_tone: 'Photo tone',
  accent_usage: 'Accent usage',
  overlay: 'Overlay',
  layout_variant: 'Layout',
}

function AxisRow({ axis, target, detected, gap }) {
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

function RoundBlock({ round, result }) {
  const pass = result.verdict === 'pass'
  const fixEntries = Object.entries(result.fix ?? {}).filter(([, v]) => v !== null && v !== undefined)
  return (
    <div className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-900">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
            Round {round}
          </span>
          <span className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">{result.match}</span>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">/ 100</span>
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

      <div className="px-5">
        {AXES.map((axis) => (
          <AxisRow
            key={axis}
            axis={axis}
            target={result.target[axis]}
            detected={result.detected[axis]}
            gap={result.gaps[axis]}
          />
        ))}
      </div>

      <div className="px-5 py-3">
        <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{result.issue}</p>
        {result.evidence?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {result.evidence.map((e) => (
              <li key={e} className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
                · {e}
              </li>
            ))}
          </ul>
        )}
        {!pass && fixEntries.length > 0 && (
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <p className="text-[12px] text-zinc-500 dark:text-zinc-500">
              {round === 1 ? 'Applying fix →' : 'Suggested fix'}
            </p>
            <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
              {fixEntries.map(([knob, value]) => (
                <div key={knob} className="flex items-baseline gap-1.5 text-[12px]">
                  <dt className="text-zinc-400 dark:text-zinc-600">{KNOB_LABELS[knob] ?? knob}</dt>
                  <dd className="font-mono text-zinc-700 dark:text-zinc-300">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}

export function AutoFixResult({ rounds, running, error }) {
  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    )
  }
  if (!rounds || rounds.length === 0) {
    return (
      <div className="border border-zinc-200 px-5 py-4 text-[13px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        {running ? 'Rendering and checking this asset…' : 'Run a signal check to score this asset.'}
      </div>
    )
  }

  const last = rounds[rounds.length - 1].result
  const settled = last.verdict === 'pass'
  return (
    <div className="border border-zinc-200 dark:border-zinc-800">
      {rounds.map(({ round, result }) => (
        <RoundBlock key={round} round={round} result={result} />
      ))}
      <div className="border-t border-zinc-100 px-5 py-2 dark:border-zinc-900">
        <p
          className={`font-mono text-[11px] ${
            settled ? 'text-emerald-700 dark:text-emerald-500' : 'text-amber-700 dark:text-amber-500'
          }`}
        >
          {running
            ? 'Auto-fixing…'
            : settled
              ? `Settled at round ${rounds.length} · Signal ${last.match}, pass`
              : `Stopped after round ${rounds.length} · Signal ${last.match}, still needs fix`}
        </p>
      </div>
    </div>
  )
}

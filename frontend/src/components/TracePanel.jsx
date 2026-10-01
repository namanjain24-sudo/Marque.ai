// components/TracePanel.jsx — mono log with ticks and spinner
import { CheckCircle } from '@phosphor-icons/react'
import { motion } from 'motion/react'

export function TracePanel({ events = [], playing = false }) {
  return (
    <div className="rounded-none border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        Agent trace
      </p>
      {events.length === 0 && !playing && (
        <p className="font-mono text-[13px] text-zinc-400 dark:text-zinc-600">Waiting for goal…</p>
      )}
      <ul className="space-y-1.5">
        {events.map((event, i) => {
          const isLast = i === events.length - 1 && playing
          // A real trace step is { label, ms }; tolerate a plain string too.
          const label = typeof event === 'string' ? event : event?.label
          const ms = typeof event === 'object' && event?.ms != null ? event.ms : null
          return (
            <motion.li
              key={`${label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2.5 font-mono text-[13px]"
            >
              {isLast ? (
                <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              ) : (
                <CheckCircle
                  size={14}
                  weight="bold"
                  className="shrink-0 text-emerald-700 dark:text-emerald-500"
                />
              )}
              <span className={`flex-1 ${isLast ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {label}
              </span>
              {ms != null && (
                <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-600">{ms}ms</span>
              )}
            </motion.li>
          )
        })}
        {playing && events.length === 0 && (
          <li className="flex items-center gap-2.5 font-mono text-[13px]">
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <span className="text-zinc-600 dark:text-zinc-400">Starting…</span>
          </li>
        )}
      </ul>
    </div>
  )
}

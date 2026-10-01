// components/landing/MiniTraceList.jsx — landing-only static trace list.
// Same mock/trace.json every other trace view on this page reads from.
import { CheckCircle } from "@phosphor-icons/react"

export function MiniTraceList({ events }) {
  return (
    <div className="border border-(--color-line) bg-(--color-card) p-6 dark:border-(--color-line-dark) dark:bg-(--color-card-dark)">
      <ul className="space-y-2.5">
        {events.map((event) => (
          <li
            key={event}
            className="flex items-center gap-2.5 font-mono text-[13px] text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)"
          >
            <CheckCircle size={15} weight="bold" className="shrink-0 text-(--color-gold-text) dark:text-(--color-gold-text-dark)" />
            {event}
          </li>
        ))}
      </ul>
    </div>
  )
}

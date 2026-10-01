// components/landing/MiniSignalCard.jsx — landing-only, static score-card
// snapshot. Real numbers: the PRD's own worked example (Section 9.4) and
// the axis definitions from Table 8, same source every other signal display
// in this app uses - not invented for this card.
const AXES = [
  { label: "Premium", target: 70, detected: 88 },
  { label: "Modern", target: 80, detected: 82 },
  { label: "Playful", target: 75, detected: 40 },
  { label: "Niche", target: 55, detected: 60 },
]

export function MiniSignalCard() {
  return (
    <div className="border border-(--color-line) bg-(--color-card) p-6 dark:border-(--color-line-dark) dark:bg-(--color-card-dark)">
      <div className="flex items-center justify-between">
        <p className="font-mono text-2xl text-(--color-ink) dark:text-(--color-ink-inverse)">
          Match <span className="font-semibold">91</span> / 100
        </p>
        <span className="rounded-md bg-(--color-gold)/20 px-2.5 py-1 text-xs font-semibold text-(--color-gold-text) dark:text-(--color-gold-text-dark)">
          Pass
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-x-8">
        {AXES.map((axis) => (
          <div key={axis.label}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">{axis.label}</p>
              <p className="font-mono text-[12px] text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)">{axis.detected}</p>
            </div>
            <div className="relative mt-2 h-px bg-(--color-line) dark:bg-(--color-line-dark)">
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-(--color-ink-faint) bg-(--color-card) dark:bg-(--color-card-dark)"
                style={{ left: `calc(${axis.target}% - 5px)` }}
              />
              <span
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 bg-(--color-gold-strong)"
                style={{ left: `calc(${axis.detected}% - 4px)` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-(--color-ink-dim) dark:text-(--color-ink-inverse-dim)">
        Gold thin serif headline and empty dark space read luxury and serious. Revised: bolder headline,
        warmer photo, more accent colour.
      </p>
    </div>
  )
}

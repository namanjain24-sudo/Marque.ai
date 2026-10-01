// components/SliderRow.jsx — positioning axis slider with left/right pole labels
export function SliderRow({ label, leftPole, rightPole, value, onChange }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">{label}</span>
        <span className="font-mono text-[13px] text-zinc-400 dark:text-zinc-600">{value}</span>
      </div>

      {/* Poles */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-600">
        <span>{leftPole}</span>
        <span>{rightPole}</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-emerald-700"
      />

      {/* Track visualisation */}
      <div className="relative h-px bg-zinc-200 dark:bg-zinc-800">
        <span
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 bg-emerald-700 dark:bg-emerald-500"
          style={{ left: `calc(${value}% - 4px)` }}
        />
      </div>
    </div>
  )
}

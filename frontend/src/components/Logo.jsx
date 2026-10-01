export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M1 1H13L19 7V19H7L1 13V1Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="text-emerald-700 dark:text-emerald-500"
        />
      </svg>
      <span className="font-display text-[19px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        Marque<span className="font-semibold text-zinc-400 dark:text-zinc-500">.ai</span>
      </span>
    </span>
  )
}

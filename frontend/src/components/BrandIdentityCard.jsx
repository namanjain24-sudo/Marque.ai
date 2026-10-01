import { useEffect } from "react"

import { loadBrandFonts } from "../lib/fonts"

const SWATCH_KEYS = ["primary", "secondary", "accent", "light", "dark"]

export function BrandIdentityCard({ profile, className = "" }) {
  const { name, category, palette, fonts, meaning } = profile

  useEffect(() => {
    loadBrandFonts(fonts)
  }, [fonts])

  const headingFamily = fonts?.heading ? `'${fonts.heading}', ui-sans-serif, system-ui, sans-serif` : undefined
  const bodyFamily = fonts?.body ? `'${fonts.body}', ui-sans-serif, system-ui, sans-serif` : undefined
  const meaningEntries = Object.entries(meaning ?? {}).slice(0, 3)

  return (
    <div className={`border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <div className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{category}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style={{ fontFamily: headingFamily }}>
            {name}
          </p>
        </div>
        {palette && (
          <div className="flex shrink-0 -space-x-1">
            {SWATCH_KEYS.map((key) => (
              <span
                key={key}
                title={`${key}: ${palette[key]}`}
                className="h-8 w-8 border border-white dark:border-zinc-900"
                style={{ backgroundColor: palette[key] }}
              />
            ))}
          </div>
        )}
      </div>

      {fonts && (
        <div className="grid grid-cols-2 gap-px border-t border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          <div className="bg-white p-5 dark:bg-zinc-900">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Heading</p>
            <p className="mt-1 text-lg leading-snug break-words text-zinc-900 dark:text-zinc-100" style={{ fontFamily: headingFamily }}>
              {fonts.heading}
            </p>
          </div>
          <div className="bg-white p-5 dark:bg-zinc-900">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Body</p>
            <p className="mt-1 text-lg leading-snug break-words text-zinc-900 dark:text-zinc-100" style={{ fontFamily: bodyFamily }}>
              {fonts.body}
            </p>
          </div>
        </div>
      )}

      {meaningEntries.length > 0 && (
        <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">
          <dl className="space-y-2">
            {meaningEntries.map(([token, mean]) => (
              <div key={token} className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="font-mono text-[13px] text-zinc-500 dark:text-zinc-400">{token}</dt>
                <dd className="text-right text-zinc-700 dark:text-zinc-300">{mean}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

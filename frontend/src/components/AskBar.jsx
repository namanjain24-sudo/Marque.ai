// components/AskBar.jsx — single input with send button and example chips.
// variant="compact" (default): the slim bar used in the Workspace sidebar -
// unchanged zinc/emerald styling, shared with pages outside the landing page.
// variant="hero": landing-page-only tall composer, gold/paper themed.
import { ArrowRight, ArrowUp } from '@phosphor-icons/react'
import { useState } from 'react'

const EXAMPLES = [
  'Diwali offer 20% off on combos',
  'New café opening in Saket',
  'Make the story more premium',
]

export function AskBar({
  onSubmit,
  placeholder = 'Launch our truffle burger at ₹399 this weekend',
  disabled = false,
  variant = 'compact',
  showExamples = true,
}) {
  const [value, setValue] = useState('')

  function submit(msg) {
    const m = (msg ?? value).trim()
    if (!m) return
    setValue('')
    onSubmit(m)
  }

  if (variant === 'hero') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-3xl border border-(--color-line) bg-(--color-card) p-3 shadow-[0_1px_2px_rgba(28,23,16,0.04)] dark:border-(--color-line-dark) dark:bg-(--color-card-dark)">
          <textarea
            id="ask-bar-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={2}
            className="min-h-16 w-full resize-none bg-transparent px-3 pt-2 text-[16px] text-(--color-ink) placeholder:text-(--color-ink-faint) focus:outline-none disabled:opacity-50 dark:text-(--color-ink-inverse) dark:placeholder:text-(--color-ink-inverse-dim)"
          />
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="font-mono text-[12px] text-(--color-ink-faint) dark:text-(--color-ink-inverse-dim)">Tell it the goal, it plans the campaign</p>
            <button
              type="button"
              onClick={() => submit()}
              disabled={disabled || !value.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--color-gold) text-(--color-ink) hover:bg-(--color-gold-strong) disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowUp size={16} weight="bold" />
            </button>
          </div>
        </div>

        {showExamples && (
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => submit(ex)}
                disabled={disabled}
                className="rounded-full border border-(--color-line) bg-(--color-paper-soft) px-3 py-1.5 text-[12px] text-(--color-ink-dim) transition-colors hover:border-(--color-ink-faint) hover:text-(--color-ink) disabled:opacity-40 dark:border-(--color-line-dark) dark:bg-(--color-card-dark) dark:text-(--color-ink-inverse-dim) dark:hover:text-(--color-ink-inverse)"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border border-zinc-300 bg-white pr-1 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          id="ask-bar-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      {showExamples && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              disabled={disabled}
              className="rounded-sm border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

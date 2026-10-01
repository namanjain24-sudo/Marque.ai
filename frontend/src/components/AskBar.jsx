// components/AskBar.jsx — single input with send button and example chips
import { ArrowRight } from '@phosphor-icons/react'
import { useState } from 'react'

const EXAMPLES = [
  'Diwali offer 20% off on combos',
  'New café opening in Saket',
  'Make the story more premium',
]

export function AskBar({ onSubmit, placeholder = 'Launch our truffle burger at ₹399 this weekend', disabled = false }) {
  const [value, setValue] = useState('')

  function submit(msg) {
    const m = (msg ?? value).trim()
    if (!m) return
    setValue('')
    onSubmit(m)
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

      {/* Example chips */}
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
    </div>
  )
}

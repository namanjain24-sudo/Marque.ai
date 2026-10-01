// components/ChipList.jsx — editable chip list for Do/Don't in Brand page
import { Plus, X } from '@phosphor-icons/react'
import { useState } from 'react'

export function ChipList({ title, items, onChange, accent = false }) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v || items.includes(v)) { setDraft(''); return }
    onChange([...items, v])
    setDraft('')
  }

  function remove(item) {
    onChange(items.filter((i) => i !== item))
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] ${
              accent
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
            }`}
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`Remove ${item}`}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
            >
              <X size={11} weight="bold" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add() }
          }}
          placeholder="Add…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add chip"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-500 hover:border-emerald-700 hover:text-emerald-700 disabled:opacity-40 dark:border-zinc-700"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}

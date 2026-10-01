import { Plus, X } from "@phosphor-icons/react"
import { useState } from "react"

import { api } from "../lib/api"

export function RuleList({ brandId, field, title, rules, onChange }) {
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  async function add() {
    const value = draft.trim()
    if (!value) return
    setPending(true)
    setError(null)
    try {
      const updated = await api.appendRule(brandId, field, value)
      onChange(updated)
      setDraft("")
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  async function remove(rule) {
    setPending(true)
    setError(null)
    try {
      const updated = await api.patchMemory(brandId, { [field]: rules.filter((r) => r !== rule) })
      onChange(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <ul className="mt-3 space-y-2">
        {rules.map((rule) => (
          <li
            key={rule}
            className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 text-[15px] text-zinc-700 dark:border-zinc-900 dark:text-zinc-300"
          >
            {rule}
            <button
              type="button"
              onClick={() => remove(rule)}
              disabled={pending}
              aria-label={`Remove rule: ${rule}`}
              className="shrink-0 text-zinc-300 hover:text-zinc-600 disabled:opacity-40 dark:text-zinc-700 dark:hover:text-zinc-400"
            >
              <X size={14} weight="bold" />
            </button>
          </li>
        ))}
        {rules.length === 0 && <li className="py-2 text-[15px] text-zinc-400 dark:text-zinc-600">Nothing yet.</li>}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add a rule"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !draft.trim()}
          aria-label="Add rule"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-500 hover:border-emerald-700 hover:text-emerald-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400"
        >
          <Plus size={15} weight="bold" />
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}

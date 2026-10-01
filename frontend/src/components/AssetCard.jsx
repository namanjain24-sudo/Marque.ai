// components/AssetCard.jsx — compact card for Library / Campaign grids
import { ArrowSquareOut, ArrowsClockwise } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { AssetPreview } from './AssetPreview'
import brandData from '../mock/brand.json'

const TYPE_LABELS = {
  poster: 'Poster',
  post: 'Instagram post',
  story: 'Story',
  whatsapp: 'WhatsApp creative',
}

export function AssetCard({ asset, showScore = true }) {
  const { id, type, label, size, signal_match, signal_verdict, slots, knobs } = asset
  const pass = signal_verdict === 'pass'

  return (
    <div className="flex flex-col border border-zinc-200 dark:border-zinc-800">
      {/* Preview */}
      <div className="bg-zinc-100 dark:bg-zinc-900 p-3">
        <AssetPreview
          type={type}
          slots={slots}
          knobs={knobs}
          palette={brandData.palette}
          fonts={brandData.fonts}
        />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {label ?? TYPE_LABELS[type] ?? type}
            </p>
            {size && (
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{size}</p>
            )}
          </div>
          {showScore && signal_match !== undefined && (
            <span
              className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[12px] font-semibold ${
                pass
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {signal_match}
            </span>
          )}
        </div>

        {/* Score bar */}
        {showScore && signal_match !== undefined && (
          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-px transition-all ${pass ? 'bg-emerald-600' : 'bg-amber-500'}`}
              style={{ width: `${signal_match}%` }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <Link
            to={`/editor/${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
          >
            <ArrowSquareOut size={13} />
            Edit
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
          >
            <ArrowsClockwise size={13} />
            Re-check
          </button>
        </div>
      </div>
    </div>
  )
}

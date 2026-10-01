// components/AssetCard.jsx — compact card for Library / Campaign grids.
// The Re-check button rasterizes the live preview and runs a real Signal Check,
// updating the score badge in place (no chat, no page nav).
import { ArrowSquareOut, ArrowsClockwise } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AssetPreview } from './AssetPreview'
import { useBrand } from '../context/BrandContext'
import { api } from '../lib/api'
import { rasterize } from '../lib/rasterize'

const TYPE_LABELS = {
  poster: 'Poster',
  post: 'Instagram post',
  story: 'Story',
  whatsapp: 'WhatsApp creative',
  other: 'Upload',
}

export function AssetCard({ asset, showScore = true }) {
  const { brand } = useBrand()
  const { id, type, label, size, slots, knobs, png_url } = asset
  const previewRef = useRef(null)

  // Local, in-place signal state so a Re-check updates this card without a
  // refetch. Seeded from the asset's stored score.
  const [signalMatch, setSignalMatch] = useState(asset.signal_match ?? null)
  const [signalVerdict, setSignalVerdict] = useState(asset.signal_verdict ?? null)
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)

  const pass = signalVerdict === 'pass'

  async function recheck() {
    if (!brand?.id || checking || !previewRef.current) return
    setChecking(true)
    setCheckFailed(false)
    try {
      const file = await rasterize(previewRef.current, { name: `${id}.png` })
      const result = await api.checkSignal(brand.id, file)
      setSignalMatch(result.match)
      setSignalVerdict(result.verdict)
    } catch {
      setCheckFailed(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col border border-zinc-200 dark:border-zinc-800">
      {/* Preview */}
      <div className="bg-zinc-100 dark:bg-zinc-900 p-3">
        <div ref={previewRef}>
          <AssetPreview
            type={type}
            slots={slots}
            knobs={knobs}
            palette={brand?.palette}
            fonts={brand?.fonts}
            pngUrl={png_url}
          />
        </div>
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
          {showScore && checking && (
            <span className="shrink-0 animate-pulse rounded-sm bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Checking…
            </span>
          )}
          {showScore && !checking && checkFailed && (
            <span className="shrink-0 rounded-sm bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Check failed
            </span>
          )}
          {showScore && !checking && !checkFailed && signalMatch !== null && signalMatch !== undefined && (
            <span
              className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[12px] font-semibold ${
                pass
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {signalMatch}
            </span>
          )}
          {showScore && !checking && !checkFailed && (signalMatch === null || signalMatch === undefined) && (
            <span className="shrink-0 rounded-sm bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Signal not checked
            </span>
          )}
        </div>

        {/* Score bar */}
        {showScore && signalMatch !== null && signalMatch !== undefined && (
          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-px transition-all ${pass ? 'bg-emerald-600' : 'bg-amber-500'}`}
              style={{ width: `${signalMatch}%` }}
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
            onClick={recheck}
            disabled={checking || !brand?.id}
            title="Rasterize this preview and run a Signal Check"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            <ArrowsClockwise size={13} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking…' : 'Re-check'}
          </button>
        </div>
      </div>
    </div>
  )
}

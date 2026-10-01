// components/BrandifyPanel.jsx — upload any image, get a brand-consistent version.
// The image-edit model restyles the upload to the brand's palette/photo_style/
// positioning (server-side); the result is scored by Signal Check and lands in
// the Library. Shows a before/after once it returns.
import { MagicWand, UploadSimple } from "@phosphor-icons/react"
import { useRef, useState } from "react"

import { api } from "../lib/api"

export function BrandifyPanel({ brandId, onDone }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [beforeUrl, setBeforeUrl] = useState(null)
  const [result, setResult] = useState(null) // the returned LibraryAsset
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function pickFile(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setFile(picked)
    setResult(null)
    setError(null)
    setBeforeUrl(URL.createObjectURL(picked))
  }

  async function run() {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const asset = await api.brandifyAsset(brandId, file, "other")
      setResult(asset)
      onDone?.(asset)
    } catch (err) {
      setError(err.message || "Could not brand-ify this image.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-start gap-2">
        <MagicWand size={18} weight="bold" className="mt-0.5 text-emerald-700 dark:text-emerald-500" />
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Brand-ify an image</h2>
          <p className="mt-1 max-w-[60ch] text-[14px] text-zinc-600 dark:text-zinc-400">
            Upload any photo and the agent restyles it to this brand&rsquo;s palette, mood and positioning —
            same subject, on-brand look. The result is scored and saved to your Library.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickFile} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
        >
          <UploadSimple size={15} />
          {file ? file.name : "Choose an image"}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={!file || loading}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-50"
        >
          <MagicWand size={15} weight="bold" />
          {loading ? "Brand-ifying…" : "Brand-ify"}
        </button>
      </div>

      {error && <p className="mt-3 text-[13px] text-red-700 dark:text-red-400">{error}</p>}

      {(beforeUrl || result) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {beforeUrl && (
            <figure>
              <figcaption className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                Original
              </figcaption>
              <img src={beforeUrl} alt="Original upload" className="w-full border border-zinc-200 object-cover dark:border-zinc-800" />
            </figure>
          )}
          <figure>
            <figcaption className="mb-1.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-emerald-700 dark:text-emerald-500">
              <span>Brand-ified</span>
              {result && (
                <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 font-sans text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  signal {result.signal_match}
                </span>
              )}
            </figcaption>
            {result ? (
              <img src={result.png_url} alt="Brand-ified result" className="w-full border border-zinc-200 object-cover dark:border-zinc-800" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700">
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                ) : (
                  <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-600">result appears here</span>
                )}
              </div>
            )}
          </figure>
        </div>
      )}
    </div>
  )
}

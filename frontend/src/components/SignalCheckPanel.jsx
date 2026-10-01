import { CheckCircle, UploadSimple, WarningCircle } from "@phosphor-icons/react"
import { useRef, useState } from "react"

import { api } from "../lib/api"

const AXES = ["premium", "modern", "playful", "niche"]
const KNOB_LABELS = {
  density: "Density",
  font_style: "Font style",
  photo_tone: "Photo tone",
  accent_usage: "Accent usage",
  overlay: "Overlay",
  layout_variant: "Layout",
}

function AxisRow({ label, target, detected, gap }) {
  const biggestOffender = Math.abs(gap) > 20
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm capitalize text-zinc-700 dark:text-zinc-300">{label}</p>
        <p
          className={`font-mono text-[13px] ${
            biggestOffender ? "text-red-700 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {gap > 0 ? `+${gap}` : gap}
        </p>
      </div>
      <div className="relative mt-2 h-px bg-zinc-200 dark:bg-zinc-800">
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-950"
          style={{ left: `calc(${target}% - 5px)` }}
          title={`Target ${target}`}
        />
        <span
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 bg-emerald-700 dark:bg-emerald-500"
          style={{ left: `calc(${detected}% - 4px)` }}
          title={`Detected ${detected}`}
        />
      </div>
    </div>
  )
}

export function SignalCheckPanel({ brandId }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function pickFile(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setFile(picked)
    setResult(null)
    setError(null)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  async function runCheck() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.checkSignal(brandId, file)
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fixEntries = result ? Object.entries(result.fix).filter(([, v]) => v !== null && v !== undefined) : []

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-50">Signal Check</h2>
      <p className="mt-1.5 max-w-[60ch] text-[15px] text-zinc-600 dark:text-zinc-400">
        Upload any poster or post. The agent scores what it actually reads as against this brand&rsquo;s
        target positioning above.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickFile} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          <UploadSimple size={15} weight="regular" />
          {file ? file.name : "Choose an image"}
        </button>
        <button
          type="button"
          onClick={runCheck}
          disabled={!file || loading}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check signal"}
        </button>
      </div>

      {error && <p className="mt-3 text-[13px] text-red-700 dark:text-red-400">{error}</p>}

      {(previewUrl || result) && (
        <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr]">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="h-auto w-full border border-zinc-200 object-cover dark:border-zinc-800"
            />
          )}

          {result && (
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-2xl text-zinc-900 dark:text-zinc-50">
                  Match <span className="font-semibold">{result.match}</span> / 100
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
                    result.verdict === "pass"
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  }`}
                >
                  {result.verdict === "pass" ? (
                    <CheckCircle size={14} weight="bold" />
                  ) : (
                    <WarningCircle size={14} weight="bold" />
                  )}
                  {result.verdict === "pass" ? "Pass" : "Needs fix"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-x-8">
                {AXES.map((axis) => (
                  <AxisRow
                    key={axis}
                    label={axis}
                    target={result.target[axis]}
                    detected={result.detected[axis]}
                    gap={result.gaps[axis]}
                  />
                ))}
              </div>

              <p className="mt-5 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{result.issue}</p>

              {result.evidence.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {result.evidence.map((item) => (
                    <li key={item} className="text-[13px] text-zinc-500 dark:text-zinc-500">
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {fixEntries.length > 0 && (
                <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-500">Suggested fix</p>
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {fixEntries.map(([knob, value]) => (
                      <div key={knob} className="flex items-baseline gap-1.5 text-[13px]">
                        <dt className="text-zinc-400 dark:text-zinc-600">{KNOB_LABELS[knob]}</dt>
                        <dd className="font-mono text-zinc-700 dark:text-zinc-300">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

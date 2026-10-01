// pages/Audit.jsx — upload box, run a real brand audit, show the report
import { UploadSimple } from "@phosphor-icons/react"
import { useRef, useState } from "react"
import { Button } from "../components/Button"
import { Container } from "../components/Container"
import { Toast, useToast } from "../components/Toast"
import { api } from "../lib/api"
import { useBrand } from "../context/BrandContext"

export function Audit() {
  const { brand } = useBrand()
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)
  const { toast, showToast, hideToast } = useToast()

  function pickFiles(e) {
    const picked = Array.from(e.target.files ?? []).slice(0, 5)
    setFiles(picked)
    setReport(null)
  }

  async function runAudit() {
    if (files.length < 2) { showToast("Upload at least 2 images.", "info"); return }
    setRunning(true)
    try {
      const result = await api.runAudit(brand.id, files)
      setReport(result)
    } catch (err) {
      showToast(err.message ?? "Audit failed.", "error")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">Brand audit</h1>
        <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-400">
          Upload 2–5 existing creatives and Marque.ai will check them for consistency against your brand rules.
        </p>

        {/* Upload box */}
        <div
          className="mt-8 flex flex-col items-center justify-center gap-4 rounded-none border border-dashed border-zinc-300 px-8 py-12 text-center dark:border-zinc-700 cursor-pointer hover:border-emerald-700 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimple size={28} className="text-zinc-400 dark:text-zinc-600" />
          <div>
            <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-300">
              {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Click to upload images"}
            </p>
            <p className="mt-1 text-[13px] text-zinc-400 dark:text-zinc-600">PNG, JPG, WebP · 2–5 files</p>
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
        </div>

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((f) => (
              <span key={f.name} className="rounded-sm border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[12px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {f.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button onClick={runAudit} disabled={running || files.length < 2}>
            {running ? "Running audit…" : "Run audit"}
          </Button>
        </div>

        {/* Report */}
        {report && (
          <div className="mt-10 space-y-6">
            <div className="border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-4xl font-semibold text-zinc-900 dark:text-zinc-50">{report.consistency_score}</span>
                <span className="font-mono text-sm text-zinc-400 dark:text-zinc-600">/ 100 consistency</span>
              </div>
              <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-400">{report.summary}</p>
            </div>

            {report.issues.length > 0 && (
              <div className="border border-zinc-200 dark:border-zinc-800">
                <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                  <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Top issues</p>
                </div>
                {report.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`px-5 py-3 ${i > 0 ? "border-t border-zinc-100 dark:border-zinc-900" : ""}`}
                  >
                    <div className="flex items-start gap-3 text-[14px]">
                      <span className="mt-0.5 font-mono text-zinc-400 dark:text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-zinc-800 dark:text-zinc-200">{issue.text}</span>
                    </div>
                    {issue.suggested_fix && (
                      <p className="mt-1 pl-8 text-[13px] text-emerald-700 dark:text-emerald-400">
                        Fix: {issue.suggested_fix}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="secondary"
              onClick={() => showToast("Auto-fix regenerates on-brand once the Asset Creator (F5) is wired in.", "info")}
            >
              Fix with Marque.ai
            </Button>
          </div>
        )}
      </Container>

      <Toast message={toast?.message} type={toast?.type} onClose={hideToast} />
    </div>
  )
}

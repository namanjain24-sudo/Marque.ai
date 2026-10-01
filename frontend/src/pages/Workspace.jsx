// pages/Workspace.jsx — 3-column: chat history, campaign results, trace panel
import { useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"

import { AskBar } from "../components/AskBar"
import { AssetCard } from "../components/AssetCard"
import { TracePanel } from "../components/TracePanel"
import { useBrand } from "../context/BrandContext"
import { useAgent } from "../hooks/useAgent"

export function Workspace() {
  const { brand } = useBrand()
  const location = useLocation()
  const { run, trace, running, campaign, question, error, messages } = useAgent(brand?.id)

  // If we arrived here from the hero chat (navigate with { state: { goal } }),
  // run that goal once the brand is loaded. Guarded so it fires a single time.
  const autoRan = useRef(false)
  useEffect(() => {
    const goal = location.state?.goal
    if (goal && brand?.id && !autoRan.current) {
      autoRan.current = true
      run(goal)
    }
  }, [location.state, brand?.id, run])

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left — ask panel */}
        <div className="flex w-full flex-col border-r border-zinc-200 lg:w-1/4 dark:border-zinc-800">
          <div className="flex-1 overflow-y-auto p-5">
            <p className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-50">Workspace</p>
            <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-500">Give me a goal and I'll plan the campaign.</p>

            {/* Identity-not-set banner — generations render on a grey palette
                until a direction is applied, so flag it up front. */}
            {brand?.id && !brand?.palette && messages.length === 0 && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-[13px] dark:border-amber-900 dark:bg-amber-950/20">
                <p className="font-medium text-amber-900 dark:text-amber-300">Brand identity not set up yet.</p>
                <p className="mt-0.5 text-[12px] text-amber-700 dark:text-amber-500">
                  Apply an identity direction on the{" "}
                  <Link to="/brand" className="underline">Brand page</Link> to unlock palette and fonts.
                </p>
              </div>
            )}

            {/* Chat history */}
            <div className="mt-6 space-y-3">
              {/* Message bubbles — the conversation turns so far */}
              {messages.length > 0 && (
                <div className="space-y-2">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <p
                        className={`max-w-[85%] rounded-sm px-3 py-2 text-[13px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {msg.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {/* Question / error feedback — shown in this panel on mobile (centre panel is lg-only) */}
              {question && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 lg:hidden dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="text-[13px] font-medium text-amber-900 dark:text-amber-300">{question}</p>
                  <p className="mt-0.5 text-[12px] text-amber-700 dark:text-amber-500">Add a price (e.g. ₹399) to continue.</p>
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 lg:hidden dark:border-red-900 dark:bg-red-950/20">
                  <p className="text-[13px] font-medium text-red-900 dark:text-red-300">{error}</p>
                </div>
              )}
              {campaign && (
                <div className="rounded-sm border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{campaign.name}</p>
                  <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-500">{campaign.status} · {campaign.assets?.length ?? 0} assets</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
            <AskBar onSubmit={run} disabled={running} />
          </div>
        </div>

        {/* Centre — results */}
        <div className="hidden flex-1 overflow-y-auto p-6 lg:block">
          {!campaign && !running && !question && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-mono text-[13px] text-zinc-400 dark:text-zinc-600">Give me a goal and I'll plan the campaign</p>
            </div>
          )}

          {question && (
            <div className="mx-auto max-w-md rounded-md border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-[15px] font-medium text-amber-900 dark:text-amber-300">{question}</p>
              <p className="mt-1 text-[13px] text-amber-700 dark:text-amber-500">Add a price (e.g. ₹399) to continue.</p>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-md rounded-md border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900 dark:bg-red-950/20">
              <p className="text-[15px] font-medium text-red-900 dark:text-red-300">{error}</p>
            </div>
          )}

          {campaign && (
            <div>
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-50">{campaign.name}</h2>
                <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-500">{campaign.objective}</p>
                <div className="mt-3 border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <p className="font-mono text-[12px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Core message</p>
                  <p className="mt-1 text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{campaign.core_message}</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {(campaign.assets ?? []).map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </div>
          )}

          {running && !campaign && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
              <p className="font-mono text-[13px] text-zinc-500 dark:text-zinc-500">Planning campaign…</p>
            </div>
          )}
        </div>

        {/* Right — trace */}
        <div className="hidden w-1/4 overflow-y-auto border-l border-zinc-200 p-4 dark:border-zinc-800 xl:block">
          <TracePanel events={trace} playing={running} />
        </div>
      </div>
    </div>
  )
}

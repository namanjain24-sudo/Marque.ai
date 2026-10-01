// pages/CampaignDetail.jsx — single campaign with assets, checklist, export button
import { Check, DownloadSimple } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { AssetCard } from "../components/AssetCard"
import { Container } from "../components/Container"
import { Toast, useToast } from "../components/Toast"
import { useBrand } from "../context/BrandContext"
import { api } from "../lib/api"

export function CampaignDetail() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState(null)
  const { toast, showToast, hideToast } = useToast()
  const { brand } = useBrand()

  useEffect(() => {
    api.getCampaign(id).then(setCampaign).catch(() => {})
  }, [id])

  if (!campaign) {
    return (
      <div className="py-10">
        <Container>
          <div className="h-48 animate-pulse border border-zinc-200 dark:border-zinc-800" />
        </Container>
      </div>
    )
  }

  return (
    <div className="py-10">
      <Container>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">{campaign.name}</h1>
            <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-500">{campaign.objective}</p>
            <div className="mt-3 border border-zinc-200 px-4 py-3 dark:border-zinc-800 max-w-xl">
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Core message</p>
              <p className="mt-1 text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{campaign.core_message}</p>
            </div>
          </div>
          <button
            type="button"
            title="Connect backend later"
            onClick={() => showToast("Export will work after backend is connected.", "info")}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
          >
            <DownloadSimple size={15} />
            Export all
          </button>
        </div>

        {/* Assets grid */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(campaign.assets ?? []).map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              palette={brand?.palette}
              fonts={brand?.fonts}
            />
          ))}
        </div>

        {/* Checklist */}
        <div className="mt-10 border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Asset checklist</p>
          </div>
          {(campaign.assets ?? []).map((asset, i) => (
            <div
              key={asset.id}
              className={`flex items-center justify-between gap-4 px-5 py-3 ${
                i > 0 ? "border-t border-zinc-100 dark:border-zinc-900" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${
                    asset.signal_verdict === "pass"
                      ? "bg-emerald-700 text-white"
                      : "border border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {asset.signal_verdict === "pass" && <Check size={11} weight="bold" />}
                </span>
                <span className="text-[14px] text-zinc-700 dark:text-zinc-300">{asset.label}</span>
              </div>
              {asset.signal_match == null ? (
                <span className="text-zinc-400 text-[11px]">Signal not checked</span>
              ) : (
                <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-600">{asset.signal_match}</span>
              )}
            </div>
          ))}
        </div>
      </Container>

      <Toast message={toast?.message} type={toast?.type} onClose={hideToast} />
    </div>
  )
}

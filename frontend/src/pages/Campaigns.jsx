// pages/Campaigns.jsx — list of campaigns, click to open detail
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "../components/Container"
import { mockApi } from "../lib/mockApi"

const STATUS_STYLE = {
  Ready: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
}

export function Campaigns() {
  const [campaigns, setCampaigns] = useState([])

  useEffect(() => {
    mockApi.getCampaigns().then(setCampaigns).catch(() => {})
  }, [])

  return (
    <div className="py-10">
      <Container>
        <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">Campaigns</h1>
        <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-500">{campaigns.length} campaigns</p>

        <div className="mt-8 border border-zinc-200 dark:border-zinc-800">
          {campaigns.length === 0 && (
            <p className="p-6 text-[15px] text-zinc-400 dark:text-zinc-600">No campaigns yet.</p>
          )}
          {campaigns.map((c, i) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                i > 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""
              }`}
            >
              <div>
                <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</p>
                <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-500">{c.date} · {c.assets?.length ?? 0} assets</p>
              </div>
              <span className={`rounded-sm px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLE[c.status] ?? STATUS_STYLE.Draft}`}>
                {c.status}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </div>
  )
}

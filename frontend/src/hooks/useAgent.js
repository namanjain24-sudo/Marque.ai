// hooks/useAgent.js — real agent run (P4). Calls POST /v1/brands/{id}/agent/run,
// which now classifies intent (create_campaign | brand_question | update_memory),
// does the matching thing, and returns a REAL trace of the steps that ran plus a
// natural-language `reply`. So the ask bar is a real router, not just "make a
// campaign": ask "what's our tone?" and it answers; say "never use neon" and it
// remembers.
//
// The price nudge is kept but only for a clear generation goal with no price.
// messages: conversation history of shape { role: "user"|"ai", content: string }
import { useCallback, useState } from 'react'
import { api } from '../lib/api'

// A clear "make me an asset" goal (so the price nudge only fires for those, and
// never blocks a question/memory message).
const GENERATION_INTENT = /\b(poster|post|story|whatsapp|campaign|launch|create|make|generate|run|ad|offer|promo|sale|combo|deal)\b/i

export function useAgent(brandId) {
  const [trace, setTrace] = useState([])
  const [running, setRunning] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [question, setQuestion] = useState(null)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  // "llm" when the orchestrator actually used the AI path, "heuristic" otherwise.
  const [source, setSource] = useState(null)

  const run = useCallback(
    async (message) => {
      setTrace([])
      setCampaign(null)
      setQuestion(null)
      setError(null)

      // Price nudge: only for a generation goal with no price. A question
      // ("what's our palette?") or a rule ("never use neon") must not be blocked.
      if (GENERATION_INTENT.test(message) && !/[₹\d]/.test(message)) {
        setQuestion('What price should I put on it?')
        return null
      }
      if (!brandId) {
        setError('No brand loaded yet.')
        return null
      }

      setMessages((prev) => [...prev, { role: 'user', content: message }])
      setRunning(true)
      try {
        const result = await api.agentRun(brandId, message)
        // Real trace from the backend (array of { label, ms }).
        setTrace(result.trace ?? [])
        setSource(result.source ?? null)

        // Route the result by the classified intent.
        if (result.intent === 'create_campaign' && result.campaign) {
          setCampaign(result.campaign)
        }
        // Every intent carries a human reply — show it in the chat.
        const reply =
          result.reply ||
          (result.campaign
            ? `Generated "${result.campaign.name}" — ${result.campaign.assets?.length ?? 0} assets`
            : 'Done.')
        setMessages((prev) => [...prev, { role: 'ai', content: reply }])
        return result
      } catch (err) {
        setError(err.message || 'Could not run that.')
        return null
      } finally {
        setRunning(false)
      }
    },
    [brandId],
  )

  return { run, trace, running, campaign, question, error, messages, source }
}

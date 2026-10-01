// hooks/useAgent.js — real agent run, same shape as useMockAgent so it's a
// drop-in. Calls POST /v1/brands/{id}/agent/run to generate a campaign.
//
// The trace is a derived step list for now (not a live stream) — a real
// streamed/SSE trace from a true orchestrator (F7) is a later item. The price
// nudge is kept: if the goal has no price, ask for one before running, matching
// the product's "it asks a clarifying question" behaviour.
//
// messages: conversation history of shape { role: "user"|"ai", content: string }
import { useCallback, useState } from 'react'
import { api } from '../lib/api'

const TRACE_STEPS = [
  'Loaded Brand Memory',
  'Planned 4 assets',
  'Wrote creative core',
  'Rendered poster',
  'Rendered Instagram post',
  'Rendered story',
  'Rendered WhatsApp creative',
  'Campaign ready for approval',
]

// Words that signal the user wants a new asset/campaign (vs. a read question
// like "what's our palette?"). The price nudge only makes sense for these.
const GENERATION_INTENT = /\b(poster|post|story|whatsapp|campaign|launch|create|make|generate|run|ad|offer|promo|sale|combo|deal)\b/i

export function useAgent(brandId) {
  const [trace, setTrace] = useState([])
  const [running, setRunning] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [question, setQuestion] = useState(null)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])

  const run = useCallback(
    async (message) => {
      setTrace([])
      setCampaign(null)
      setQuestion(null)
      setError(null)

      // Price nudge: only for generation-intent goals ("make a poster…") that
      // have no price. A read-style question ("what's our palette?") must NOT be
      // blocked for lacking a number.
      if (GENERATION_INTENT.test(message) && !/[₹\d]/.test(message)) {
        setQuestion('What price should I put on it?')
        return null
      }
      if (!brandId) {
        setError('No brand loaded yet.')
        return null
      }

      // Push user message immediately
      setMessages((prev) => [...prev, { role: 'user', content: message }])

      setRunning(true)
      try {
        const result = await api.agentRun(brandId, message)
        setCampaign(result)
        setTrace(TRACE_STEPS)
        // Push ai response
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            content: `Generated campaign "${result.name}" — ${result.assets?.length ?? 0} assets`,
          },
        ])
        return result
      } catch (err) {
        setError(err.message || 'Could not generate the campaign.')
        return null
      } finally {
        setRunning(false)
      }
    },
    [brandId],
  )

  return { run, trace, running, campaign, question, error, messages }
}

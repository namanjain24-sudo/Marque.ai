// hooks/useMockAgent.js — the only place that fakes the agent.
// Classifies intent with keyword checks, pushes trace events with setTimeout,
// then returns campaign.json for campaigns.
import { useCallback, useState } from 'react'
import { mockApi } from '../lib/mockApi'
import traceEvents from '../mock/trace.json'

const DELAY = 800 // ms between trace events

export function useMockAgent() {
  const [trace, setTrace] = useState([])
  const [running, setRunning] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [question, setQuestion] = useState(null)

  const run = useCallback(async (message) => {
    // Reset state
    setTrace([])
    setCampaign(null)
    setQuestion(null)
    setRunning(true)

    // Price check: if message has no price / ₹ / digits, ask for it
    const hasPrice = /[₹\d]/.test(message)
    if (!hasPrice) {
      await new Promise((res) => setTimeout(res, 600))
      setQuestion('What price should I put on it?')
      setRunning(false)
      return
    }

    // Stream trace events one by one
    for (let i = 0; i < traceEvents.length; i++) {
      await new Promise((res) => setTimeout(res, DELAY))
      setTrace((prev) => [...prev, traceEvents[i]])
    }

    // Fetch campaign result
    try {
      const result = await mockApi.agentRun(message)
      setCampaign(result)
    } catch {
      // silently fall through
    }

    setRunning(false)
  }, [])

  return { run, trace, running, campaign, question }
}

// hooks/useAutoFix.js — the F4 Signal Check auto-fix loop, browser side.
//
// The browser renders the asset (AssetPreview), so the loop lives here:
//   round 1: rasterize the live preview -> POST /signal-check
//   if needs_fix: apply the critic's fix knobs -> caller re-renders -> rasterize
//   round 2: POST /signal-check again (round=2)
//   stop at pass, or after round 2.
//
// The caller passes a getter for the current preview DOM node and a setter to
// apply new knobs (so the real <AssetPreview> re-renders with them before we
// capture round 2). This keeps the hook agnostic of the component tree.
import { useCallback, useRef, useState } from 'react'
import { api } from '../lib/api'
import { rasterize } from '../lib/rasterize'
import { applyFix } from '../lib/signal'

// Let React paint the re-rendered preview before we rasterize it.
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

export function useAutoFix(brandId) {
  const [rounds, setRounds] = useState([]) // [{ round, result }]
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const cancelled = useRef(false)

  const reset = useCallback(() => {
    setRounds([])
    setError(null)
  }, [])

  /**
   * run({ getNode, applyKnobs, knobs })
   *  - getNode(): returns the current preview DOM node to rasterize
   *  - applyKnobs(nextKnobs): updates the live preview's knobs (round 2 render)
   *  - knobs: the asset's current knobs (starting point)
   * Returns the final SignalResult (last round).
   */
  const run = useCallback(
    async ({ getNode, applyKnobs, knobs }) => {
      if (!brandId) {
        setError('No brand loaded yet.')
        return null
      }
      cancelled.current = false
      setRunning(true)
      setError(null)
      setRounds([])

      try {
        // Round 1
        const png1 = await rasterize(getNode(), { name: 'round1.png' })
        const r1 = await api.checkSignal(brandId, png1, 1)
        if (cancelled.current) return null
        setRounds([{ round: 1, result: r1 }])

        if (r1.verdict === 'pass') return r1

        // Revise: apply the critic's suggested knobs, re-render, re-check.
        const fixedKnobs = applyFix(knobs, r1.fix)
        applyKnobs(fixedKnobs)
        await nextFrame()
        if (cancelled.current) return null

        const png2 = await rasterize(getNode(), { name: 'round2.png' })
        const r2 = await api.checkSignal(brandId, png2, 2)
        if (cancelled.current) return null
        setRounds([
          { round: 1, result: r1 },
          { round: 2, result: r2 },
        ])
        return r2
      } catch (err) {
        if (!cancelled.current) setError(err.message || 'Signal check failed.')
        return null
      } finally {
        if (!cancelled.current) setRunning(false)
      }
    },
    [brandId],
  )

  const cancel = useCallback(() => {
    cancelled.current = true
    setRunning(false)
  }, [])

  return { run, rounds, running, error, reset, cancel }
}

// lib/signal.js — pure frontend signal score computation
// match = 100 - average(|gap|)
// pass if match >= 80 AND no single gap > 20

/**
 * computeMatch(target, detected)
 * target and detected: { premium, modern, playful, niche }
 * Returns { match, verdict, gaps }
 */
export function computeMatch(target, detected) {
  const axes = ['premium', 'modern', 'playful', 'niche']
  const gaps = {}
  let totalGap = 0

  for (const axis of axes) {
    const gap = (detected[axis] ?? 0) - (target[axis] ?? 0)
    gaps[axis] = gap
    totalGap += Math.abs(gap)
  }

  const match = Math.round(100 - totalGap / axes.length)
  const maxGap = Math.max(...Object.values(gaps).map(Math.abs))
  const verdict = match >= 80 && maxGap <= 20 ? 'pass' : 'needs_fix'

  return { match, verdict, gaps }
}

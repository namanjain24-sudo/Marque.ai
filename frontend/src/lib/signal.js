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

// Clamp ranges — must match backend knobs.py / AssetPreview.
const ACCENT_RANGE = [0, 1]
const OVERLAY_RANGE = [0, 0.8]

/**
 * applyFix(currentKnobs, fix)
 * Merge the critic's sparse suggested knobs over an asset's current knobs,
 * returning a new object. Mirrors backend vision.apply_fix_knobs so the auto-fix
 * loop can re-render round 2 in the browser without a round-trip. Only knobs the
 * critic actually set (non-null) are changed; floats are clamped.
 */
export function applyFix(currentKnobs, fix) {
  const next = { ...currentKnobs }
  if (!fix) return next
  for (const [key, value] of Object.entries(fix)) {
    if (value === null || value === undefined) continue
    if (key === 'accent_usage') {
      next[key] = Math.max(ACCENT_RANGE[0], Math.min(ACCENT_RANGE[1], value))
    } else if (key === 'overlay') {
      next[key] = Math.max(OVERLAY_RANGE[0], Math.min(OVERLAY_RANGE[1], value))
    } else {
      next[key] = value
    }
  }
  return next
}

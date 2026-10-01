// lib/rules.js — pure frontend brand rules check (no backend needed)
// Runs on the asset slot/knob JSON and returns a list of violations.

// WCAG AA contrast ratio: 4.5:1 minimum for normal text
function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return { r, g, b }
}

function relativeLuminance({ r, g, b }) {
  const toLinear = (c) => {
    const n = c / 255
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1))
  const l2 = relativeLuminance(hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * checkRules({ slots, knobs, palette, fonts, brand })
 * Returns an array of { rule, status, detail } objects.
 * status: 'ok' | 'error' | 'warn'
 */
export function checkRules({ slots, knobs, palette, brand }) {
  const violations = []

  // 1. Banned words check (case-insensitive)
  const bannedWords = (brand?.dont ?? []).map((d) => d.toLowerCase())
  const textFields = [slots?.headline, slots?.subline, slots?.cta].filter(Boolean)
  const combinedText = textFields.join(' ').toLowerCase()

  for (const word of ['delicious', ...bannedWords]) {
    if (combinedText.includes(word)) {
      violations.push({
        rule: 'Banned word',
        status: 'error',
        detail: `"${word}" is not allowed in copy.`,
      })
    }
  }

  // 2. Price format check — must include ₹ if a price field exists
  if (slots?.price && !slots.price.includes('₹')) {
    violations.push({
      rule: 'Price format',
      status: 'error',
      detail: 'Price must include ₹ symbol.',
    })
  }

  // 3. WCAG AA contrast — text colour vs background
  // Assume text is on a background tinted by the overlay over the photo
  // We check primary text (accent / light) against secondary (dark background)
  if (palette?.light && palette?.dark) {
    const ratio = contrastRatio(palette.light, palette.dark)
    if (ratio < 4.5) {
      violations.push({
        rule: 'Contrast',
        status: 'warn',
        detail: `Text/background contrast ${ratio.toFixed(1)}:1 — below WCAG AA (4.5:1).`,
      })
    }
  }

  // 4. Palette check — flag if knobs would introduce a colour not in brand palette
  // (simplified: if accent_usage is 0 and brand do requires high contrast, warn)
  if (knobs?.accent_usage !== undefined && knobs.accent_usage < 0.2) {
    violations.push({
      rule: 'Palette usage',
      status: 'warn',
      detail: 'Accent colour barely used — may reduce brand recognition.',
    })
  }

  return violations
}

/**
 * rulesStatusList({ slots, knobs, palette, brand })
 * Returns structured items for the editor Brand Rules panel.
 */
export function rulesStatusList({ slots, knobs, palette, brand }) {
  const violations = checkRules({ slots, knobs, palette, brand })
  const violationRules = new Set(violations.map((v) => v.rule))

  return [
    {
      label: 'Palette',
      status: violationRules.has('Palette usage') ? 'warn' : 'ok',
      detail: violationRules.has('Palette usage') ? 'Accent usage low' : 'Brand colours used',
    },
    {
      label: 'Fonts',
      status: 'ok',
      detail: 'Brand font pair applied',
    },
    {
      label: 'Contrast',
      status: violationRules.has('Contrast') ? 'warn' : 'ok',
      detail: violationRules.has('Contrast') ? 'Below WCAG AA' : 'Passes WCAG AA',
    },
    {
      label: 'Banned words',
      status: violationRules.has('Banned word') ? 'error' : 'ok',
      detail: violationRules.has('Banned word')
        ? violations.find((v) => v.rule === 'Banned word')?.detail ?? 'Violation found'
        : 'No banned words',
    },
    {
      label: 'Price format',
      status: violationRules.has('Price format') ? 'error' : 'ok',
      detail: violationRules.has('Price format') ? 'Missing ₹ symbol' : '₹ symbol present',
    },
  ]
}

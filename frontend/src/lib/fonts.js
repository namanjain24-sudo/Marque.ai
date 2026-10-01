// The 5 identity templates in backend/identity.py draw from 8 curated Google
// Fonts, self-hosted via @fontsource rather than a runtime <link> tag. These
// are previewing a *brand's* generated identity, not Marque.ai's own UI
// typeface (see index.css for that), so they're loaded on demand instead of
// bundled into the main chunk.
const LOADERS = {
  "Bebas Neue": () => import("@fontsource/bebas-neue/400.css"),
  Inter: () => Promise.all([import("@fontsource/inter/400.css"), import("@fontsource/inter/600.css")]),
  "Playfair Display": () =>
    Promise.all([
      import("@fontsource/playfair-display/500.css"),
      import("@fontsource/playfair-display/700.css"),
    ]),
  "Work Sans": () =>
    Promise.all([import("@fontsource/work-sans/400.css"), import("@fontsource/work-sans/500.css")]),
  Poppins: () => Promise.all([import("@fontsource/poppins/500.css"), import("@fontsource/poppins/700.css")]),
  "DM Sans": () => Promise.all([import("@fontsource/dm-sans/400.css"), import("@fontsource/dm-sans/500.css")]),
  "Space Grotesk": () =>
    Promise.all([import("@fontsource/space-grotesk/500.css"), import("@fontsource/space-grotesk/700.css")]),
  Fraunces: () => Promise.all([import("@fontsource/fraunces/500.css"), import("@fontsource/fraunces/700.css")]),
}

const loaded = new Set()

export function loadBrandFont(family) {
  if (!family || loaded.has(family) || !LOADERS[family]) return
  loaded.add(family)
  LOADERS[family]().catch(() => loaded.delete(family))
}

export function loadBrandFonts(fonts) {
  if (!fonts) return
  loadBrandFont(fonts.heading)
  loadBrandFont(fonts.body)
}

// PROGRESS.md flagged this directly: "GET /identity returns things like
// key: 'modern_minimal' — fine for a frontend to switch on, but it reads as
// a raw slug, not something to show a user directly." This is that mapping.
export const DIRECTION_LABELS = {
  bold_premium: { name: "Bold & Premium", description: "High contrast, confident, built to stand out." },
  elegant_classic: { name: "Elegant & Classic", description: "Serif-led, refined, built to feel established." },
  playful_bright: { name: "Playful & Bright", description: "Warm and energetic, built to feel approachable." },
  modern_minimal: { name: "Modern & Minimal", description: "Clean geometry, built to feel sharp and current." },
  earthy_niche: { name: "Earthy & Niche", description: "Artisanal and grounded, built to feel specialist." },
}

export function directionLabel(key) {
  return DIRECTION_LABELS[key] ?? { name: key, description: "" }
}

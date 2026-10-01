// Static mirror of the seeded demo brand (backend/seed.py) and its real F3
// identity proposals (backend/identity.py). Used so the homepage paints
// immediately with real product data instead of a loading skeleton; Home.jsx
// then fetches the live brand in the background and swaps it in silently if
// it differs (e.g. someone has actually edited the demo brand via the API).
export const DEMO_BRAND_ID = "brand_burgerlab"

export const demoProfile = {
  id: DEMO_BRAND_ID,
  name: "Burger Lab",
  category: "Restaurant, Burgers",
  city: "Delhi",
  audience: "18-30, urban, food-conscious",
  price_level: 2,
  positioning: { premium: 70, modern: 80, playful: 75, niche: 55 },
  personality: ["bold", "playful", "experimental"],
  palette: {
    primary: "#E63946",
    secondary: "#111111",
    accent: "#F1FAEE",
    light: "#FFFFFF",
    dark: "#0B0B0B",
  },
  fonts: { heading: "Bebas Neue", body: "Inter" },
  voice: { language: "Hinglish", tone: "short, cheeky, no corporate words" },
  meaning: { black: "confidence", red: "energy", "tight type": "modern" },
  do: ["product close-ups", "high contrast", "price in a badge"],
  dont: ["stock photos", "neon gradients", "corporate tone", "the word delicious"],
}

// The 2 directions F3 actually proposes for Burger Lab's positioning
// (verified by hand against propose_identity's distance ranking).
export const demoDirections = [
  {
    key: "bold_premium",
    palette: { primary: "#E63946", secondary: "#111111", accent: "#F1FAEE", light: "#FFFFFF", dark: "#0B0B0B" },
    fonts: { heading: "Bebas Neue", body: "Inter" },
    meaning: {
      "red primary": "energy and appetite",
      "near-black background": "premium, confident",
      "condensed display headline": "bold, modern",
    },
  },
  {
    key: "modern_minimal",
    palette: { primary: "#2B2D42", secondary: "#8D99AE", accent: "#EF233C", light: "#EDF2F4", dark: "#121212" },
    fonts: { heading: "Space Grotesk", body: "Inter" },
    meaning: {
      "muted blue-grey": "modern, minimal",
      "geometric headline": "clean, confident",
      "red accent": "sharp focus",
    },
  },
]

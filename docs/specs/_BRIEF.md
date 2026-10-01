# Shared Brief — read this first (all agents)

**Product:** Marque.ai — a **conversation-first AI brand platform** for businesses (esp. Indian
local businesses: restaurants, cafés, shops). The user mostly *talks to an AI* that builds their
brand, creates assets, and runs campaigns. Modules (editor, library, dashboards) are where the
AI's results land and get refined — the chat is the primary driver, not a side panel.

**This is for winning a hackathon.** Spec the full vision, but always mark the **thin P0 slice**
that a solo dev + Claude can build in ~12h and demo convincingly. Honesty over hype.

## The 5 pillars (the real product)

1. **Brand Builder** — Capture (business details), Brand Identity (logo, palette, typography,
   photography/illustration style, iconography, graphic elements, layout principles), Brand
   Signaling (4 perception axes: premium↔affordable, traditional↔modern, serious↔playful,
   mass↔niche; evaluate assets against them → score/problems/recommendations), Brand Memory
   (persistent Visual/Voice/Positioning/Do-Don't rules injected into *every* generation).
2. **Asset Creator** — ONE generic engine, not per-type workflows. Flow: Brief → Concept →
   Generate (3-4 directions) → Edit → Brand Check → Export. Universal editor (canvas, layers,
   text/image/shapes, resize, AI edit, undo/redo, version history) — generated assets stay
   editable. Generic Asset Schema (type/size/content/brand-context/components/images/text/
   layout/version/campaign); poster/deck/merch/menu/social = templates on one engine.
3. **Brand Manager / Dashboard** — overview + Asset Library (everything auto-lands here; search,
   filters, folders, tags, by type/campaign/product/version; archive/duplicate/edit/download).
4. **Campaign Manager** — campaigns are first-class. Brand → Campaign → Assets → (performance
   later). List (name/count/status), detail (objective, brand direction, asset checklist).
5. **AI Layer** — conversational assistant over all modules. P0: chat UI, brand+workspace
   context, read actions across modules, asset gen/edit actions, history, confirmation for
   consequential actions. P1: multi-step planning, campaign orchestration, progress/error
   recovery. P2: brand-aware eval, retrieval, recommendations, preference learning.

## Hard constraints (reality)

- **AI stubbed/off by default to save credits.** Every AI feature must work *first try* when the
  key flips on. Template = `backend/vision.py`: strict Pydantic output schema, `response_format:
  json_object`, parse→validate→retry-once, temp 0, LLM for judgment only (never arithmetic),
  typed errors, auto-switch (key present → LLM, else heuristic fallback), mocked tests (zero credit).
- **Text is never drawn by an image model** — image model makes backgrounds/hero only; text/logo
  are HTML/CSS layers (editable, correct spelling).
- **Solo dev + Claude, ~12h for the P0.** Postgres + FastAPI (async) + React/Vite + Tailwind,
  dockerized, live on an Azure VM (1 vCPU / 2GB RAM — heavy things like headless Chromium are risky).

## What already exists (verified)

- Backend: F1 onboarding, F2 memory (CRUD + rules, row-locked), F3 identity (5 curated templates,
  nearest-of-5), F4 Signal Check (REAL vision LLM, well-built — the crown jewel), heuristic
  "campaign" generator (regex, not a real agent). Schemas in `backend/schemas.py`. 91 pytest tests.
- Frontend scaffold (React Router): pages exist for Home, Onboard, Brands, BrandDashboard, Brand,
  Workspace (3-col chat+results+trace), Campaigns, CampaignDetail, Editor, Library, Audit.
  Mostly mock/partial. `AssetPreview.jsx` renders a CSS gradient + text (no real image).
- CUT by owner: the F4 auto-fix loop (generate→score→revise→re-render). Signal Check stays manual.
- Demo brand: "Burger Lab" (premium-casual Delhi burger place) seeded.

## Running example for concrete UX

Use **Burger Lab** and the goal **"Create a launch poster for our new truffle burger at ₹399"**
whenever you need a concrete scenario. Make UX concrete, not abstract.

## Output rules for agents

Return **dense, specific, usable** content — real flows, real screen states, real schema fields,
real acceptance criteria. No filler, no "it depends," no restating this brief. If you're a
pillar/UX agent, think hard about the *conversation-first* experience: what the user *says*, what
the AI *does*, what appears on screen, and the empty/loading/error/confirmation states.

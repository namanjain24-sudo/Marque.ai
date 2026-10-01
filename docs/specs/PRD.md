# Marque.ai — Product Requirements Document

**Status:** P0 hackathon build · Solo dev + Claude · ~12h build window  
**Demo brand:** Burger Lab (premium-casual Delhi burger restaurant, seeded in DB)  
**Canonical demo goal:** "Create a launch poster for our new truffle burger at ₹399"

---

## 1. Summary — The One Winning Idea

Indian local businesses (restaurants, cafés, shops) have brand assets that look generic, inconsistent, and amateur — not because they lack taste, but because every tool forces them to fill forms, pick templates, and learn design software. Marque.ai replaces that with a single idea: **talk to a chat bar and your brand does the work**.

The user says "launch our truffle burger at ₹399 this weekend." The AI reads their brand memory (palette, voice, rules, products), generates a 4-format campaign with real on-brand copy, scores each asset against the brand's positioning targets, and surfaces the results — all without the user touching a single slider or template. The modules (Brand, Campaigns, Library, Editor) are where results land and get refined; the conversation is where work happens.

The claim that wins the hackathon: **"It reads your brand and writes real, on-brand copy. It checks what your customer will feel and scores it. It never invents offers."** These three are independently demonstrable in under 3 minutes.

---

## 2. Problem & Users

### The problem

Small business owners in India who want to market consistently face three unsolved frictions:

1. **No brand memory.** Every tool starts blank. The owner re-explains their brand for every asset. Canva doesn't know Burger Lab is premium, not casual, or that "fresh ingredients" is off-brand.

2. **Generic output.** Template-based tools produce assets that look like every other restaurant. The owner can't describe "what's wrong" — they just know it looks cheap.

3. **Disconnected asset creation.** Even if one asset is good, the next one drifts. There is no feedback loop between "how does this asset feel" and "is that the feeling we want to project."

### Primary user

A single operator: the restaurant owner, café manager, or shop owner who handles their own marketing. Not a designer. Not a brand strategist. English + Hindi comfortable. Has a phone, possibly a laptop. Price-sensitive. Decides fast if the first demo output is good.

Secondary user (judge / investor): needs to see intelligence, not just a prettier Canva. The differentiator is that the AI knows the brand and enforces it — something no static template tool can do.

### The current gap

Existing tools: Canva (templates, no brand intelligence), Looka (logo only), Adobe Express (too complex), ChatGPT (no visual output). None connect a brand's positioning targets to asset evaluation. Signal Check (F4 — already built) is the unique moat: it scores a real uploaded asset against a brand's four perception axes using a vision LLM. Nothing else in the market does this for small businesses.

---

## 3. The Conversation-First Solution

### The governing principle

The chat is not a command line. It is the workspace itself. Every module is where AI results land, not where work happens. The user never opens a form to create; they talk, and the output appears.

The `/workspace` page is the primary surface. It is a 3-column layout:
- **Left (25%):** conversation history + pinned AskBar
- **Centre (flex-1):** live results pane — whatever the last AI action produced
- **Right (25%):** TracePanel — what the AI used to get there (brand memory, rules, positioning targets)

The user types one goal. The AI reads `BrandProfile` (palette, voice, do/dont rules, products, positioning), generates a campaign with real copy and CSS-rendered previews, and fills the centre pane. The chat only holds typed goals and one-line AI status blocks — never long prose, never "I have analyzed your request."

### The 8 UX principles (non-negotiable)

**1. Act immediately on generation; confirm only before BrandProfile writes.**
`AssetOut` and `CampaignOut` generation = no modal, no confirmation. `BrandMemoryPatch` and `IdentityApply` = show a diff card, one click to apply. This rule is enforced at the router level: the action type determines the confirmation path, not the developer's judgment at implementation time.

**2. Every AI action produces a visible artifact, never just text.**
`generate` → `CampaignOut` renders in the centre pane. `read` → `BrandCard` renders. `evaluate` → `SignalCard` renders. `memory_append` → `MemoryDiffCard` renders. The chat column only holds typed turns; the results column holds the output. A chatbot that says "I updated your palette" with no visible change is indistinguishable from a hallucination.

**3. Stream content, not process narration.**
What can stream: evidence items from `VisionCriticResponse`, core message being assembled, headline slot being named. What never appears: "Please wait while I generate," "I am thinking," "Based on your request." The TracePanel streams real facts about what the code actually did — not theater.

**4. Brand Memory is always visible when context is active.**
The right column TracePanel shows, for every generation: palette swatches, voice tone, up to 3 do rules, up to 3 dont rules, positioning targets, and `dna_source` if heuristic. If any field is null, the trace shows a "Brand profile incomplete" warning. The user always knows what the AI had available.

**5. Edits happen in-place on artifacts, not back in chat.**
Every `AssetCard` has contenteditable slots (headline, subline, price, cta). Knob sliders (density, overlay, layout_variant) are accessible on hover. These fire local state only — no API call. "Re-check signal" sends the locally-modified asset through Signal Check. "Regenerate with AI" sends modified `AssetKnobs` back to the agent. The chat is for new goals, not property tweaks.

**6. One required input per turn, never a form disguised as conversation.**
If the AI must ask, it asks one question. If `BrandProfile` has enough context to proceed (palette set, products listed, price in the goal), it does not ask at all. For Burger Lab + "truffle burger at ₹399": the agent has everything it needs. The only ask: price is missing AND product is not in the products list AND there are no recent similar assets. Then: one question, one text input, pre-filled with the average of existing product prices.

**7. Consequential confirmations show a diff, not a warning.**
"Are you sure?" is never shown. A diff card showing current vs proposed state is shown. The Apply button only appears after the user has seen the diff. For single-field changes (voice.tone), the confirm block is inline in the chat column. For multi-field changes (identity apply: palette + fonts + meaning), the diff card occupies the centre pane.

**8. Break broken work loudly. Never silently degrade.**
`OPENROUTER_API_KEY` absent → `dna_source: "heuristic"` badge in the trace: "Brand DNA: heuristic fallback — AI key not configured." Signal Check with no key → `SignalResult` with `match=50, verdict="needs_fix", issue="heuristic fallback — AI key not configured"` — rendered as a valid result with an amber badge, not a 503 error. `signal_match: null` on any `AssetOut` → "Signal not checked" badge, never empty space.

---

## 4. The 5 Pillars

### 4.1 Brand Builder

**What it is:** A four-stage progressive enrichment of `BrandProfile`. Not a wizard users complete once — a living object the AI updates over time through conversation. The four stages: Capture (who the business is), Identity (how it looks), Signaling (whether assets match the target), Memory (rules that govern every future generation).

**Why it exists:** Without brand memory, every generated asset is generic. Signal Check without positioning targets is meaningless. Memory without injection into generation is inert. The Brand Builder is what connects the AI's output quality to the user's actual brand.

**How the AI is involved:**
- Capture (F1): Deterministic. `brand_dna.py` runs `propose_positioning(personality, price_level)`, `propose_do_dont(price_level)`, `propose_tone(personality)`. Seeds `BrandProfile` on creation. Always works offline. No credits.
- Identity (F3): Deterministic. `identity.py` runs nearest-2 cosine on 5 curated templates against `positioning` targets. Returns two `IdentityDirection` objects. Always works offline. No credits.
- Signaling (F4): Real vision LLM (`check_signals` in `vision.py`). Auto-switch: key present → LLM, else `SignalResult` with `match=50` heuristic. See §6.
- Memory: No LLM for CRUD. P1: agent classifies memory intent from chat and calls `POST /v1/brands/{id}/memory/rules`.

**Acceptance criteria (P0):**
- `/brand` page shows editable Products section (add/remove rows, save via `patchMemory`)
- Clicking any palette swatch opens native color picker, fires `patchMemory` on close
- `voice.tone` is an editable text input, auto-saves on blur
- Preferences `ChipList` visible below Do/Don't, saves via `patchMemory`
- Last audit chip in right column of `/brand` (from `api.listAudits(brandId)`)
- `VisionNotConfiguredError` returns `SignalResult(match=50)` not HTTP 503
- `dont` rules injected into `asset_gen._headline()` — headline never contains any dont-rule word; fallback to `brand.name`
- `BrandProfile.version` increments on every write; `BrandEditorInner` remounts via `key={brand.id}:${brand.version}`

---

### 4.2 Asset Creator

**What it is:** One generic generation engine that outputs `AssetOut` objects (poster, Instagram post, story, WhatsApp creative) from a single `AgentRunIn.goal`. Not per-type workflows. Assets rendered in CSS (`AssetPreview.jsx`) — text is HTML layers, not baked into an image. The canvas editor (`/editor/:assetId`) allows direct slot editing and knob adjustment.

**Why it exists:** The demo output must look designed. A CSS-rendered gradient with bold typography and real brand colors, correct price, and on-brand copy looks vastly better than a generic template with "Explore our menu!" copy. The browser rendering also sidesteps the Azure VM's inability to run headless Chromium.

**How the AI is involved:**
- P0: `asset_gen.py` — deterministic heuristic. Regex-extracts price, generates slots from brand name + goal. Not an LLM. Labeled as "heuristic fallback" in the codebase and trace.
- P2: One LLM call replacing the heuristic. Takes `goal + full BrandProfile (voice, do, dont, positioning, products)` and returns structured `AssetSlots` (headline, subline, price, cta). **Facts rule enforced in Python, not the LLM:** price/discount/dates come only from the owner's words; if no price given, a placeholder — the model never invents an offer. Same output schema so renderer doesn't change.
- `AssetPreview.jsx` always takes `palette` and `fonts` from `useBrand()` context, never from a static mock import. This is the Amnesia Loop bug — the fix is a prop-passing change.

**Acceptance criteria (P0):**
- `POST /v1/brands/{id}/agent/run` → `CampaignOut` with 4 `AssetOut` objects
- Each `AssetOut` has `slots` (headline, subline, price, cta, logo), `knobs` (density, font_style, photo_tone, accent_usage, overlay, layout_variant)
- `AssetPreview` renders using live `BrandProfile.palette` and `BrandProfile.fonts` from context — not mock data
- `signal_match: null` on all freshly-generated assets renders "Signal not checked" badge
- `[Re-check signal]` on hover fires inline Signal Check without chat message
- `/editor/:assetId` loads the asset and renders the preview; slot text is editable inline

---

### 4.3 Brand Manager / Asset Library

**What it is:** Everything the AI generates auto-lands in the Library. `LibraryAsset` records are created on generation and on upload-through-Signal-Check. The `/library` page provides search, filter by type/campaign/status, and links back to the editor.

**Why it exists:** The demo must never be empty. A user who generates a campaign needs to find it again. The Library is where the brand's creative history lives. Without it, every session starts blank — the product feels like a toy.

**How the AI is involved:** None at P0. The Library is pure read/filter. P1: "Find my best-performing poster" would trigger a search action, but that's retrieval, not generation.

**Acceptance criteria (P0):**
- `GET /v1/brands/{id}/campaigns` returns all campaigns with asset counts
- `GET /v1/campaigns/{id}` returns full `CampaignOut` with assets
- Library page renders the campaign list; clicking through shows the detail view
- Every generated campaign persists and is retrievable; no dead screens after generation

---

### 4.4 Campaign Manager

**What it is:** Campaigns are first-class objects. Each `CampaignOut` has: `id`, `name`, `objective`, `core_message`, `status`, `date`, `assets[]`. The `/campaigns` list shows all campaigns for the brand. `/campaigns/:id` shows the detail with the full asset grid, objective, core message, and individual asset status.

**Why it exists:** The agent's output needs a home that persists. Campaigns give the owner a way to track what was made, review it, and return to edit. The campaign name (e.g. "Truffle Burger Launch") is the organizing unit — not individual assets.

**How the AI is involved:**
- `core_message` is currently generated heuristically ("Launch our truffle burger. ₹399. Limited time."). P2: LLM-generated, brand-voice-aware.
- `objective` is heuristically assembled from the goal string. P2: LLM classification.

**Acceptance criteria (P0):**
- Campaign list page shows all campaigns for the active brand: name, asset count, status, date
- Campaign detail shows objective, core message box, asset grid with `AssetCard` components
- `AssetCard` shows: `AssetPreview` with live brand palette/fonts, label, size, signal badge, Edit link, Re-check button
- Status chip: "Draft" on creation; no status-change workflow required at P0

---

### 4.5 AI Layer

**What it is:** The conversational orchestrator over all modules. P0: a single `POST /v1/brands/{id}/agent/run` endpoint that takes a plain-language `goal` and returns a `CampaignOut`. The intent is always "generate campaign" at P0. P1: intent classification routes to brand read, memory append, or campaign generation based on the goal. P2: multi-step planning, memory-aware recommendations, preference learning.

**Why it exists:** The AI layer is what makes Marque.ai a platform rather than a tool. The same chat bar that generates a campaign today will add a brand rule tomorrow, answer "what are our do rules?", and evaluate a competitor's poster next week. The architecture must support this expansion without rewiring the frontend.

**How the AI is involved:**
- P0: deterministic routing — all goals go to `generate_campaign`. No intent classifier. Honest label in trace.
- P1: one LLM call classifies intent → `create_campaign | brand_question | update_memory`. Routes to the appropriate existing endpoint. Same `AgentRunIn` schema.
- P2: multi-step planning, brand-aware evaluation, preference learning from user edits.

**Acceptance criteria (P0):**
- `AgentRunIn.goal` (1-500 chars) → `CampaignOut` in response body
- Heuristic: price extracted from goal if present; `AssetSlots` seeded from brand name + goal
- `dont` rules from `BrandProfile.dont` checked against generated headline; fallback to `brand.name` if any dont word found
- TracePanel populated with: brand memory loaded, palette, dont rules applied, voice, positioning target, assets generated, campaign ready
- Error handling: if `generate_campaign` throws, return structured error with message, not a 500

---

## 5. AI Layer — P0 / P1 / P2

### P0 (build now, demo-safe, deterministic)

| Feature | Implementation | AI involved |
|---|---|---|
| Campaign generation | `asset_gen.generate_campaign` — regex + brand name | No — heuristic fallback |
| Brand DNA (positioning, do/dont, tone) | `brand_dna.propose_*` — lookup tables | No — deterministic |
| Identity directions | `identity.propose_identity` — nearest-5 cosine | No — deterministic |
| Signal Check | `vision.py` — real vision LLM, auto-switch | Yes, with heuristic fallback |
| Brand audit | `audit.py` — real vision LLM, auto-switch | Yes, with heuristic fallback |
| Memory CRUD | `PATCH /memory`, `POST /memory/rules` | No |
| TracePanel | CSS stagger animation of pre-defined steps | No — honest but theater |

### P1 (next sprint, key flipped on)

| Feature | Implementation | Notes |
|---|---|---|
| LLM Brand DNA | `brand_dna.propose_dna_llm(profile)` — one LLM call | Replaces lookup tables; same output schema; zero-credit mocked tests |
| LLM copywriter | `asset_gen.generate_slots_llm(goal, profile)` — one LLM call | Returns structured `AssetSlots`; facts rule enforced in Python; heuristic fallback |
| Intent classifier | `agent.classify_intent(goal)` — one LLM call | Routes `create_campaign | brand_question | update_memory` |
| Real trace | Server emits trace events with actual steps | Stream via SSE or return trace array with response |
| Memory from chat | Agent classifies `MemoryRuleAppend` intent and calls the existing endpoint | Requires intent classifier |

### P2 (future)

- Multi-step planning: agent breaks a complex goal into sub-tasks, executes sequentially with progress
- Brand-URL DNA: `GET /capture/suggest?url=<website>` scrapes and proposes `BrandMemoryPatch`
- Preference learning: agent observes which generated assets the user edits, updates positioning weights
- Brand completeness scoring: LLM evaluates `BrandProfile` completeness, suggests what to fill in
- Photo style guidance: if `photo_style` is set, pass it to a future image-gen endpoint as a style prompt

---

## 6. Data Model

### BrandProfile (the Brand Memory contract)

All fields in `backend/schemas.py`. The fields that matter for generation quality:

```
name, category, city, audience, price_level      — capture
products: list[ProductIn]                         — menu/inventory
positioning: Positioning                          — 4-axis target (0-100 each)
personality: list[WordStr]                        — up to 20 words
palette: Palette | None                           — hex colors, null until identity applied
fonts: Fonts | None                               — heading/body, null until identity applied
voice: Voice                                      — language + tone
do: list[RuleStr]                                 — generation do rules
dont: list[RuleStr]                               — generation don't rules (enforced in _headline())
preferences: list[RuleStr]                        — style notes
meaning: dict[str,str]                            — set by identity apply, visual semantics
photo_style: ShortStr | None                      — photography/illustration guidance
version: int                                      — increments on every write
```

**Version contract:** every `PATCH /memory` and `POST /identity/apply` increments `version`. The frontend's `BrandEditorInner` uses `key={brand.id}:${brand.version}` to remount and re-seed local state on version change. Any write from the chat that calls `setBrand(updated)` will discard unsaved dirty state in the Brand.jsx form — this is by design.

### CampaignOut / AssetOut

```
CampaignOut:
  id, name, objective, core_message, status, date
  assets: list[AssetOut]

AssetOut:
  id
  type: "poster" | "post" | "story" | "whatsapp"
  label, size
  signal_match: int | None           — null until checked
  signal_verdict: "pass" | "needs_fix" | None
  slots: AssetSlots                  — headline, subline, price, cta, logo, hero_image
  knobs: AssetKnobs                  — density, font_style, photo_tone, accent_usage, overlay, layout_variant
```

**Knob vocabulary** (from `knobs.py`, drives `AssetPreview.jsx`):
- `density`: "airy" | "balanced" | "dense"
- `font_style`: "display_bold" | "serif_elegant" | "minimal_sans"
- `photo_tone`: "warm" | "cool" | "moody" | "bright"
- `layout_variant`: "left" | "center" | "right"
- `accent_usage`: 0.0–1.0
- `overlay`: 0.0–0.8

### SignalResult

```
round: 1 | 2
detected: Positioning          — LLM-reported (or brand.positioning if heuristic)
target: Positioning            — always brand.positioning
gaps: SignalGaps               — detected - target per axis, signed
match: int (0-100)             — computed in Python, never taken from LLM
verdict: "pass" | "needs_fix"
issue: str                     — LLM issue string, or "heuristic fallback" if no key
evidence: list[str]            — up to 5 items
fix: FixKnobs                  — suggested style knob delta
```

### LibraryAsset

Assets persist on two paths: (1) every `AssetOut` from `generate_campaign` creates a `LibraryAsset(source="rendered")`; (2) every image uploaded through Signal Check creates a `LibraryAsset(source="upload")`. The rendered variant carries `slots` and `knobs` for `AssetPreview`; the upload variant carries `png_url`.

---

## 7. Reliability & The AI Seam

### The pattern (from vision.py — the crown jewel)

Every LLM call in Marque.ai follows the same contract:

1. **Strict Pydantic output schema.** The LLM is given a JSON schema and instructed to return only valid JSON matching it. `response_format: json_object` where supported.
2. **Parse → validate → retry once.** If the first response fails Pydantic validation, the raw JSON is fed back with the error and the LLM retries once. If round 2 fails, fall back to heuristic — never crash.
3. **Temperature 0.** For judgment calls (is this poster premium?), not arithmetic. The LLM never does math — all scores (`match`, `consistency_score`, `gaps`) are computed in Python from the LLM's structured output.
4. **Typed errors.** `VisionNotConfiguredError`, `VisionAPIError`, `VisionParseError` — each has a specific handler. No bare `except Exception`.
5. **Auto-switch.** Key present → LLM. Else → heuristic fallback. Same output schema for both. Zero test credits.
6. **Mocked tests.** All LLM paths have corresponding tests that mock the HTTP call and assert against the heuristic fallback. Zero credits in CI.

### The seam table

| Feature | Key absent | Key present |
|---|---|---|
| Brand DNA (F1) | `propose_positioning`, `propose_do_dont`, `propose_tone` — lookup tables | P1: LLM call, same output |
| Identity (F3) | `propose_identity` — nearest-cosine of 5 templates | No LLM needed |
| Signal Check (F4) | `SignalResult(match=50, issue="heuristic fallback…")` — never 503 | Real vision LLM, `VisionCriticResponse` |
| Brand Audit (F10) | `AuditReport(consistency_score=50)` — never 503 | Real vision LLM, `VisionAuditResponse` |
| Campaign copy (F5) | `asset_gen.py` heuristic — regex, brand name | P2: LLM copywriter |

### Signal Check — the exception handling contract

`routers/signal.py` must catch `VisionNotConfiguredError` and return a valid `SignalResult` (not an `HTTPException`):

```python
except VisionNotConfiguredError:
    return SignalResult(
        round=round,
        detected=profile.positioning,
        target=profile.positioning,
        gaps=SignalGaps(premium=0, modern=0, playful=0, niche=0),
        match=50,
        verdict="needs_fix",
        issue="heuristic fallback — AI key not configured",
        evidence=["Signal Check requires OPENROUTER_API_KEY to score accurately"],
        fix=FixKnobs(),
    )
```

The frontend renders this as a valid `SignalCard` with an amber badge: "Signal Check: heuristic fallback — AI key not configured." The badge is always visible — never hidden, never silent.

### Facts rule (P2, copywriter)

When the LLM copywriter lands: price, discount, and dates in generated copy must come only from the owner's goal string. If the goal contains no price, the `price` slot is `"₹???"` (a visible placeholder). The model never invents a number. This constraint is enforced in Python after the LLM call — the `slots.price` field is always overwritten with the regex-extracted price from the goal (or the placeholder), regardless of what the LLM returned.

---

## 8. Scope IN / OUT

### In scope

- `/workspace`: 3-column chat + results + trace; `AskBar` → `AgentRunIn` → `CampaignOut`
- `/brand`: full `BrandProfile` editor — palette, fonts, positioning, do/dont/preferences, voice, products, identity directions, last audit chip
- `/campaigns` + `/campaigns/:id`: list and detail views of `CampaignOut` objects
- `/editor/:assetId`: slot inline editing, knob sliders, re-check signal
- `/audit`: multi-image brand consistency check using real vision LLM
- Signal Check (F4): upload → `SignalResult` → `SignalCard`; round 2 auto-fix (manual, not looped)
- Asset Library: generated and uploaded assets persisted as `LibraryAsset`; list and filter
- Heuristic fallbacks for every LLM feature — the product never requires a key to demo

### Out of scope (explicitly cut)

- **F4 auto-fix loop** — Signal Check → revise knobs → re-render → re-check. Cut. Signal Check stays as a manual "check this asset" feature. The auto-fix round 2 is a single additional call, not a loop.
- **Server-side Playwright render** — required for the loop. Cut with it. `AssetPreview` stays as client-side CSS.
- **Real image generation** — `hero_image` slot is always null at P0. `AssetPreview` renders a CSS gradient with a dim "AI image: not generated" chip. Not a broken state — a known-placeholder state.
- **F10 Brand Audit page** — exists in the route table; the LLM integration in `audit.py` exists; but the full audit flow with multi-image upload and `AuditReport` rendering is P1.
- **Photography, logos, iconography generation** — out of scope for P0. `BrandProfile.logo` uses wordmark type only; no image upload for logo.
- **Performance data** — campaigns have no click/view/engagement data. Status is "Draft" only.
- **Team / multi-user** — one brand, one owner. No auth beyond the brand ID.
- **Export** — "Export all" as zip of PNGs requires server-side render. Deferred. Single-asset export (browser screenshot / print) is acceptable at P0.

---

## 9. P0 Hackathon Slice — Buildable in ~12h

This is the exact build list. No feature is included unless it passes the demo test: does it make the 3-minute demo stronger or does it unblock a dependency?

### Backend (3 items)

**B1. Fix `routers/signal.py` heuristic fallback** (~20min)
Catch `VisionNotConfiguredError`, return `SignalResult(match=50, verdict="needs_fix", issue="heuristic fallback — AI key not configured")`. Never return HTTP 503 to the frontend from Signal Check.
Files: `backend/routers/signal.py`

**B2. Inject dont rules into `asset_gen._headline()`** (~30min)
After generating the headline string, check every word against `profile.dont`. If any dont-rule word appears in the headline, fall back to `brand.name` as the headline. This makes the Memory demo claim ("it respects our rules") demonstrable.
Files: `backend/asset_gen.py`

**B3. Wire `BrandProfile.palette` + `fonts` + `voice` + `do` + `dont` into campaign generation** (~45min)
The heuristic currently uses `brand.name` and `brand.category` only. Add: `voice.tone` in `_cta()`, `personality` in `_subline()`, brand `city` in the objective string. The injected memory spec:
```python
f"""Brand: {profile.name} ({profile.category})
Voice: {profile.voice.tone}
Personality: {", ".join(profile.personality)}
Do: {"; ".join(profile.do)}
Don't: {"; ".join(profile.dont)}
"""
```
At P0 this is a comment in the heuristic (for trace transparency) not a real system prompt. P2 it becomes one.
Files: `backend/asset_gen.py`

### Frontend (6 items)

**F1. Fix AssetPreview palette prop threading** (~45min)
Every `AssetCard` currently imports `brandData` from `mock/brand.json`. Replace with props from parent. `Workspace.jsx` has `useBrand()` — pass `brand.palette` and `brand.fonts` down through `CampaignOut` render → `AssetCard` → `AssetPreview`. This is the single highest-leverage fix: it makes generated assets look like the brand.
Files: `frontend/src/pages/Workspace.jsx`, `frontend/src/components/AssetCard.jsx`, `frontend/src/components/AssetPreview.jsx`

**F2. Products editor in Brand.jsx** (~1.5h)
Add a "Products" section with add/remove row editing. Each row: name input (200 char), price input (number, optional), remove button. "Save to Brand" includes updated `products` in `patchMemory`. Empty state: "No products yet. Add your menu items."
Files: `frontend/src/pages/Brand.jsx`

**F3. Palette swatch color picker** (~45min)
Each swatch span in Brand.jsx gets `onClick` that opens a hidden `<input type="color">` pre-filled with the current hex. On `change` event, call `api.patchMemory(id, { palette: { ...brand.palette, [key]: newHex } })`. Toast on success/failure.
Files: `frontend/src/pages/Brand.jsx`

**F4. Voice tone editable input** (~30min)
Replace the read-only `dd` for `voice.tone` with a text input. Auto-save on blur: `api.patchMemory(id, { voice: { ...brand.voice, tone: newTone } })`. Placeholder: "e.g. confident-casual, urgent, warm".
Files: `frontend/src/pages/Brand.jsx`

**F5. Preferences ChipList** (~20min)
Add a "Preferences" section below Don't, above Voice. Reuse `ChipList` component with `items={preferences}` and `onChange={setPreferences}`. Include `preferences` in the `BrandEditorInner` `dirty` check and in the `save()` call. Empty state: "No preferences yet. Add style notes."
Files: `frontend/src/pages/Brand.jsx`

**F6. Last audit chip in Brand.jsx** (~30min)
On mount, call `api.listAudits(brandId)`. Take `audits[0]` if exists. Render in the right column below positioning sliders: consistency score, date, "Run audit" link to `/audit`. If no audits: "No audit yet. Upload 2-5 assets to check consistency." Empty state is always visible — never blank.
Files: `frontend/src/pages/Brand.jsx`

### Total estimated time: ~6h of focused work

Remaining ~6h: Phase 3 library plumbing (reconnect `Campaigns.jsx`, `CampaignDetail.jsx` to real backend), Phase 4 honest trace (return trace array with response), Phase 5 CSS polish (AssetPreview layout variants, price badge treatment), demo seed verification (Burger Lab always present, one pre-made campaign visible on first load).

---

## 10. Demo Script (3 minutes, no dead states)

**Setup:** App loads at `/workspace`. Burger Lab brand active. Brand identity applied (Bold Typographic: palette set, fonts set). One existing campaign ("Weekend Deals") pre-seeded but not shown at first.

**Minute 1 — Brand Memory:**
1. Navigate to `/brand`. Show palette swatches — real hex colors from the applied identity.
2. Click a swatch → color picker opens → change accent → swatch updates live.
3. Show Do/Don't rules: "Never use the phrase 'fresh ingredients'", "Always show the price clearly."
4. Show voice tone: "confident-casual, Hinglish."
5. "This is our brand memory. Every asset we generate from here uses these rules."

**Minute 2 — Campaign generation:**
1. Navigate to `/workspace`. Type: "Create a launch poster for our new truffle burger at ₹399"
2. Show: thinking block appears, TracePanel starts streaming (Loaded Brand Memory → Dont rule applied → Voice applied → Generated 4 assets → Campaign ready)
3. Centre pane fills: 4 asset cards in Burger Lab palette — dark background, red primary, bold Bebas Neue headline, ₹399 price badge.
4. Click headline inline → edit it → see the preview update without a page reload.
5. "Signal not checked" badge visible on all cards.

**Minute 3 — Signal Check:**
1. Hover first asset card → click "Re-check signal."
2. Badge pulses → result appears: "74 / pass" or "62 / needs_fix."
3. If needs_fix: show the axis breakdown (premium -10, playful +8). "The poster reads as casual, not premium. Here's what the vision model saw."
4. Navigate to `/brand` → show Last Audit chip: "No audit yet. [Run audit]" — or if pre-seeded: "Last audit: 3 days ago · Consistency: 78."
5. "This is what makes Marque different — it knows your brand positioning and it scores your assets against it."

**Honest claims to make:**
- "Brand DNA is seeded deterministically — it works without any API key."
- "Signal Check uses a real vision LLM — GPT-4o or equivalent via OpenRouter."
- "The asset generator is currently heuristic — we have the LLM copywriter spec'd for the next sprint."
- "It never invents prices — if you don't say ₹399, the price slot shows ₹??? as a placeholder."

**Things to never say in the demo:**
- "The AI is analyzing your brand right now" (it's a cosine lookup)
- "Watch it self-correct" (auto-fix loop is cut)
- "Real-time signal improvement" (we show round 1 only at P0)

---

## 11. Honest Claims

### What is real at P0

- Signal Check scores a real uploaded image against real brand positioning targets using a real vision LLM (GPT-4o via OpenRouter). The match score, gaps, evidence, and fix knobs all come from the model. The model is never trusted for arithmetic — scores are computed in Python.
- Brand DNA (positioning, do/dont rules, voice tone) is seeded on creation using deterministic lookup tables that reflect real brand positioning research. It is not random — `price_level=2 + personality=["bold","premium"]` reliably produces premium-skewed positioning.
- The 5 identity templates are curated, not generated. The nearest-2 selection is cosine similarity. The palette and font pairings were manually selected to match each positioning profile.
- The heuristic asset generator extracts price with regex and uses the brand name for copy. It is labeled as "heuristic fallback" in the trace. It is not an LLM.
- The TracePanel at P0 is CSS-animated with pre-defined steps. The steps reflect what the code actually does (loads brand memory, generates assets) but are not live-streamed. Labeled as such.

### What is not real at P0

- The copy in generated assets is not AI-written. It is the goal string reformatted around the price.
- The `hero_image` slot is always null. Assets show a CSS gradient. Explicit "AI image: not generated" chip.
- The auto-fix loop is cut. Signal Check round 2 shows what the fix knobs would be but does not automatically regenerate the asset.
- No real image generation at any tier. Background gradients only.

### What becomes real at P1

- LLM Brand DNA: `brand_dna.propose_dna_llm()` replaces lookup tables. The model reads brand description and returns positioning + tone + do/dont in one call.
- LLM copywriter: `asset_gen.generate_slots_llm()` uses brand voice, do/dont rules, and goal to write real on-brand copy. Facts rule enforced in Python.
- Intent classifier: chat goals route to different actions (generate, read, memory append) instead of always generating a campaign.
- Real trace streaming: server emits actual steps the code executes, not a pre-defined list.

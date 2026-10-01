# UX Flows and Screens — Marque.ai

> Core experience artifact. Ground truth for all frontend work.
> Running example throughout: **Burger Lab** — premium-casual Delhi burger restaurant.
> Canonical goal: "Create a launch poster for our truffle burger at ₹399"

---

## 1. Core UX Philosophy

### The Governing Frame

The chat is not a command line with natural language. It is the workspace itself. Every module (Brand, Campaigns, Library, Audit) is where results land — the chat is where work happens. The user never opens a form to create; they talk, and the form fills itself.

### 8 Principles

**1. Act immediately on low-stakes requests. Confirm only before BrandProfile mutations.**

If the action writes to `BrandProfile` (identity or memory), show a diff card. If it only generates an `AssetOut` or `CampaignOut`, act immediately. "Make a launch poster" — no confirm. "Apply this palette permanently" — diff card required.

**2. Every AI action produces a visible artifact, never just text.**

Every agent action maps to a schema object that renders on-screen. `AssetOut` → `AssetPreview` card. `CampaignOut` → campaign card. `BrandMemoryPatch` → before/after diff in centre pane. The chat column holds conversation turns; the Results column holds output.

**3. Stream content, not process narration.**

What streams: the AI's `issue` string from `VisionCriticResponse`, the `core_message` of a forming campaign, the headline slot of an asset being named. What does NOT stream: "Please wait while I generate...", "I am thinking...", "Based on your request...".

**4. Brand Memory is always visible when context is active. Never a modal, never a separate page.**

The trace panel (right column) shows the active `BrandProfile` fields the AI used for this request: palette swatches, top 3 do/dont rules, positioning scores. If any are null/empty, show "Brand profile incomplete — [fill in]" link.

**5. Edits happen in-place on artifacts, not back in chat.**

Every `AssetOut` card has a direct-edit affordance: click headline to edit inline, knob sliders exposed on hover. These are instant local mutations — no AI involved. "Regenerate with AI" is a separate, clearly-labeled button that sends the modified `AssetKnobs` back to the agent.

**6. One required input per turn, never a form disguised as conversation.**

If the AI needs clarification, it asks one specific question and waits. If `BrandProfile` is complete enough to proceed, it does not ask at all. The only case it asks: product is not in `products` list AND price is missing AND no recent assets of this type exist.

**7. Consequential confirmations show a diff, not a warning.**

When the agent proposes updating `BrandProfile`, the UI renders: left side = current state, right side = proposed state, changed fields highlighted. "Are you sure?" trains users to click Yes automatically. A diff makes the user see what changes.

**8. Silence broken work loudly. Never silently degrade.**

If `OPENROUTER_API_KEY` is absent, show badge: "Brand DNA: heuristic fallback — AI key not configured." If `signal_match` is null, show "Signal not checked" badge — not empty space. If `slots.hero_image` is null, show dim "AI image: not generated" chip. The user always knows what is real and what is placeholder.

---

## 2. Hero Screen Layout — `/workspace`

Three columns, `calc(100dvh - 3.5rem)` tall. Full-bleed on ≥1024px. Single-column on mobile (results via bottom sheet).

```
┌─────────────────────┬──────────────────────────────┬─────────────────────┐
│  LEFT — 25%         │  CENTRE — flex-1             │  RIGHT — 25%        │
│  border-r zinc-200  │                              │  xl:block border-l  │
│                     │                              │                     │
│  Brand context      │  Live results pane           │  TracePanel         │
│  strip              │                              │                     │
│  ─────────────────  │  State machine:              │  Active BrandProfile│
│  Scrollable chat    │  idle → thinking →           │  fields used in     │
│  history            │  result                      │  this run.          │
│  (overflow-y-auto,  │                              │                     │
│   flex-1)           │  Re-renders as               │  Object links       │
│                     │  conversation progresses.    │  panel below trace: │
│  ─────────────────  │                              │  pill links to      │
│  AskBar pinned      │                              │  objects touched    │
│  border-t p-4       │                              │  this session.      │
│  char count 0/500   │                              │                     │
│  ⌘↵ hint            │                              │                     │
└─────────────────────┴──────────────────────────────┴─────────────────────┘
```

**Mobile (< 1024px):** Only left column renders. After campaign generates, bottom sheet (`h-[70dvh]`, slide-up) shows results grid. Trace omitted on mobile.

---

## 3. Idle State — Before First Message

```
LEFT COLUMN
───────────────────────────────────────────────────────
[Brand context strip]
  ○○○○○  Burger Lab  Restaurant · Delhi  [premium 72]
         (grey placeholder swatches if palette null)

[amber banner if palette null]
  Brand identity not set up yet — apply a direction
  below to unlock palette and fonts.
  [→ Jump to directions]
───────────────────────────────────────────────────────
[empty chat list]

───────────────────────────────────────────────────────
AskBar
  placeholder: "Launch our truffle burger at ₹399 this weekend"
  [Launch our weekend offer] [Check brand signals] [What rules do we have?]
  ⌘↵ hint

CENTRE COLUMN
───────────────────────────────────────────────────────
  Give me a goal and I'll plan the campaign.
  (zinc-400, mono, centred)

RIGHT COLUMN
───────────────────────────────────────────────────────
  No run yet.
  (zinc-600, mono, text-[12px])
```

---

## 4. Canonical Flow: "Create a launch poster for our truffle burger at ₹399"

### Step 1 — User submits

- User bubble appears at bottom of left column: right-aligned, `bg-zinc-100 rounded-sm px-3 py-2 text-[14px]`
- AskBar clears, send button disables (`disabled:opacity-40`)
- `useAgent.run()` fires

### Step 2 — Thinking state

Price check passes (₹399 present). `setRunning(true)`.

```
LEFT COLUMN
───────────────────────────────────────────────────────
  [user bubble right] "Create a launch poster for our truffle burger at ₹399"

  [AI type:thinking]
    ⟳  Planning your campaign…
    (spinner h-4 w-4 animate-spin emerald-700)

CENTRE COLUMN
───────────────────────────────────────────────────────
  ⟳  Planning campaign…
  (spinner centred, mono text-[13px] zinc-500)

RIGHT COLUMN
───────────────────────────────────────────────────────
  → Loaded Brand Memory
  (first event appears, zinc-500)
```

### Step 3 — Campaign resolves (~200ms)

`generate_campaign` runs synchronously. Returns `CampaignOut` with 4 `AssetOut` objects.

```
LEFT COLUMN
───────────────────────────────────────────────────────
  [user bubble right]

  [AI type:generate]   border border-zinc-200 rounded-sm px-3 py-3 bg-white text-[13px]
  ┌─────────────────────────────────────────────────┐
  │  ✦ Generated campaign  [Truffle Burger Launch]  │
  │    4 assets · Draft · ₹399                      │
  │    [→ View in Campaigns]  [→ Open in Editor]    │
  └─────────────────────────────────────────────────┘

CENTRE COLUMN
───────────────────────────────────────────────────────
  Truffle Burger Launch
  ──────────────────────────────────────────────────
  Launch our truffle burger at ₹399     [Draft]

  Core message
  ──────────────────────────────────────────────────
  Launch our truffle burger. ₹399. Limited time.

  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │            │  │            │  │            │  │            │
  │ AssetCard  │  │ AssetCard  │  │ AssetCard  │  │ AssetCard  │
  │ Poster     │  │ IG Post    │  │ Story      │  │ WhatsApp   │
  │ 1080×1350  │  │ 1080×1080  │  │ 1080×1920  │  │ 800×800    │
  │            │  │            │  │            │  │            │
  │[Signal not │  │[Signal not │  │[Signal not │  │[Signal not │
  │ checked]   │  │ checked]   │  │ checked]   │  │ checked]   │
  │[Edit →]    │  │[Edit →]    │  │[Edit →]    │  │[Edit →]    │
  └────────────┘  └────────────┘  └────────────┘  └────────────┘

RIGHT COLUMN  (60ms stagger between events)
───────────────────────────────────────────────────────
  → Loaded Brand Memory (v5)
  → Palette: #E63946 / #212121 / #F4A261
  → Dont rule applied: "Never use green as primary"
  → Dont rule applied: "Never use the word 'fresh'"
  → Voice: Hinglish · urgent and direct
  → Positioning target: premium 72 · playful 58
  → Generated 4 assets
  → Campaign ready          ← text-emerald-600 font-medium
```

**Critical wire-up:** `AssetCard` must receive `palette` and `fonts` from `useBrand()` context — never from `mock/brand.json`. Any static import of brand mock data is the "Amnesia Loop" bug.

---

## 5. Six AI Action Types

Each action type has a distinct render in the conversation list (left column) AND a centre-pane result. Client-side state shape: `{ role, content, action_type, action_payload }`.

### `thinking`
```
⟳  Planning your campaign…
(spinner h-4 w-4 animate-spin emerald-700, text-[13px] zinc-500)
```
Centre: same spinner + mono text.

### `read`
Trigger: "What's our brand palette?", "Show me the Burger Lab identity", "What campaigns do we have?"

```
LEFT COLUMN BLOCK
┌─────────────────────────────────────────────┐
│  🔍  Read brand identity                    │   (MagnifyingGlass 13px zinc-400)
│    primary #E63946 · secondary #212121      │
│    Fonts: Bebas Neue / Inter                │
│    Positioning: premium 72 · modern 65      │
└─────────────────────────────────────────────┘
Compact, monospace values, no prose. Max 4 data rows.

CENTRE PANE — BrandCard component
┌─────────────────────────────────────────────┐
│  ●●●●●  palette swatches (h-8 w-8 circles) │
│                                             │
│  BEBAS NEUE   heading specimen              │
│  Inter        body specimen                 │
│                                             │
│  premium  ████████░░ 72                     │
│  modern   ██████░░░░ 65                     │
│  playful  █████░░░░░ 58                     │
│  niche    ████░░░░░░ 45                     │
│                                             │
│  Do rules: [chip] [chip] [chip]             │
│  Don't rules: [chip] [chip] [chip]          │
└─────────────────────────────────────────────┘
```

Empty state: "Brand identity not set up yet. [→ Complete brand setup]"

### `generate`
(Covered in Section 4.)
```
✦ Generated campaign  [chip: name]
  N assets · status · price extracted
  [→ View in Campaigns]  [→ Open in Editor]
```

### `evaluate`
Trigger: signal check, brand completeness check.
```
📶  Signal Check
  62/100 · needs_fix
  premium -17 · playful +12
  [→ View full result]  [→ Auto-fix]
```
Centre: `SignalCard` (see Section 8).

### `confirm`
Trigger: any `BrandProfile` write proposed by AI.
```
⚠  Apply "Bold Typographic" direction?          (AlertCircle 13px amber-600)
   This locks palette and fonts into Brand Memory.
   [Show diff ↓]
(border border-amber-200 bg-amber-50/50 rounded-sm px-3 py-3 text-[13px])
```
Centre: diff card (see Section 7).

### `memory`
Trigger: memory append from chat.
```
🔖  Added to Don't rules                       (BookmarkPlus 13px emerald-600)
   "Never use the word 'fresh'"
   [→ View in Brand Memory]
```
Renders optimistically — reverts to `error` block if API fails.

### `error`
```
⚠  Could not generate campaign. [try again]   (text-amber-700)
(border border-amber-200 bg-amber-50 px-5 py-4 rounded-md)
```
Centre: same amber card with retry button. Never silently empty.

---

## 6. Brand Builder Journeys — `/brand` + Workspace

### Journey A: Onboarding to Brand Memory (Stage 0 → 4)

#### A1. First Load — `/brand` before anything is set

```
LEFT COLUMN of /brand
───────────────────────────────────────────────────────
[amber banner]
  Brand identity not set up yet — apply a direction
  below to unlock palette and fonts.

[BrandIdentityCard]
  ○ ○ ○ ○ ○    (grey placeholder swatches)
  Heading font: —
  Body font:    —

  [2 identity direction cards — see A3]

[positioning sliders — interactive immediately]
  premium    ████████░░  72
  modern     ██████░░░░  65
  playful    █████░░░░░  58
  niche      ████░░░░░░  45

[Products section — P0 gap]
  Products                               [+ Add product]
  ────────────────────────────────────────────────────
  No products yet. Add your menu items.

[Do rules]   ChipList
[Don't rules] ChipList
[Preferences] ChipList  ← P0 gap to add
  No preferences yet. Add style notes.

[Voice section]
  language   Hinglish
  tone       [text input, auto-save on blur]    ← P0 gap (currently read-only)
             placeholder: "e.g. confident-casual, urgent, warm"

[Save to Brand]  (disabled until dirty=true)
```

#### A2. Products — Add "Truffle Burger ₹399"

User clicks `[+ Add product]`:

```
Products                               [+ Add product]
────────────────────────────────────────────────────
[ Truffle Burger      ]  [ 399 ]  [✕]    ← auto-focus on name
[ __________________ ]  [ ___ ]  [✕]    ← blank row (if Tab past last field)
```

User removes blank row. Clicks `Save to Brand`:

- Button: "Saving…" disabled
- Calls `api.patchMemory(id, { positioning, do: doRules, dont: dontRules, preferences, products: [{ name: "Truffle Burger", price: 399 }] })`
- Success: `setBrand(updated)`, `BrandEditorInner` remounts via `key={brand.id}:${brand.version}`, toast "Saved to Brand Memory."
- Error: toast "Could not save.", button re-enabled, products stay in edited state

#### A3. Identity Directions — Two cards render

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  border-t-4 #E63946          │  │  border-t-4 #2C1A0E          │
│                              │  │                              │
│  ● ● ● ● ●  (swatches h-8)  │  │  ● ● ● ● ●  (swatches h-8)  │
│                              │  │                              │
│  BEBAS NEUE  heading         │  │  Playfair Display  heading   │
│  Inter       body            │  │  DM Sans          body       │
│                              │  │                              │
│  premium  ████████░░ 72      │  │  premium  ████████░░ 72      │
│  modern   ██████░░░░ 65      │  │  modern   ██████░░░░ 65      │
│                              │  │                              │
│  [Apply this direction]      │  │  [Apply this direction]      │
│  [Current]  ← if active      │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
```

Direct-manipulation apply (click on `/brand`): no diff card. Calls `applyIdentity(id, key)` immediately. Toast on success.

Palette swatch color picker (P0 gap): clicking any swatch opens `<input type="color">` pre-filled with current hex. On picker close: `api.patchMemory(id, { palette: { ...brand.palette, [key]: newHex } })`. Toast "Palette updated."

#### A4. Last Audit chip (right column of `/brand`)

```
RIGHT COLUMN of /brand (below positioning)
───────────────────────────────────────────────────────
[if audits[0] exists]
  ┌─────────────────────────────────────────┐
  │ Last audit: 3 days ago                  │
  │ Consistency: 74 / 100                   │
  │ [→ Run audit]  [→ View full report]     │
  └─────────────────────────────────────────┘

[if no audits]
  No audit yet. Upload 2–5 assets to check consistency.
  [→ Run audit]
```

---

### Journey B: Chat — "Which identity direction should we go with?"

**Turn 1**

LEFT: user bubble. AI `type: "thinking"` → `"Loading directions…"`  
CENTRE: spinner  
RIGHT: `→ Loaded Brand Memory` / `→ Fetching identity directions…`

**After `GET /v1/brands/{id}/identity` resolves:**

LEFT `type: "read"` block:
```
🔍  Identity directions
  Direction A: [■ ■ ■ ■ ■]  Bebas Neue / Inter
  Direction B: [■ ■ ■ ■ ■]  Playfair Display / DM Sans
  [→ View on Brand page]
```

CENTRE: side-by-side direction cards (as in A3 above).

RIGHT:
```
→ Loaded Brand Memory
→ Fetched 2 identity directions
→ Positioning target: premium 72 · modern 65
```

---

### Journey C: Chat — "Apply the bold direction" (consequential confirm)

LEFT `type: "confirm"` block:
```
⚠  Apply "Bold Typographic" direction?
   This locks palette and fonts into Brand Memory.
   [Show diff ↓]
```

CENTRE diff card:
```
┌───────────────────────────────────────────────────────┐
│  IDENTITY CHANGE                                      │
│  "Bold Typographic" direction                         │
├─────────────────────────┬─────────────────────────────┤
│  CURRENT (zinc-50)      │  PROPOSED (emerald-50)      │
│  palette: null          │  primary:  ● #E63946        │
│                         │  secondary:● #212121        │
│                         │  accent:   ● #F4A261        │
│                         │  light:    ● #F9F7F2        │
│                         │  dark:     ● #0B0B0B        │
│  fonts: null            │  Bebas Neue                 │
│                         │  / Inter                    │
│  meaning: {}            │  3 new entries              │
├─────────────────────────┴─────────────────────────────┤
│  [Apply direction]   [Cancel]                         │
└───────────────────────────────────────────────────────┘
```

RIGHT: `→ Waiting for confirmation: identity apply` (text-amber-600)

**On Apply:**
- Button: "Applying…" spinner, disabled
- `POST /v1/brands/{id}/identity/apply` body: `{ key: "bold_typographic", fields: null }`
- `setBrand(updated)` → `BrandEditorInner` remounts, palette swatches fill with real hex
- Left block transforms to:
  ```
  ✦ Applied "Bold Typographic"  [v3]
    Palette · Fonts · Meaning locked into Brand Memory
    [→ View on Brand page]
  ```
- RIGHT: `→ Identity applied (v3)` (text-emerald-600 font-medium)

**On Cancel:**
- Diff card collapses, centre reverts to direction cards
- LEFT: "No changes made." (zinc-500)
- `BrandProfile` unchanged

---

## 7. Diff Card — Pattern for All Consequential Confirms

Used whenever AI proposes a `BrandProfile` write. Never used for generation actions.

**Multi-field diff** (palette + fonts + meaning) → centre-pane card (see Journey C above).

**Single-field diff** (voice.tone, one rule) → inline in left column confirm block:

```
⚠  Update Brand Memory?                       (AlertCircle amber-600)
   voice.tone: "" → "urgent and direct"
   [Apply change]  [Cancel]
(border border-amber-200 bg-amber-50/50 px-3 py-3 text-[13px] rounded-sm)
```

Threshold rule: single-field change = inline confirm block. Multi-field change = centre-pane diff card.

After apply:
```
✦ Brand Memory updated  [v5]
  voice.tone → "urgent and direct"
  [→ View in Brand Memory]
```

After cancel: "No changes made." (zinc-500). Version unchanged.

---

## 8. Signal Check Journey

### From chat — "Check the signal on our poster"

LEFT `type: "clarify"` block (AI fires immediately, no API call yet):
```
?  Upload the poster you want to check.        (QuestionMark zinc-500)
   ┌──────────────────────────────────────┐
   │  Drag an image here or click to      │
   │  browse. Max 5 MB, JPG or PNG.       │
   └──────────────────────────────────────┘
   (border-dashed border-zinc-300 h-20, accept="image/*")
```

After upload:
- Drop zone shows 40×40 thumbnail + filename + size
- Spinner: "Checking signal…"
- `POST /v1/brands/{id}/signal-check` multipart: `image=<file>`, `round=1`

CENTRE loading:
```
[animate-pulse border border-zinc-200 h-40 w-full rounded-sm]
  [bg-zinc-100 h-3 rounded]
  [bg-zinc-100 h-3 rounded w-3/4]
  [bg-zinc-100 h-3 rounded w-1/2]
```

RIGHT:
```
→ Loaded Brand Memory
→ Uploaded image: poster.jpg (340 KB)
→ Running vision critic…
```

### SignalCard — Path A (real vision LLM)

```
CENTRE COLUMN
┌───────────────────────────────────────────────────────┐
│  62 / 100          [needs_fix]  amber chip            │
│  (text-4xl font-bold font-mono)                       │
│                                                       │
│  "Poster reads as mid-tier, not premium"              │
│  (text-[14px] zinc-700 italic)                        │
│                                                       │
│  premium   detected ██████░░░░ 55  target ████████ 72  gap: -17 (red)   │
│  modern    detected ██████░░░░ 62  target ██████░░ 65  gap: -3  (zinc)  │
│  playful   detected ███████░░░ 70  target ██████░░ 58  gap: +12 (amber) │
│  niche     detected █████░░░░░ 48  target █████░░░░ 45  gap: +3  (zinc) │
│                                                       │
│  Evidence:                                            │
│  • Warm colour temperature signals casual             │ ← fade in 0ms
│  • Low contrast text reduces authority                │ ← fade in 60ms
│  • Dense layout competes with the product             │ ← fade in 120ms
│  (transition-opacity duration-200, 60ms stagger)      │
│                                                       │
│  [→ Auto-fix]                                         │
└───────────────────────────────────────────────────────┘
```

Verdict chips: `"pass"` → `bg-emerald-100 text-emerald-800`. `"needs_fix"` → `bg-amber-100 text-amber-800`. Gap colouring: negative = `text-red-600`, positive = `text-amber-600`, ≤3 = `text-zinc-500`. Detected bar: `bg-emerald-600`. Target bar: `border border-dashed border-zinc-400`.

LEFT block transforms:
```
📶  Signal Check
  62/100 · needs_fix
  premium -17 · playful +12
  [→ View full result]  [→ Auto-fix]
```

### SignalCard — Path B (heuristic fallback, no OpenRouter key)

Router catches `VisionNotConfiguredError` and returns `SignalResult` with:
- `match=50`, `verdict="needs_fix"`, `issue="heuristic fallback — AI key not configured"`, `evidence=["Signal Check requires OPENROUTER_API_KEY to score accurately"]`

Card adds amber banner at top:
```
[bg-amber-50 border border-amber-200 px-3 py-1.5 text-[12px] text-amber-700]
Signal Check: heuristic fallback — AI key not configured
```

LEFT block adds amber badge:
```
[bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] text-amber-700]
heuristic fallback — AI key not configured
```

Never a 503. Never silently blank.

### Auto-fix journey (round 2)

User says "Auto-fix this" or clicks `[→ Auto-fix]`:
- AI classifies as generation action (no `BrandProfile` write) — acts immediately, no confirm
- `POST /signal-check` round=2
- Centre: `SignalCard` gets overlay `bg-white/70 flex items-center justify-center` + spinner + "Running round 2…"

After round 2 (`match=79, verdict="pass"`):

```
CENTRE — AutoFixResult (two-panel)
┌────────────────────────┬───────────────────────┐
│  BEFORE (round 1)      │  AFTER (round 2)      │
│  bg-zinc-50 border-r   │  bg-emerald-50/50     │
│  62/100 · needs_fix    │  79/100 · pass        │
│  premium: 55 / tgt 72  │  premium: 71 / tgt 72 │
│  playful: 70 / tgt 58  │  playful: 60 / tgt 58 │
│                        │  +17 (text-emerald-700 font-bold)│
│  Suggested knob changes:                        │
│  font_style: display_bold → serif_elegant       │
│  overlay:    0.40        → 0.60                 │
│                                                 │
│  [AssetPreview re-renders with new knobs — local state only, no API] │
│                                                 │
│  [Apply to asset]  (disabled — "Saving to Library coming soon")      │
└─────────────────────────────────────────────────┘
```

"Apply to asset" button: `opacity-50 cursor-not-allowed` + tooltip. `AssetPreview` re-renders via CSS-only knob change in local state. No network call.

Auto-fix error state:
```
CENTRE
┌──────────────────────────────────────────────────┐
│  border border-amber-200 bg-amber-50 px-5 py-4   │
│  Auto-fix failed — vision service returned       │
│  invalid JSON.                                   │
│  Original check score still valid: 62/100.       │
│  [Retry auto-fix]                                │
└──────────────────────────────────────────────────┘
```

### Signal check from asset grid (direct manipulation, no chat)

Any `AssetOut` with `signal_match: null`:
- Badge: `"Signal not checked"` `bg-zinc-100 text-zinc-500 text-[11px] px-2 py-0.5` — never empty space
- Hover → `[Re-check signal]` button appears

On click:
1. Badge → `animate-pulse` grey pill "Checking…"
2. Rasterize `AssetPreview` DOM → Blob
3. `POST /signal-check` with blob, round=1
4. On return: badge updates in-place → `"78 / pass"` or `"62 / needs_fix"`
5. No chat message, no TracePanel update

Error: badge → `"Check failed"` `text-amber-600` + `[retry]` link.

---

## 9. Brand Memory Journeys

### Memory append — "Never use the word 'fresh' in our copy"

AI classifies as `memory_append` on `dont`. No confirmation — append is non-destructive. Acts immediately (optimistic).

LEFT `type: "memory"` block (renders before API resolves):
```
🔖  Added to Don't rules          (BookmarkPlus 13px emerald-600)
   "Never use the word 'fresh'"
   [→ View in Brand Memory]
```

`POST /v1/brands/{id}/memory/rules` body: `{ field: "dont", value: "Never use the word 'fresh'" }` fires in parallel.

CENTRE `MemoryDiffCard`:
```
DON'T RULES  +1
─────────────────────────────────────────────
  ○ Never use the phrase "fresh ingredients"   (zinc-600, existing)
  ○ Never use green as primary                 (zinc-600, existing)
  ● Never use the word "fresh"                 ← NEW
    (border-l-2 border-emerald-500 pl-3 text-emerald-900 bg-emerald-50/50)
```

On API success: `setBrand(updated)`. Block stays (already correct).  
On API failure: block reverts to `type: "error"`:
```
⚠  Could not save rule.  [retry]   (text-amber-700)
```
`MemoryDiffCard` disappears. `BrandProfile` unchanged.

RIGHT:
```
→ Memory rule appended: dont
→ "Never use the word 'fresh'"
→ Brand Memory v4
```

### Memory read — "What are our brand rules?"

LEFT `type: "read"`:
```
🔍  Brand Memory
  Do: 3 rules  ·  Don't: 4 rules
  Preferences: 0 rules
  Voice: Hinglish · (tone not set)
  Personality: bold · premium · playful
```

CENTRE full `BrandCard`:
```
Do rules (3)
  [Always show the price clearly]  [Use Hinglish in the copy]  [Keep the logo visible]
  (border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-1 text-[13px] rounded-sm)

Don't rules (4)
  [Never use "fresh ingredients"]  [Never use green as primary]  [Never use "fresh"]
  (border border-red-200 bg-red-50 text-red-900)

Preferences (0)
  No preferences yet — tell me your style notes.
  (text-zinc-400 italic text-[13px])

Voice
  language   Hinglish
  tone       (not set)   ← text-zinc-400 italic, never blank space

Personality
  [bold]  [premium]  [playful]
  (border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[13px] text-zinc-700)
```

### Memory write — "Change our voice tone to urgent and direct"

Single-field change → inline confirm block (no centre-pane diff card):

LEFT `type: "confirm"`:
```
⚠  Update Brand Memory?
   voice.tone: "" → "urgent and direct"
   [Apply change]  [Cancel]
```

RIGHT: `→ Waiting for confirmation: voice.tone update` (text-amber-600)

After Apply:
```
LEFT
  ✦ Brand Memory updated  [v5]
    voice.tone → "urgent and direct"
    [→ View in Brand Memory]

RIGHT
  → Memory patch: voice.tone
  → "urgent and direct"
  → Brand Memory v5    (text-emerald-600 font-medium)
```

### Memory injection during generation

TracePanel shows which rules were active and respected:
```
→ Loaded Brand Memory (v5)
→ Palette: #E63946 / #212121 / #F4A261
→ Dont rule applied: "Never use green as primary"
→ Dont rule applied: "Never use the word 'fresh'"
→ Voice: Hinglish · urgent and direct
→ Positioning target: premium 72 · playful 58
→ Generated 4 assets
→ Campaign ready
```

`"Dont rule applied"` lines: `text-zinc-700`. If `dna_source === "heuristic"` (no OpenRouter key):
```
→ Brand DNA: heuristic fallback [no AI key configured]   (text-amber-600)
```

Backend rule: `asset_gen._headline()` checks every `dont` rule. If any word from a dont rule appears in the generated headline, fall back to `brand.name`.

---

## 10. TracePanel — Right Column Detail

```
RIGHT COLUMN ANATOMY
───────────────────────────────────────────────────────
[Header: "Trace" font-mono text-[12px] uppercase zinc-400]

[Event list — overflow-y-auto]
  Each event: →  text  (text-[12px] font-mono zinc-500)
  Last event when done: text-emerald-600 font-medium
  Warning events: text-amber-600
  Error events: text-red-600

  Event entry pattern:
    → Loaded Brand Memory (v5)
    → [action performed]
    → [field touched if applicable]

  Stagger: 60ms CSS transition between events (not real async)
  transition: opacity 200ms ease-in

[Separator]

[Object links panel]
  Pills: Campaign [Truffle Burger Launch →]
         Assets [4 →]
         Memory rules added [2 →]
  Each pill: border border-zinc-200 bg-zinc-50 px-2 py-1 text-[12px]
  These persist for the browser session duration

[Separator — if palette is set]

[Active brand context chip]
  ●●●●● Burger Lab  brand.name  (swatches live from useBrand())
  "premium 72" pill
  If palette null: grey swatches + amber "incomplete" dot
```

---

## 11. States Catalog

### Loading States

| Component | Loading State |
|---|---|
| Workspace initial | Spinner + "Planning campaign…" (mono, zinc-500) |
| AssetCard grid | 4 `animate-pulse border h-40 rounded-sm` skeleton cards |
| SignalCard | 3 `bg-zinc-100 h-3 rounded` row placeholders |
| Identity directions | "Loading directions…" `text-[14px] text-zinc-400` |
| Brand save button | "Saving…" + disabled state |
| Auto-fix (round 2) | SignalCard overlay `bg-white/70` + spinner + "Running round 2…" |

### Empty States

| Surface | Empty State Copy |
|---|---|
| Workspace chat (first visit) | "Give me a goal and I'll plan the campaign" (zinc-400, mono, centred) |
| TracePanel (no run) | "No run yet." (zinc-600, mono, text-[12px]) |
| Brand page (no palette) | Amber banner: "Brand identity not set up yet — apply a direction below" |
| Products section (no products) | "No products yet. Add your menu items." (zinc-400, italic) |
| Preferences ChipList (empty) | "No preferences yet. Add style notes." (zinc-400, italic) |
| Do rules (empty) | "No Do rules yet — tell me what your brand always does." |
| Don't rules (empty) | empty state handled by ChipList default |
| Voice tone (not set) | Input placeholder: "e.g. confident-casual, urgent, warm" (zinc-400) |
| Brand completeness (`read` action) | "Brand identity is empty. Start by applying an identity direction." |
| Audit chip (no audits) | "No audit yet. Upload 2–5 assets to check consistency. [→ Run audit]" |
| Library (no assets) | "No assets yet. Start a campaign to generate assets." |
| `signal_match: null` | "Signal not checked" badge (bg-zinc-100 text-zinc-500 text-[11px]) |

### Error States

| Trigger | Error Surface | Copy |
|---|---|---|
| Campaign generation fails | Left: `type: "error"` block + Centre: amber card | "Could not generate campaign. [try again]" |
| Identity apply fails | Left: `type: "error"` block + Centre: amber retry card | "Could not apply direction. [try again]" |
| Memory rule append fails | Left block reverts to error, MemoryDiffCard hides | "Could not save rule. [retry]" |
| Memory patch fails | Left block reverts to error | "Could not update tone. [retry]" |
| Signal check fails | Badge in asset card | "Check failed" + [retry] |
| Auto-fix round 2 fails | Centre: amber card | "Auto-fix failed — vision service returned invalid JSON. Original score still valid: 62/100. [Retry auto-fix]" |
| Identity directions fail to load | Left block: text-amber-700 + Centre: amber card | "Could not load directions." + retry |
| `VisionNotConfiguredError` | SignalCard renders normally + amber banner | "heuristic fallback — AI key not configured" |

**Rule: Every error state has a retry action. No error is a dead end.**

### Confirmation States

| Action | Confirm Pattern | Location |
|---|---|---|
| Apply identity direction (via chat) | Multi-field diff card | Centre pane |
| Update BrandProfile multi-field (via chat) | Multi-field diff card | Centre pane |
| Update single field (via chat, e.g. voice.tone) | Inline confirm block | Left column |
| Append memory rule (via chat) | Optimistic — no confirm | N/A |
| Apply identity direction (direct on `/brand`) | None — user chose explicitly | N/A |
| Edit ChipList / sliders on `/brand` | Save button (dirty flag) | Left column of `/brand` |

---

## 12. Component → Schema Field Map

| Component | Schema field(s) read | Schema field(s) written |
|---|---|---|
| `AssetPreview` | `AssetOut.slots`, `AssetOut.knobs`, `BrandProfile.palette`, `BrandProfile.fonts` | none (local state for knob edits) |
| `AssetCard` | all `AssetPreview` fields + `signal_match`, `signal_verdict` | none |
| `SignalCard` | `SignalResult` (round, match, verdict, issue, evidence, detected, target, gaps) | none |
| `AutoFixResult` | two `SignalResult` objects + `FixKnobs` | none (Apply to asset: P1 `PATCH /library/:id`) |
| `BrandCard` | `BrandProfile.palette`, `.fonts`, `.positioning`, `.do`, `.dont`, `.preferences`, `.voice`, `.personality`, `.meaning` | none |
| `MemoryDiffCard` | `BrandProfile.dont` (or whichever field) | `POST /memory/rules` |
| `TracePanel` | dynamic (AI run trace events) | none |
| `ChipList` (do/dont/prefs) | `BrandProfile.do / .dont / .preferences` | via `patchMemory` on Save |
| `SliderRow` | `BrandProfile.positioning` | via `patchMemory` on Save |
| `BrandIdentityCard` | `BrandProfile.palette`, `.fonts` | none |
| Identity direction card | `IdentityDirection.palette`, `.fonts`, `.meaning` | `POST /identity/apply` |
| Products editor | `BrandProfile.products` | via `patchMemory` on Save |
| Voice tone input | `BrandProfile.voice.tone` | via `patchMemory` on blur |
| Palette swatch color picker | `BrandProfile.palette[key]` | via `patchMemory` on close |

---

## 13. Invariants — Never Break These

1. **`BrandProfile` writes from chat always fire `setBrand(updated)`** → `BrandEditorInner` remounts via `key={brand.id}:${brand.version}`. Unsaved dirty state in Brand.jsx is discarded by design.

2. **`signal_match: null` always renders `"Signal not checked"` badge** — never empty space. This is a hard requirement on every `AssetCard`.

3. **`VisionNotConfiguredError` never produces a 503 to the frontend.** The router returns `SignalResult` with `match=50, verdict="needs_fix", issue="heuristic fallback — AI key not configured"`. The frontend renders it as a valid result with amber badge.

4. **`AssetPreview` always takes `palette` and `fonts` from `useBrand()` context, never from a static mock import.** Any `import brandData from 'mock/brand.json'` inside `AssetCard` or `AssetPreview` is a bug (the "Amnesia Loop").

5. **Every `dont` rule word is checked against `_headline()` output** in `asset_gen.py` before the campaign returns. If a dont word appears in the headline, fall back to `brand.name`.

6. **`dna_source: "heuristic"` always surfaces as a visible badge** in TracePanel: `"Brand DNA: heuristic fallback [no AI key configured]"` in `text-amber-600`. Never silently degrade.

7. **Every confirmation (diff card or inline confirm block) has a Cancel path.** No confirm is one-way.

8. **No AI action type generates an empty centre pane.** Every action type maps to at least one component rendering in the centre column — `BrandCard`, `SignalCard`, `CampaignOut`, `MemoryDiffCard`, or an error card.

---

## 14. Mobile Behaviour

Single-column layout (< 1024px). Left column (chat + AskBar) renders only. After campaign generates: bottom sheet slides up (`h-[70dvh]`, fixed bottom, slide-up animation `translate-y-0`). Bottom sheet contains the Results pane — the same asset grid as the centre column. TracePanel is omitted on mobile. Brand context strip collapses to brand name + single swatch row.

AskBar on mobile: full-width, `pb-safe` for notch devices. Send button `44×44px` touch target minimum.

---

## 15. Key File Locations

| Feature | File |
|---|---|
| Workspace layout + chat | `/frontend/src/pages/Workspace.jsx` |
| Agent hook | `/frontend/src/hooks/useAgent.js` |
| Brand context | `/frontend/src/context/BrandContext.jsx` |
| AssetPreview (CSS mockup) | `/frontend/src/components/AssetPreview.jsx` |
| AssetCard (campaign grid) | `/frontend/src/components/AssetCard.jsx` |
| SignalCard | `/frontend/src/components/SignalCard.jsx` |
| SignalCheckPanel | `/frontend/src/components/SignalCheckPanel.jsx` |
| Brand page | `/frontend/src/pages/Brand.jsx` |
| BrandEditorInner | inside Brand.jsx (`key={brand.id}:${brand.version}`) |
| ChipList | `/frontend/src/components/ChipList.jsx` |
| SliderRow | `/frontend/src/components/SliderRow.jsx` |
| TracePanel | `/frontend/src/components/TracePanel.jsx` |
| API client | `/frontend/src/lib/api.js` |
| Signal check router | `/backend/routers/signal.py` |
| Campaign generator | `/backend/asset_gen.py` |
| Vision LLM | `/backend/vision.py` |
| Brand DNA | `/backend/brand_dna.py` |
| Identity templates | `/backend/identity.py` |
| Schemas | `/backend/schemas.py` |

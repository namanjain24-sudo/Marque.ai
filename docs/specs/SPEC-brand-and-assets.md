# Marque.ai — Pillar Specs: Brand Builder + Asset Creator

> Ground truth: `backend/schemas.py`, `backend/asset_gen.py`, `frontend/src/App.jsx`.
> Every endpoint listed here either exists or is a named P0 gap. Schema extends only at P1+.
> Demo brand throughout: **Burger Lab** (Delhi, Restaurant, premium=72, modern=65, playful=58).

---

## PILLAR 1 — Brand Builder

Four features share one surface: `/brand` (the Brand page) + the Workspace chat column. They are not separate pages. The chat is where instructions land; `/brand` is where results persist and can be edited directly.

---

### F1 — Capture

**Purpose:** Collect the business identity fields that seed all downstream AI. Happens at onboarding and is re-editable on `/brand`. No AI needed — `brand_dna.py` deterministically derives `positioning`, `do`, `dont`, and `voice.tone` from the inputs.

**UX Flow (conversation-first):**

At `/brand`, the left column shows editable Capture fields. A "Products" section is a P0 gap — it does not yet exist. P0 adds it so the demo brand can show products in campaigns.

Direct-manipulation path (P0):
1. User opens `/brand`, sees "Products" section (to be added).
2. Clicks "Add product" → blank row appends with auto-focus on `name` input.
3. Enters `Truffle Burger`, tabs to price, enters `399`.
4. Clicks "Save to Brand" → `PATCH /v1/brands/{id}/memory` with updated `products` array.
5. `setBrand(updated)` fires, `BrandEditorInner` remounts via `key={brand.id}:${brand.version}`, toast "Saved to Brand Memory."

Chat path (P1 — intent classifier required):
- User says "Add truffle burger at ₹399 to our menu" in Workspace.
- Agent classifies as `capture_product_add`.
- Fires `api.patchMemory(brandId, { products: [...existing, { name: "Truffle Burger", price: 399 }] })`.
- Left column: `type: "write"` block — "Added Truffle Burger ₹399 to products."
- No confirmation required (non-destructive append).

**Data Schema (no extensions needed):**

```python
# Existing in schemas.py — reuse as-is
class ProductIn(BaseModel):
    name: NameStr          # strip_whitespace, max 200
    price: float | None    # ge=0, optional
    photo: ShortStr | None # max 300, optional

class BrandProfile(BaseModel):
    products: list[ProductIn] = Field(default_factory=list, max_length=100)
    # ...all other fields unchanged
```

**Endpoints / Actions:**

| Action | Method | Endpoint | Body |
|---|---|---|---|
| Load brand | GET | `/v1/brands/{id}` | — |
| Save capture fields | PATCH | `/v1/brands/{id}/memory` | `BrandMemoryPatch` |
| Append product (P1 chat) | PATCH | `/v1/brands/{id}/memory` | `{ products: [...] }` |

`PATCH /v1/brands/{id}/memory` already accepts `products: list[ProductIn]`. No new endpoints.

**AI Seam:**

P0: None — purely form-based. `brand_dna.propose_positioning`, `propose_do_dont`, `propose_tone` run deterministically on brand creation (already wired in `POST /v1/brands`).

P1: Intent classifier routes "add [product] at ₹N" to `capture_product_add` action without confirmation.

**P0 vs Vision:**

P0: Product CRUD on `/brand` (add/remove rows, save via `patchMemory`). ~1.5h, no backend changes.
Vision: Chat-driven product add, photo upload per product, product archiving, product categories.

**Acceptance Criteria:**

- `/brand` shows "Products" section listing `brand.products` as editable rows (name text input, price number input, remove button).
- "Add product" appends a blank row, auto-focused on `name`.
- "Save to Brand" includes updated `products` in `patchMemory` call.
- Empty state: "No products yet. Add your menu items." in `text-zinc-400 italic text-[13px]`.
- `brand.version` increments after save; `BrandEditorInner` remounts via its `key`.
- Error: toast "Could not save." in `amber-700`, products section stays dirty.

**Reuse:**

- `ChipList.jsx` pattern for row management — no, simpler: plain `<input>` rows with `useState` array
- `api.patchMemory()` — already in `api.js`
- `useBrand()` + `setBrand()` — already wired in `Brand.jsx`
- `useToast` + `showToast` — already imported in `Brand.jsx`
- `BrandEditorInner` remount pattern via `key={brand.id}:${brand.version}` — already in place

---

### F2 — Memory

**Purpose:** Maintain persistent `do`, `dont`, `preferences`, `voice.tone` rules that are injected into every generation prompt. These are the rails that prevent the "Amnesia Loop" — generating generic copy that ignores brand constraints.

**UX Flow (conversation-first):**

Append path (chat, no confirmation):
1. User says "Never use the word 'fresh' in our copy."
2. Agent classifies as `memory_append` on `dont`. Optimistically renders `type: "memory"` block.
3. Fires `POST /v1/brands/{id}/memory/rules` body `{ field: "dont", value: "Never use the word 'fresh'" }`.
4. Centre pane shows `MemoryDiffCard`: existing rules greyed, new rule with `border-l-2 border-emerald-500`.
5. On API success: `setBrand(updated)`. On failure: block reverts to `type: "error"`.

Update path (chat, confirmation required for single-field mutations):
1. User says "Change our voice tone to urgent and direct."
2. Agent shows inline `type: "confirm"` block: `voice.tone: "" → "urgent and direct"` with Apply/Cancel.
3. On Apply: `PATCH /v1/brands/{id}/memory` body `{ voice: { language: "Hinglish", tone: "urgent and direct" } }`.
4. On success: `setBrand(updated)`, block transforms to `type: "write"` showing the change.

Direct-manipulation path (P0, `/brand`):
- `do` / `dont` lists: existing `ChipList` components, save via `patchMemory` on "Save to Brand".
- `preferences` list: P0 gap — add a third `ChipList` below Don't. Same component, same save path.
- `voice.tone`: P0 gap — replace read-only `<dd>` with `<input type="text">`, auto-save on blur via `api.patchMemory(id, { voice: { ...brand.voice, tone: newTone } })`.

**Memory Injection Spec (P0 fix required in `asset_gen.py`):**

Every generation must inject the full memory context. Currently `asset_gen.py` does not use `do`, `dont`, `preferences`, or `voice.tone`. P0 thin fix: in `_headline()`, check if any word from `brand.dont` rules appears in the generated headline — if so, fall back to `brand.name`. Full injection into LLM system prompt is P1 (Phase 2).

```python
# P0 fix in asset_gen._headline():
def _headline(goal: str, brand: BrandProfile) -> str:
    # ... existing logic ...
    headline = (first or text)[:60].strip()
    headline = headline[:1].upper() + headline[1:] if headline else brand.name
    # P0 dont-rule guard: if any dont-word appears in the headline, fall back
    headline_lower = headline.lower()
    for rule in brand.dont:
        for word in rule.lower().split():
            if len(word) > 3 and word in headline_lower:
                return brand.name
    return headline if headline else brand.name

# P1 full injection (in LLM system prompt template):
MEMORY_INJECTION = """Brand: {name} ({category})
Voice: {voice_tone}
Personality: {personality}
Do: {do_rules}
Don't: {dont_rules}
Preferences: {preferences}
"""
```

**Data Schema (no extensions needed):**

```python
# Existing in schemas.py — reuse as-is
class MemoryRuleAppend(BaseModel):
    field: Literal["do", "dont", "preferences"]
    value: RuleStr  # max 200 chars

class BrandMemoryPatch(BaseModel):
    do: list[RuleStr] | None
    dont: list[RuleStr] | None
    preferences: list[RuleStr] | None
    voice: Voice | None
    # ... all other BrandProfile fields patchable
```

**Endpoints / Actions:**

| Action | Method | Endpoint | Body |
|---|---|---|---|
| Bulk memory edit | PATCH | `/v1/brands/{id}/memory` | `BrandMemoryPatch` |
| Append single rule | POST | `/v1/brands/{id}/memory/rules` | `MemoryRuleAppend` |

Both endpoints exist. No new backend needed for P0.

**AI Seam:**

P0: No AI — purely form-based CRUD. Memory injection into `_headline()` is a deterministic guard (no LLM).
P1: Intent classifier routes memory-change phrases to `memory_append` or `memory_patch` actions. Full memory injected into LLM system prompt for campaign generation (Phase 2 copywriter).

**P0 vs Vision:**

P0: Preferences ChipList, voice.tone input (auto-save), dont-rule guard in `_headline()`. ~50min total.
Vision: AI-driven rule suggestions ("You said X — want me to add that as a Don't rule?"), rule conflict detection, memory versioning diff viewer.

**Acceptance Criteria:**

- `voice.tone` is an editable `<input type="text">` in the Voice section (not read-only), auto-saves on blur.
- Input placeholder: "e.g. confident-casual, urgent, warm".
- "Preferences" ChipList visible below Don't section, saves via `patchMemory`.
- Preferences empty state: "No preferences yet. Add style notes."
- `_headline()` in `asset_gen.py` guards against dont-rule words; falls back to `brand.name` on match.
- `PATCH /v1/brands/{id}/memory` with `voice` field round-trips correctly.

**Reuse:**

- `ChipList.jsx` — already used for Do/Don't, reuse identically for Preferences
- `SliderRow.jsx` — already used for Positioning
- `useToast` / `showToast` — already in Brand.jsx
- `api.patchMemory()` — already in api.js
- `asset_gen._headline()` — add dont guard, no interface change

---

### F3 — Identity

**Purpose:** Set the visual system (`palette`, `fonts`, `meaning`) from curated templates. `identity.py` proposes the 2 nearest templates via cosine similarity on `positioning`. The user applies one direction — which locks the visual system into Brand Memory and propagates to every `AssetPreview` render.

**UX Flow (conversation-first):**

Read path (no confirmation):
1. User says "Which identity direction should we go with?" in Workspace.
2. Agent classifies as `read` action on `identity_directions`. Acts immediately.
3. Calls `GET /v1/brands/{id}/identity`. Returns 2 `IdentityDirection` objects.
4. Centre pane: two direction cards side by side — swatch row (5 × `h-8 w-8` circles), font specimen, positioning bars, "Apply this direction" button.
5. Left column: `type: "read"` block with swatches + font names. Right column: TracePanel shows "Fetched 2 identity directions."

Apply path via chat (confirmation required — writes BrandProfile):
1. User says "Apply the bold direction."
2. Agent classifies as `confirm` action. Shows diff card in centre pane — current palette/fonts null vs proposed values.
3. User clicks "Apply direction" in diff card.
4. Calls `POST /v1/brands/{id}/identity/apply` body `{ key: "bold_typographic", fields: null }`.
5. On success: `setBrand(updated)`. Centre pane re-renders with "Current" chip on applied card. Brand context strip in left column updates grey circles to real palette swatches.

Apply path via direct manipulation (no confirmation):
1. User on `/brand`, clicks "Apply this direction" button on a direction card.
2. Calls `applyIdentity(brand.id, key)` directly (existing function in Brand.jsx).
3. On success: `setBrand(updated)` + `showToast("Applied the '...' direction.")`.
4. No diff card — user explicitly chose the card they were already looking at.

Partial apply (P1):
- "Take palette only" → `api.applyIdentity(id, key, ["palette"])`
- "Take fonts only" → `api.applyIdentity(id, key, ["fonts"])`
- Uses `IdentityApply.fields: list[Literal["palette", "fonts"]] | None` (already in schema)

**Data Schema (no extensions needed):**

```python
# Existing in schemas.py
class IdentityDirection(BaseModel):
    key: str
    palette: Palette
    fonts: Fonts
    meaning: dict[str, str]

class IdentityApply(BaseModel):
    key: str
    fields: list[Literal["palette", "fonts"]] | None = None  # None = apply all

class Palette(BaseModel):
    primary: HexColor
    secondary: HexColor
    accent: HexColor
    light: HexColor = "#FFFFFF"
    dark: HexColor = "#0B0B0B"

class Fonts(BaseModel):
    heading: str  # e.g. "Bebas Neue"
    body: str     # e.g. "Inter"
```

**Endpoints / Actions:**

| Action | Method | Endpoint | Body |
|---|---|---|---|
| Load directions | GET | `/v1/brands/{id}/identity` | — |
| Apply direction | POST | `/v1/brands/{id}/identity/apply` | `IdentityApply` |
| Edit palette swatch | PATCH | `/v1/brands/{id}/memory` | `{ palette: Palette }` |
| Edit photo style | PATCH | `/v1/brands/{id}/memory` | `{ photo_style: str }` |

**P0 Gaps in Brand.jsx:**

1. **Palette swatch color picker:** clicking any swatch opens `<input type="color">` pre-filled with current hex. On close (blur/change): `api.patchMemory(id, { palette: { ...brand.palette, [swatchKey]: newHex } })`. Toast "Palette updated." on success.

2. **Photo style input:** `BrandProfile.photo_style: ShortStr | None` is never surfaced. Add a text input below Fonts section. Auto-save on blur via `patchMemory({ photo_style })`. Placeholder: "e.g. dark, moody, close-up product shots".

3. **Partial apply buttons (P1):** "Take palette only" / "Take fonts only" links under each direction card.

**AI Seam:**

P0: No AI — `identity.py` uses deterministic cosine similarity on 5 curated templates. Works fully offline.
P1: Chat-driven identity suggest: "make us more premium-looking" → shift `positioning.premium` → re-run `GET /identity` → show new top-2 directions as diff card in centre pane.

**P0 vs Vision:**

P0: Palette color picker (native `<input type="color">`), photo style input, partial-apply links. ~1h, no backend changes.
Vision: Live preview of direction before applying, LLM-assisted custom palette generation from a brand URL, meaning map editor.

**Acceptance Criteria:**

- Clicking any palette swatch opens a native color picker pre-filled with current hex.
- On picker close, `patchMemory({ palette: { ...brand.palette, [key]: newHex } })` fires.
- Toast "Palette updated." on success; "Could not update palette." on error.
- "Apply palette only" and "Apply fonts only" links visible under each direction card (P1 — can be stubbed as disabled in P0).
- Photo style: text input visible below fonts section, auto-saves on blur.
- Applied direction shows "Current" chip when `brand.palette.primary === dir.palette.primary && brand.fonts.heading === dir.fonts.heading`.
- `AssetPreview` receives `palette` and `fonts` from `useBrand()` context, never from `mock/brand.json`.

**Reuse:**

- `BrandIdentityCard.jsx` — existing card component, add partial-apply buttons in P1
- `applyDirection(key)` in Brand.jsx — existing, no change
- `SWATCH_KEYS` + swatch `<span>` elements in Brand.jsx — add `onClick` + hidden `<input type="color">`
- `api.applyIdentity(id, key, fields?)` — already in api.js; `fields` param may need adding
- `useBrand()` / `setBrand()` — already wired throughout

---

### F4 — Signaling

**Purpose:** Run an uploaded image through the vision LLM critic to score how well it matches `BrandProfile.positioning` targets. Returns `SignalResult` with match score, verdict, per-axis gaps, evidence, and suggested fix knobs. The auto-fix loop (round 2) was cut per SPEC-00-roadmap.md.

**UX Flow (conversation-first):**

Signal check via chat:
1. User says "Check the signal on our truffle burger poster."
2. Agent classifies as `evaluate` action. No image available → fires `type: "clarify"` block with embedded drop zone (80px tall, dashed border, `accept="image/*"`).
3. User uploads image. Block shows spinner "Checking signal…". Calls `POST /v1/brands/{id}/signal-check` multipart.
4. Centre pane: `SignalCard` renders with match score, verdict chip, per-axis bars (detected vs target), evidence list with 60ms stagger fade-in, issue string.
5. Left column block transforms to `type: "evaluate"` showing summary: score, verdict, top gap.

Signal check from asset grid (direct manipulation, no chat):
1. `AssetOut` with `signal_match: null` shows "Signal not checked" badge.
2. User hovers asset card → "[Re-check signal]" button appears.
3. On click: rasterize `AssetPreview` DOM node → Blob, call `POST /signal-check`.
4. Badge updates in-place: "78 / pass" or "62 / needs_fix". No chat message generated.

**Heuristic Fallback (P0 fix required in `routers/signal.py`):**

Currently `VisionNotConfiguredError` propagates as HTTP 503. Fix: catch it and return a valid `SignalResult` with amber badge metadata.

```python
# P0 fix in routers/signal.py:
except VisionNotConfiguredError:
    return SignalResult(
        round=round_num,
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

Frontend renders this normally but shows amber badge: `bg-amber-50 border border-amber-200 px-3 py-1 text-[12px] text-amber-700` — "heuristic fallback — AI key not configured". Never a 503, never empty space.

**Last Audit Chip on `/brand` (P0 gap):**

Right column of Brand.jsx, below positioning sliders: show last audit consistency score.

```
Last audit: 3 days ago
Consistency: 74 / 100
[→ Run audit]  [→ View full report]
```

- `api.listAudits(brandId)` on mount; take `audits[0]` if exists.
- If no audits: "No audit yet. Upload 2-5 assets to check consistency. [→ Run audit]"
- "Run audit" links to `/audit`. ~30min, no backend changes.

**Data Schema (no extensions needed):**

```python
# Existing in schemas.py
class SignalResult(BaseModel):
    round: int            # 1 or 2
    detected: Positioning # what the vision LLM scored
    target: Positioning   # brand.positioning targets
    gaps: SignalGaps      # detected - target, signed
    match: int            # 0-100, computed in code (never from LLM)
    verdict: Literal["pass", "needs_fix"]
    issue: str
    evidence: list[str]
    fix: FixKnobs         # suggested knob deltas

class SignalGaps(BaseModel):
    premium: int   # ge=-100, le=100, signed
    modern: int
    playful: int
    niche: int
```

**Endpoints / Actions:**

| Action | Method | Endpoint | Body |
|---|---|---|---|
| Signal check | POST | `/v1/brands/{id}/signal-check` | multipart: `image`, `round` |
| List audits | GET | `/v1/brands/{id}/audits` | — |

`POST /v1/brands/{id}/signal-check` exists in `routers/signal.py`. The fix is adding the `VisionNotConfiguredError` fallback only.

**AI Seam:**

P0 (real): `vision.py` `check_signals()` — real vision LLM via OpenRouter. Strict Pydantic output schema, temperature 0, retry-once on invalid JSON. The crown jewel.
P0 (fallback): `match=50, verdict="needs_fix"` with explicit amber badge when key absent.
P1 (cut): auto-fix round 2 was explicitly cut per SPEC-00-roadmap.md.

**P0 vs Vision:**

P0: Router-level heuristic fallback, last audit chip on `/brand`, "Signal not checked" badge on all new `AssetOut` cards.
Vision: Auto-fix loop (cut), batch signal check, trend over time, signal check embedded in editor.

**Acceptance Criteria:**

- `VisionNotConfiguredError` returns `SignalResult` with `match=50`, never HTTP 503.
- Frontend renders heuristic result with amber badge "heuristic fallback — AI key not configured".
- Every `AssetOut` with `signal_match: null` shows "Signal not checked" badge — never empty space.
- "[Re-check signal]" on hover fires signal check inline without opening chat.
- Badge updates in-place after check: "78 / pass" or "62 / needs_fix".
- Last audit chip visible on `/brand` right column.

**Reuse:**

- `SignalCheckPanel.jsx` + `SignalCard.jsx` — fully built, reuse as-is
- `checkSignal` in `api.js` — already fires the multipart POST
- `vision.py` `check_signals()` — no change needed
- `rasterize.js` — for DOM→Blob for the inline re-check path (may need creating if absent)
- `AuditRecord` + `api.listAudits()` — backend route for audit history

---

## PILLAR 2 — Asset Creator

Two features: the generation engine (F5) that turns a brand + goal into 4 `AssetOut` objects, and the Universal Editor (F8/editor) that renders and allows in-place editing of those assets.

---

### F5 — Asset Generation Engine

**Purpose:** ONE generic engine. `generate_campaign` in `asset_gen.py` takes `BrandProfile + goal` and returns a `CampaignOut` with 4 `AssetOut` objects (poster, Instagram post, story, WhatsApp creative). Currently deterministic regex; P1 replaces the copy pass with an LLM call behind the same function signature.

**UX Flow (conversation-first):**

The canonical flow — "Create a launch poster for our truffle burger at ₹399":

Step 1 — User submits goal in Workspace AskBar:
- User bubble right-aligned in left column.
- AskBar clears, send button disables.
- `useAgent.run()` fires → `POST /v1/brands/{id}/agent/run` body `{ goal: "..." }`.

Step 2 — Price present → no clarification needed:
- Left column: `type: "thinking"` block with spinner + "Planning your campaign…"
- Centre pane: spinner centred + "Planning campaign…" mono text.
- Right column TracePanel starts streaming (60ms CSS stagger):
  - "Loaded Brand Memory (v5)"
  - "Palette: #E63946 / #212121 / #F4A261"
  - "Dont rule applied: 'Never use green as primary'"
  - "Voice: Hinglish · urgent and direct"
  - "Positioning target: premium 72 · playful 58"
  - "Generated 4 assets"
  - "Campaign ready"

Step 3 — `POST /agent/run` resolves:
- Left column: `type: "generate"` block:
  ```
  ✦ Generated campaign  [chip: "Truffle Burger Launch"]
    4 assets · Draft · ₹399
    [→ View in Campaigns]  [→ Open in Editor]
  ```
- Centre pane: full `CampaignOut` render — campaign header + 4 `AssetCard` components in `grid gap-5 sm:grid-cols-2 lg:grid-cols-4`.
- Each `AssetCard` shows `AssetPreview` with live palette + fonts from `useBrand()` context.

Missing price — clarification:
- If `_extract_price(goal)` returns None and brand has products: `question` state fires.
- Left column: `type: "clarify"` block — "What's the price point for this item?" with pre-filled input (average of existing product prices as placeholder).
- Centre pane: unchanged. Only one question asked per turn.

**Generation Contract (`asset_gen.py` — current P0 heuristic):**

```python
def generate_campaign(brand: BrandProfile, goal: str, *, today: str) -> dict:
    price = _extract_price(goal)          # regex: ₹NNN or bare number
    headline = _headline(goal, brand)     # strip price, cap 60 chars, dont-guard
    subline = ...                         # "This week only · ₹399" or category
    core_message = ...                    # headline + price + "Limited time"
    base = _base_knobs(brand)             # positioning-derived knob set
    assets = [4 AssetOut dicts]           # poster/post/story/whatsapp
    return CampaignOut dict
```

P1 LLM upgrade (Phase 2 from SPEC-00-roadmap.md): replace `_headline()` + `_slots_for()` with one LLM call that takes `goal + full brand profile (voice, do, dont, positioning, products)` and returns `{ headline, subline, price, cta }` per slot. Same output schema — the renderer doesn't change. Key absent → current regex fallback. Facts rule enforced in Python: price/discount/dates come only from `goal`; model never invents an offer.

**Data Schema (no extensions needed):**

```python
# Existing in schemas.py
class AssetOut(BaseModel):
    id: str
    type: Literal["poster", "post", "story", "whatsapp"]
    label: str               # "Poster", "Instagram post", etc.
    size: str                # "1080×1350", "1080×1080", "1080×1920"
    signal_match: int | None # null until Signal Check runs
    signal_verdict: Literal["pass", "needs_fix"] | None
    slots: AssetSlots
    knobs: AssetKnobs

class AssetSlots(BaseModel):
    headline: str = ""
    subline: str = ""
    price: str | None = None
    cta: str = ""
    logo: str = ""
    hero_image: str | None = None  # always null in P0 — renderer draws gradient

class AssetKnobs(BaseModel):
    density: DensityT = "balanced"         # "open"|"balanced"|"dense"
    font_style: FontStyleT = "display_bold" # "display_bold"|"serif_elegant"|"clean_sans"
    photo_tone: PhotoToneT = "warm"        # "warm"|"dark"|"cool"
    accent_usage: float = 0.6             # 0.3-0.85
    overlay: float = 0.4                  # 0.2-0.8
    layout_variant: LayoutVariantT = "left" # "left"|"center"|"split"

class CampaignOut(BaseModel):
    id: str
    name: str
    objective: str
    core_message: str
    status: str       # "Draft" at creation
    date: str         # ISO date
    assets: list[AssetOut]
```

**Endpoints / Actions:**

| Action | Method | Endpoint | Body |
|---|---|---|---|
| Run campaign generation | POST | `/v1/brands/{id}/agent/run` | `AgentRunIn` |
| Fetch campaign | GET | `/v1/campaigns/{id}` | — |
| List campaigns for brand | GET | `/v1/brands/{id}/campaigns` | — |

`AgentRunIn.goal: str` (1-500 chars). The agent router calls `generate_campaign` and persists to `campaigns` + `assets` tables.

**AI Seam:**

P0 (current): Deterministic regex in `asset_gen.py`. `_headline()` strips price, caps 60 chars, now guards against `dont` words. `_base_knobs()` derives style from `positioning`. No LLM call, instant, works offline.

P1 (Phase 2): LLM copywriter call behind `if OPENROUTER_API_KEY` gate. Same function signature. Full memory injected (voice, do, dont, preferences, personality, products). Facts rule in Python layer. Retry-once on invalid JSON (same pattern as `vision.py`). Zero-credit mocked tests: happy path, bad-JSON retry, fallback-on-failure, facts rule (no price in goal → placeholder, never hallucinated number).

**P0 vs Vision:**

P0: Fix `AssetPreview` to take `palette` / `fonts` from `useBrand()` context (not mock import), dont-guard in `_headline()`, campaign persists and shows in `/campaigns`.
Vision: LLM copywriter (Phase 2), per-format copy variants, multiple campaign directions (A/B), real hero image via image generation model (backgrounds only — text stays HTML/CSS per brief constraint).

**Acceptance Criteria:**

- `POST /agent/run` returns `CampaignOut` in <500ms (deterministic, no LLM).
- `AssetPreview` uses `palette` and `fonts` from `useBrand()` context, never from `mock/brand.json` or static import. This is the root fix for the "Amnesia Loop."
- `AssetOut.signal_match: null` always renders "Signal not checked" badge — never empty space.
- `dont` rules checked in `_headline()` — headline never contains words from any dont rule.
- Generated campaign persists and appears in `/campaigns` list.
- Error state: if `POST /agent/run` fails, left column shows `type: "error"` block with retry; centre pane shows amber error card.
- Missing price: `type: "clarify"` block with single input question fires before generation.

**Reuse:**

- `asset_gen.generate_campaign()` — add dont guard, no signature change
- `knobs.py` `KNOB_VALUES` — single source of truth for knob enum values, never duplicated
- `routers/agent.py` — existing, routes POST to generate_campaign + persists
- Workspace.jsx `useAgent` hook — existing, calls POST and sets `campaign` state
- `AssetCard.jsx` — add `palette` + `fonts` props, stop importing from mock
- `AssetPreview.jsx` — take `palette` + `fonts` as props from parent context

---

### F8 (light) — Universal Editor + Asset Schema

**Purpose:** Every generated `AssetOut` is editable. Two modes: (a) in-place editing on the `AssetCard` in the campaign grid (headline, knob sliders — local state only, no API); (b) full-screen editor at `/editor/:assetId` with slot editing, knob controls, signal re-check, and export. Text is always HTML/CSS (never drawn by image model). The editor is not a canvas — it is a structured slot editor.

**UX Flow:**

In-place editing (no chat, local state only):
1. User hovers `AssetCard` → slot values become `contenteditable` with Tailwind focus ring.
2. User edits headline inline. Local state updates immediately. No network call.
3. Knob sliders appear on hover (density, overlay, layout_variant, accent_usage). Moving a slider updates `AssetKnobs` in local state → `AssetPreview` re-renders via CSS. No network call.
4. "[Re-check signal]" button fires signal check with the modified knobs' rendered output.
5. "Regenerate with AI" button (clearly labeled) sends modified `AssetKnobs` back to agent (P1 — disabled in P0 with tooltip "Coming soon").

Full-screen editor at `/editor/:assetId`:
1. User clicks "[Edit →]" on an asset card → navigates to `/editor/:assetId`.
2. Editor loads `LibraryAsset` or campaign asset by ID.
3. Left panel: slot editor (`headline`, `subline`, `price`, `cta`, `logo` inputs with character counts).
4. Centre: full-size `AssetPreview` live-updates as slots change.
5. Right panel: knob controls (sliders for overlay/accent_usage, segmented controls for density/font_style/photo_tone/layout_variant), signal check result chip.
6. Top bar: format selector (switch between poster/post/story/whatsapp — re-renders same slots in different aspect ratio), export button.

**Data Schema:**

The `AssetOut` schema covers generation-time assets. `LibraryAsset` covers persisted (saved-on-check) assets. For the editor, we need to address both sources cleanly:

```python
# Existing in schemas.py — no change needed for P0
class LibraryAsset(BaseModel):
    id: str
    brand_id: str
    source: Literal["upload", "rendered"] = "upload"
    type: AssetTypeT = "other"
    label: str = ""
    png_url: str | None = None       # for uploaded assets
    signal_match: int | None = None
    signal_verdict: Literal["pass", "needs_fix"] | None = None
    slots: AssetSlots | None = None  # for rendered assets
    knobs: AssetKnobs | None = None  # for rendered assets
    created_at: datetime

# P1 schema extension: add mutable knob/slot save endpoint
# PATCH /v1/library/{asset_id} body: { slots?: AssetSlots, knobs?: AssetKnobs }
# Returns: LibraryAsset (updated)
```

The editor works with local state for P0 — no save-back to the database. The "Apply to asset" button is disabled with tooltip "Saving to Library coming soon." P1 adds `PATCH /v1/library/{asset_id}`.

**Knob Vocabulary (single source of truth — `knobs.py`):**

```python
KNOB_VALUES = {
    "density": ["open", "balanced", "dense"],
    "font_style": ["display_bold", "serif_elegant", "clean_sans"],
    "photo_tone": ["warm", "dark", "cool"],
    "layout_variant": ["left", "center", "split"],
}
OVERLAY_RANGE = (0.2, 0.8)    # continuous float
ACCENT_RANGE = (0.3, 0.85)    # continuous float
```

The frontend renderer (`AssetPreview.jsx`) must consume exactly these values. Any knob name mismatch between backend and frontend is a P0 bug. `knobs.py` is the contract.

**Endpoints / Actions:**

| Action | Method | Endpoint | Body | Status |
|---|---|---|---|---|
| Load asset | GET | `/v1/library/{asset_id}` | — | Exists |
| Load campaign asset | GET | `/v1/campaigns/{id}` | — | Exists (returns CampaignOut with assets[]) |
| Save knob/slot edits | PATCH | `/v1/library/{asset_id}` | `{ slots?, knobs? }` | P1 — disabled in P0 |
| Signal check | POST | `/v1/brands/{id}/signal-check` | multipart | Exists |
| Export (PNG) | GET | `/v1/library/{asset_id}/export` | — | Vision — cut for P0 |

**AI Seam:**

P0: No AI in the editor. Knob changes and slot edits are local state → immediate CSS re-render. "Re-check signal" fires the existing vision LLM signal check.
P1: "Regenerate with AI" sends `AssetKnobs` delta back to agent + re-runs copy pass with modified style constraints. Chat integration: "make the poster more premium" → agent proposes `knob_delta` targeting the poster asset.

**AssetPreview.jsx Rendering Contract:**

`AssetPreview` is the CSS renderer. It must accept and use these props:
- `slots: AssetSlots` — text content
- `knobs: AssetKnobs` — style values  
- `palette: Palette` — from `useBrand()` — **never from mock import**
- `fonts: Fonts` — from `useBrand()` — **never from mock import**

The gradient background uses `palette.primary` and `palette.secondary`. Text color uses `palette.light` or `palette.dark` based on overlay darkness. Font family uses `fonts.heading` for `headline` and `fonts.body` for `subline`/`cta`. `hero_image: null` → gradient rendered, no broken image icon.

**P0 vs Vision:**

P0: In-place `contenteditable` slot editing on `AssetCard`, knob sliders on hover (local state only), `AssetPreview` wired to `useBrand()` context, "Signal not checked" badge. `/editor/:assetId` can render read-only for P0.
Vision: Full slot editor in `/editor/:assetId`, save-back to library (`PATCH /library/{id}`), format switcher, export PNG, undo/redo, version history, multi-select for batch export.

**Acceptance Criteria:**

- `AssetPreview` accepts `palette` + `fonts` as required props; never imports from `mock/brand.json`.
- `headline`, `subline`, `price`, `cta` slots are `contenteditable` on hover in `AssetCard`.
- Knob sliders (density, overlay, accent_usage, layout_variant) appear on hover; updates are local state only, no API call.
- CSS gradient uses `palette.primary` + `palette.secondary` from `useBrand()`.
- `hero_image: null` renders gradient — no broken image.
- `/editor/:assetId` route renders the asset (read-only P0, editable P1).
- Knob vocabulary matches `knobs.py` exactly — no discrepancy between backend enum values and frontend prop values.
- "Apply to asset" button in editor is disabled with tooltip "Saving to Library coming soon" for P0.

**Reuse:**

- `AssetPreview.jsx` — change import path from mock to props, wire `palette` + `fonts` as required props
- `AssetCard.jsx` — add `contenteditable` on slot spans, add knob slider panel on hover
- `knobs.py` — backend source of truth; frontend must mirror the enum values exactly
- `Editor.jsx` — existing page, currently stub; wire to load asset from route param
- `SignalCard.jsx` — reuse for signal result display in editor right panel
- `useBrand()` context — provides `palette` + `fonts` to the entire component tree

---

## Shared Invariants (across both pillars)

These must never be broken by any P0 or P1 build:

1. **`BrandProfile` writes always fire `setBrand(updated)`** → `BrandEditorInner` remounts via `key={brand.id}:${brand.version}`. Unsaved dirty state in Brand.jsx is intentionally discarded on version bump — this is specified behavior, not a bug.

2. **`signal_match: null` always renders "Signal not checked" badge** — `bg-zinc-100 text-zinc-500 text-[11px] px-2 py-0.5` — never empty space, never a hidden field.

3. **`VisionNotConfiguredError` never propagates as HTTP 503** — the router returns a valid `SignalResult` with amber badge metadata. The frontend always has a renderable result object.

4. **`AssetPreview` always takes `palette` and `fonts` from `useBrand()` context** — never from a static mock import. The static mock exists for development only; any production render must use live brand data.

5. **`dont` rules are checked in `_headline()` before any campaign is returned** — if any word from any dont rule appears in the generated headline, fall back to `brand.name`. This is the P0 thin fix that makes Memory non-inert.

6. **`dna_source: "heuristic"` always surfaces as an amber badge** in the TracePanel: "Brand DNA: heuristic fallback [no AI key configured]" in `text-amber-600` — not an error state, a factual label.

7. **Text is never drawn by an image model** — `hero_image: null` is always null in P0. Text, headline, price, CTA, logo are always HTML/CSS layers. This is a hard constraint from the brief (Azure VM, no Playwright, no server-side render).

8. **`knobs.py` is the single source of truth for knob vocabulary** — the frontend renderer and backend schema must use identical enum values. Any divergence is a P0 bug, not a cosmetic issue.

---

## Build Order (P0 — 12h solo budget)

```
1. Fix AssetPreview mock import → useBrand() props           ~45min  (unblocks all demos)
2. Signal Check heuristic fallback in routers/signal.py      ~20min  (unblocks offline demo)
3. dont guard in asset_gen._headline()                       ~15min  (makes Memory non-inert)
4. Products section in Brand.jsx                             ~90min  (Capture P0 complete)
5. voice.tone input in Brand.jsx                             ~30min  (Memory P0 complete)
6. Preferences ChipList in Brand.jsx                         ~20min  (Memory P0 complete)
7. Palette swatch color picker in Brand.jsx                  ~45min  (Identity P0 complete)
8. Photo style input in Brand.jsx                            ~20min  (Identity P0 complete)
9. Last audit chip in Brand.jsx                              ~30min  (Signaling P0 complete)
10. AssetCard contenteditable + knob sliders                 ~60min  (Editor P0 complete)

Total: ~6h. Remaining time for Phase 1 (LLM Brand DNA) or Phase 2 (LLM copywriter).
```

Each step is independently shippable. Steps 1-3 are backend/contract fixes that unblock demo reliability. Steps 4-9 are Brand.jsx additions. Step 10 is AssetCard enhancement.

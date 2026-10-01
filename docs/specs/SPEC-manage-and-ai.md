# Marque.ai — Pillars 3, 4 & 5 Spec
# Brand Manager / Asset Library · Campaign Manager · AI Layer

**Ground truth:** `backend/schemas.py`, `backend/routers/assets.py`, `backend/routers/agent.py`,
`frontend/src/pages/Library.jsx`, `frontend/src/pages/Campaigns.jsx`,
`frontend/src/pages/CampaignDetail.jsx`, `frontend/src/lib/api.js`.
All endpoints below exist and are wired unless marked *(missing)*.

---

## PILLAR 3 — Brand Manager / Asset Library

### 3.1 What it is

The Library is the **permanent record of every asset the brand has ever generated or uploaded**.
It is not a feature users navigate to mid-flow — it is where results persist so the brand owner
can retrieve, re-check, duplicate, and export them later. The AI layer deposits assets here
automatically; the user never has to explicitly "save."

Two asset sources feed the Library:

| Source | Schema field | Written by |
|---|---|---|
| Upload → Signal Check | `source: "upload"`, `png_url` set | `POST /v1/brands/{id}/assets` (save-on-check) |
| Generated campaign asset | `source: "rendered"`, `slots`/`knobs` set | `POST /v1/brands/{id}/agent/run` (persists to `assets` table) |

`LibraryAsset` is the read contract. `AssetOut` is the in-flight campaign contract. Both share
`signal_match`, `signal_verdict`, `slots`, `knobs`, `type`, `label`.

### 3.2 Endpoints (all exist)

```
GET    /v1/brands/{id}/assets            → list[LibraryAsset]   (filter: type, limit, offset)
GET    /v1/brands/{id}/assets/{assetId}  → LibraryAsset
POST   /v1/brands/{id}/assets            → LibraryAsset (multipart: image + type + label)
DELETE /v1/brands/{id}/assets/{assetId}  → 204
GET    /v1/brands/{id}/campaigns         → list[CampaignOut]
GET    /v1/campaigns/{id}                → CampaignOut
```

**Missing:** `PATCH /v1/brands/{id}/assets/{assetId}` — update `label`, `type`, or
`knobs` on a rendered asset. Needed for P1 in-place edit. Not required for P0 demo.

**Missing:** A unified endpoint that returns **both** uploaded assets AND campaign-generated
assets as one `LibraryAsset[]` list. Today `listAssets` only returns uploaded assets
(`Asset` rows with `source="upload"`). Campaign assets exist in the same `Asset` table but
`assets.py` `list_assets` query only returns assets where `asset.campaign_id IS NULL`
(implicit from how save_asset works — it never sets `campaign_id`). The fix: remove that
implicit filter so `GET /assets` returns ALL assets for the brand, campaign-generated included.

**P0 fix in `routers/assets.py`:** the `list_assets` query is already
`select(Asset).where(Asset.brand_id == brand_id)` with no campaign_id filter — so generated
campaign assets DO appear. Verify this in the frontend by checking if `api.listAssets(brand.id)`
returns them. If the Library page is empty after generating a campaign, the gap is in `_to_library_asset`:
it reads `layout_json.slots`/`layout_json.knobs` but `LibraryAsset.slots`/`LibraryAsset.knobs` are
`None` in the current schema. To show generated assets properly, `_to_library_asset` must populate
`slots` and `knobs` from `layout_json` when present.

### 3.3 Library page — `/library` (`Library.jsx`)

#### Current state (working)
- Filter tabs: All / Posters / Posts / Stories / WhatsApp / Uploads — tab filtering via `TAB_TYPE` map
- Search: filters on `label`, `slots.headline`, `slots.subline`
- Dashboard strip: avg `signal_match`, total asset count, alerts from latest audit
- Asset grid: `<AssetCard>` per asset, `lg:grid-cols-4`
- Empty state: two messages — no assets at all vs. no match for current filter

#### Gaps to fix (P0)

**Gap 1 — AssetCard for rendered assets shows nothing:**
`AssetCard` accepts `asset` prop. When `asset.source === "rendered"`, `asset.png_url` is null.
The card must render `AssetPreview` (CSS mockup) using `asset.slots` + `asset.knobs` +
`palette`/`fonts` from `useBrand()`. Currently `AssetCard` may show a broken image or blank.
Fix: in `AssetCard`, check `asset.source === "rendered"` → render `<AssetPreview>` component;
else `asset.png_url` is set → render `<img>` with `object-cover`.

**Gap 2 — Signal badge missing on generated assets:**
`signal_match: null` on a generated asset (never signal-checked) must show
`"Signal not checked"` badge — `bg-zinc-100 text-zinc-500 text-[11px] px-2 py-0.5` — not empty space.
This is an invariant across the whole product.

**Gap 3 — Delete wired but no confirmation:**
`api.deleteAsset(brandId, assetId)` exists. Library.jsx has no delete affordance.
P0: a `×` button on hover for each card calls `deleteAsset` with no modal (low-stakes if undone
via browser back, and there's no undo yet). On success remove from local state.

**Gap 4 — `_to_library_asset` in `routers/assets.py` drops rendered asset slots/knobs:**
`LibraryAsset.slots` and `LibraryAsset.knobs` fields exist in the schema but `_to_library_asset`
only maps `layout_json.label`, not `layout_json.slots` / `layout_json.knobs`. Fix:

```python
def _to_library_asset(asset: Asset) -> LibraryAsset:
    layout = asset.layout_json or {}
    signal = asset.signal_json or {}
    return LibraryAsset(
        id=asset.id,
        brand_id=asset.brand_id,
        source=layout.get("source", "upload"),
        type=asset.type,
        label=layout.get("label") or "",
        png_url=asset.png_url,
        signal_match=signal.get("match"),
        signal_verdict=signal.get("verdict"),
        slots=layout.get("slots"),       # ← add
        knobs=layout.get("knobs"),       # ← add
        created_at=asset.created_at,
    )
```

#### 3.4 Screen states

**Idle / no assets:**
```
Library
──────────────────────────────────────────────────
[Brand health: 0]  [Assets: 0]

[All] [Posters] [Posts] [Stories] [WhatsApp] [Uploads]
[ Search assets… ]

No saved assets yet — run a Signal Check and hit Save to library.
```

**Loading:**
- `assets` state initialises `[]`. `useEffect` fires `api.listAssets`. During inflight: show
  4-column skeleton grid (`animate-pulse border border-zinc-200 h-40` × 4). Not currently
  implemented — a small P0 addition. `loading` boolean guards the skeleton vs. the empty state.

**Loaded — mixed sources:**
```
Library
──────────────────────────────────────────────────
[Brand health: 74]  [Assets: 7]  [Alert: …]

[All] [Posters▪] [Posts] [Stories] [WhatsApp] [Uploads]
[ Search assets… ]

[AssetCard img]  [AssetCard preview]  [AssetCard img]  [AssetCard preview]
poster · 74/pass  poster · not checked  upload · 62/fix  post · not checked
```
Cards with `source="rendered"` show `AssetPreview`. Cards with `source="upload"` show the stored
image. Both use the same `AssetCard` shell.

**Error state:**
`api.listAssets` rejects → `setAssets([])`, show:
```
border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800
"Could not load assets. [Retry]"
```
Retry button calls `api.listAssets` again.

#### 3.5 Folder / tag system (P1, not P0)

`LibraryAsset` has no `folder` or `tag` field. For P1: add `tags: list[str]` to
`LibraryAsset` schema, a `PATCH /assets/{id}` endpoint, and tag pills in the Library UI.
Filter tabs become a secondary axis alongside tag chips. Not in the P0 scope.

#### 3.6 Export (P1)

"Export all" on CampaignDetail fires a toast: `"Export will work after backend is connected."`
This is correct for P0. P1: `GET /v1/campaigns/{id}/export` returns a ZIP of PNGs generated
by server-side Playwright render. Not in P0 scope (Playwright risky on 1vCPU/2GB VM).

Single-asset download P0: `<a href={asset.png_url} download>` for uploaded assets. For rendered
assets: `html2canvas` on the `AssetPreview` DOM node → canvas → PNG download. No server needed.

---

## PILLAR 4 — Campaign Manager

### 4.1 What it is

Campaigns are **first-class containers** for groups of assets produced for a common goal.
A campaign has a name, objective, core_message, status, date, and N assets. The Campaign Manager
is the navigation surface: list → detail → per-asset editing.

### 4.2 Endpoints (all exist)

```
POST   /v1/brands/{id}/agent/run         → CampaignOut (creates + persists)
GET    /v1/brands/{id}/campaigns         → list[CampaignOut]
GET    /v1/campaigns/{id}                → CampaignOut
```

**Missing:**
- `PATCH /v1/campaigns/{id}` — update `status` (Draft → Ready → Archived). P1.
- `DELETE /v1/campaigns/{id}` — soft-delete. P1.
- `GET /v1/campaigns/{id}/assets/{assetId}` — granular asset read. Not needed; `CampaignOut.assets` covers it.

### 4.3 `CampaignOut` schema

```python
class CampaignOut(BaseModel):
    id: str
    name: str
    objective: str
    core_message: str
    status: str          # "Draft" | "Ready" | "Archived"
    date: str            # ISO date of creation
    assets: list[AssetOut]
```

`AssetOut` carries `id`, `type`, `label`, `size`, `signal_match`, `signal_verdict`, `slots`,
`knobs`. Every field the renderer needs.

### 4.4 Campaigns list page — `/campaigns` (`Campaigns.jsx`)

#### Current state (working)
- `useEffect` fires `api.listCampaigns(brand.id)` on brand load
- Each campaign: name, date, asset count, status chip → `<Link to="/campaigns/{id}">`
- Empty state: "No campaigns yet."

#### Gaps to fix (P0)

**Gap 1 — Status chip colours:**
`STATUS_STYLE` only maps `"Ready"` and `"Draft"`. Add `"Archived": "bg-zinc-100 text-zinc-400"`.
Current fallback is `STATUS_STYLE.Draft` which is acceptable but not explicit.

**Gap 2 — Asset count from live data:**
`c.assets?.length ?? 0` works when `CampaignOut.assets` is populated. The list endpoint
`/brands/{id}/campaigns` does a separate `select(Asset)` per campaign. This N+1 is acceptable at demo
scale. No change needed.

**Gap 3 — Campaign actions (P1):**
No delete/archive UI. For P0: no affordance (campaigns accumulate — acceptable for demo).
P1: ellipsis menu per row → Archive / Delete with confirmation diff card.

#### 4.5 Campaign detail page — `/campaigns/:id` (`CampaignDetail.jsx`)

#### Current state (working)
- Loads `api.getCampaign(id)` on mount, skeleton while loading
- Header: name, objective, core_message box
- Asset grid `lg:grid-cols-4` of `<AssetCard>`
- Asset checklist: signal_verdict check badge per asset
- "Export all" → toast (placeholder)

#### Gaps to fix (P0)

**Gap 1 — `AssetCard` palette/fonts not from brand:**
`AssetCard` internally may reference a static mock for palette/fonts when rendering
`AssetPreview`. Fix: `CampaignDetail` must pass `palette` and `fonts` from `useBrand()`
down to each `AssetCard`, which passes them to `AssetPreview`.

```jsx
// CampaignDetail.jsx — add at top:
const { brand } = useBrand()

// In grid render:
<AssetCard key={asset.id} asset={asset} palette={brand?.palette} fonts={brand?.fonts} />
```

`AssetCard` signature: `function AssetCard({ asset, palette, fonts })` — forward to
`<AssetPreview ... palette={palette} fonts={fonts} />`.

**Gap 2 — "Signal not checked" badge missing:**
Any asset with `signal_match: null` must show the badge. The checklist row currently shows an
empty `<span>` when `signal_verdict !== "pass"`. Add: if `signal_match === null`, render
`"Signal not checked"` in `text-zinc-400 text-[11px]` instead of blank score.

**Gap 3 — Edit link per asset card:**
`AssetCard` in CampaignDetail has no `[Edit →]` link to `/editor/:assetId`. Add as a hover
affordance: `<Link to={/editor/${asset.id}}>Edit →</Link>` — `text-[12px] text-emerald-700
hover:underline`, visible on card hover.

**Gap 4 — Campaign status update (P1):**
Status stays "Draft" permanently. P1: a status dropdown in the header (`Draft → Ready → Archived`)
fires `PATCH /v1/campaigns/{id}` (endpoint not yet built). For P0 display only.

#### 4.6 Campaign state machine

```
[user submits goal in Workspace AskBar]
       ↓
POST /agent/run → CampaignOut (status: "Draft", persisted)
       ↓
[user views campaign on /campaigns/:id]
       ↓  (P1) user marks Ready
[status: "Ready" — assets approved for use]
       ↓  (P1) user archives
[status: "Archived" — hidden by default from list]
```

For P0: status is always "Draft" after creation. "Ready" is only set manually (P1).

#### 4.7 Screen states

**Campaigns list — loading:**
```
Campaigns
──────────────
0 campaigns

[skeleton border h-16 animate-pulse]
[skeleton border h-16 animate-pulse]
```
Current implementation has no loading skeleton — `campaigns` initialises `[]` and the empty
state fires immediately. P0 fix: add `loading` state, show 3 skeleton rows while fetching.

**Campaigns list — loaded:**
```
Campaigns
──────────────────────────────────────────────────
3 campaigns

[Truffle Burger Launch]  [12 Jan 2025 · 4 assets]  [Draft]
[Weekend Offer]          [10 Jan 2025 · 4 assets]  [Ready]
[New Year Special]       [02 Jan 2025 · 4 assets]  [Draft]
```

**Campaign detail — loading:**
Existing: `animate-pulse border h-48` skeleton. Good as-is.

**Campaign detail — loaded:**
```
Truffle Burger Launch
Launch our truffle burger at ₹399            [Draft]  [Export all]

Core message
─────────────────────────────────────────────────────
Launch our truffle burger. ₹399. Limited time.

[Poster A4]  [Instagram Post]  [Story]  [WhatsApp]
  74/pass       not checked      not checked   62/fix

Asset checklist
─────────────────────────────────────────────────────
[✓] A4 Poster · 1080×1350          74
[ ] Instagram Post · 1080×1080     —   ← "Signal not checked"
[ ] Story · 1080×1920              —
[✗] WhatsApp Banner · 800×418      62
```

**Campaign detail — empty assets (corrupted/failed campaign):**
```
border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800
"This campaign has no assets. It may not have generated correctly."
[→ Back to Campaigns]
```

---

## PILLAR 5 — AI Layer

### 5.1 Scope

The AI Layer is not a single module — it is the **conversation-first skin** over all the other
pillars. It has five concerns:

1. **Intent routing** — classifying what the user said into an action type
2. **Action execution** — calling the right endpoint (or heuristic) for the classified intent
3. **Confirmation gating** — deciding when to ask before mutating state
4. **Render contract** — what appears on screen in each column as a result
5. **Fallback honesty** — what happens when the LLM is absent or fails

### 5.2 Current state

The `agent_run` endpoint is a **deterministic heuristic**, not an LLM-based agent:
- `generate_campaign` in `asset_gen.py` uses regex to extract price and goal
- No intent classification: every input generates a campaign, even "What's our brand palette?"
- `AgentRunIn.goal` → `generate_campaign(profile, goal)` → `CampaignOut`
- Brand Memory fields (`do`, `dont`, `preferences`, `voice.tone`) are NOT injected into
  the generated copy — the "Amnesia Loop" anti-pattern

P0 fixes required before demo:
1. Dont-rule injection into `_headline()` in `asset_gen.py`
2. Full memory injection into the copy generation system prompt (if LLM; heuristic fallback)
3. Heuristic fallback badge for Signal Check VisionNotConfiguredError (in `routers/signal.py`)

### 5.3 Intent → Action Routing Contract

The full P0/P1/P2 routing table. "P0" = must work for demo. "P1" = next sprint.
"heuristic" = no LLM required. "LLM" = requires OPENROUTER_API_KEY.

| User says | Classified intent | Action type | Confirmation | Centre pane result | AI req. |
|---|---|---|---|---|---|
| "Create a launch poster for truffle burger at ₹399" | `generate_campaign` | `generate` | none | `CampaignOut` → 4 `AssetCard` grid | heuristic (P0), LLM copy (P1) |
| "Make a weekend offer post" | `generate_campaign` | `generate` | none | `CampaignOut` grid | heuristic |
| "Create a launch poster" (no price) | `generate_campaign` + price missing | `question` | — | Question block in left col | heuristic |
| "Which identity direction should we go with?" | `read_identity` | `read` | none | 2 `IdentityDirection` cards | none |
| "What's our brand palette?" | `read_brand` | `read` | none | `BrandCard` component | none |
| "What are our brand rules?" | `read_brand` | `read` | none | `BrandCard` with do/dont/prefs | none |
| "Show me our campaigns" | `read_campaigns` | `read` | none | `CampaignOut[]` list card | none |
| "Apply the bold direction" | `identity_apply` | `confirm` | diff card (centre pane) | Diff card → `BrandCard` on confirm | none |
| "Change our voice tone to urgent" | `memory_patch_voice` | `confirm` | inline confirm block | `MemoryDiffCard` on confirm | LLM (P1), heuristic (field name match) |
| "Never use the word 'fresh'" | `memory_append_dont` | `memory` | none (optimistic) | `MemoryDiffCard` | none |
| "Always show the price" | `memory_append_do` | `memory` | none (optimistic) | `MemoryDiffCard` | none |
| "Add truffle pizza ₹249 to our menu" | `capture_product_add` | `memory` | none | Product list `MemoryDiffCard` | heuristic (regex price extract) |
| "Check the signal on our poster" | `signal_check_prompt` | `clarify` | — | Upload drop zone in left col | vision LLM (heuristic fallback) |
| "Auto-fix this" | `signal_autofix` | `generate` | none | `AutoFixResult` two-panel | vision LLM (heuristic fallback) |
| "Is our brand consistent?" | `brand_completeness` | `evaluate` | none | `BrandCompletenessCard` (P1) | none |
| "Make the poster more premium" | `asset_edit_knobs` | `clarify` (which asset?) | — | Knob delta preview | LLM (P1) |
| Anything unclassified | `fallback_generate` | `generate` | none | treat as campaign goal | heuristic |

#### Intent classifier implementation (P0 thin — keyword matching)

For P0, the `agent_run` router does not call an LLM to classify intent. It uses a keyword
priority chain in Python:

```python
def classify_intent(goal: str) -> str:
    g = goal.lower()
    if any(w in g for w in ["identity", "direction", "palette", "font"]):
        if "apply" in g or "use" in g or "go with" in g:
            return "identity_apply"
        return "read_identity"
    if any(w in g for w in ["rule", "do", "dont", "never", "always", "tone", "voice"]):
        return "memory_intent"
    if any(w in g for w in ["campaign", "poster", "post", "story", "whatsapp", "launch",
                              "create", "make", "generate", "run", "weekend", "offer"]):
        return "generate_campaign"
    if any(w in g for w in ["show", "what", "list", "how", "check", "brand", "signal", "audit"]):
        return "read_intent"
    return "generate_campaign"  # default: attempt campaign generation
```

This is a naive classifier. It handles the 80% demo case. P1 replaces with a real LLM
classification call (one `messages` call, temperature 0, returns `{"intent": "..."}`) using the
vision.py pattern: parse → validate → retry once → fallback to `"generate_campaign"`.

#### Intent classifier output → router dispatch

```python
@router.post("/agent/run", response_model=CampaignOut | BrandReadOut | ...)
async def agent_run(brand_id, payload, session):
    intent = classify_intent(payload.goal)
    profile = BrandProfile(**brand.profile_json)

    if intent == "generate_campaign":
        return await _run_generate_campaign(brand_id, profile, payload.goal, session)
    elif intent == "read_identity":
        dirs = await _get_identity_directions(brand_id, profile, session)
        return AgentReadOut(type="identity_directions", data=dirs)
    elif intent == "read_brand":
        return AgentReadOut(type="brand_profile", data=profile)
    elif intent == "memory_intent":
        return await _run_memory_intent(brand_id, profile, payload.goal, session)
    else:
        return await _run_generate_campaign(brand_id, profile, payload.goal, session)
```

**P0 honest implementation:** the router today always calls `generate_campaign`. Adding the
classifier is a 1–2h backend change. Without it, the demo is constrained: every Workspace input
generates a campaign. The brand read actions ("What's our palette?") must be handled on the
frontend as a special case: detect read-intent keywords client-side, call `api.getBrand(id)`
directly instead of `api.agentRun()`, and render the `BrandCard` centre pane without hitting
the agent endpoint.

**Frontend client-side intent shortcut (P0 acceptable):**

```js
// useAgent.js
function detectReadIntent(goal) {
    const g = goal.toLowerCase()
    if (/palette|color|colour|font|identity|direction/.test(g) && !/apply|use|go with/.test(g))
        return "read_brand_identity"
    if (/rule|do|dont|brand memory|voice|tone/.test(g) && !/change|update|set/.test(g))
        return "read_brand_memory"
    if (/campaign|library|asset/.test(g) && /show|list|what/.test(g))
        return "read_campaigns"
    return null
}
```

If `detectReadIntent(goal)` returns non-null: skip `agentRun`, call the relevant read API,
set the appropriate result type. If null: call `api.agentRun(brandId, goal)`.

### 5.4 Action Type Render Contract

Six action types. Each drives a distinct render in the conversation list (left column)
AND a centre-pane result. This is the complete render contract:

#### `thinking`
**Trigger:** any request in-flight
**Left column:**
```jsx
<div className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-500">
  <Spinner className="h-4 w-4 animate-spin text-emerald-700" />
  Planning your campaign…  {/* or relevant loading text */}
</div>
```
**Centre pane:** spinner centred + mono loading text
**TracePanel:** first event appears: `"→ Loaded Brand Memory"`

#### `generate`
**Trigger:** `generate_campaign` intent resolves
**Left column:**
```
✦ Generated campaign  [chip: campaign.name]
  N assets · status · price
  [→ View in Campaigns]  [→ Open in Editor]
```
`border border-zinc-200 rounded-sm px-3 py-3 bg-white text-[13px]`
**Centre pane:** full `CampaignOut` with asset grid (palette/fonts from `useBrand()`)
**TracePanel:** all 8 events stagger in at 60ms each

#### `read`
**Trigger:** read-intent resolved (identity directions, brand profile, campaigns list)
**Left column:**
```
[MagnifyingGlass 13px zinc-400]  [subject line — e.g. "Brand Memory" or "Identity directions"]
  [2–4 data rows, monospace values]
  [→ View on Brand page]
```
**Centre pane:** `BrandCard` component (full structured card) or direction cards
**TracePanel:** `"→ Loaded Brand Memory"` + `"→ Read: [subject]"`

#### `confirm`
**Trigger:** write to `BrandProfile` (identity apply, voice tone change, positioning update)
**Left column:**
```
[AlertCircle 13px amber-600]  [action description]?
  [one-line diff if single field]
  [Apply change]  [Cancel]
```
`border border-amber-200 bg-amber-50/50 rounded-sm px-3 py-3 text-[13px]`
**Centre pane:** full diff card (two-column before/after) for multi-field changes
**TracePanel:** `"→ Waiting for confirmation: [action]"` in `text-amber-600`

#### `memory`
**Trigger:** `MemoryRuleAppend` or `BrandMemoryPatch` from conversation
**Left column:**
```
[BookmarkPlus 13px emerald-600]  Added to Don't rules
  "[rule text]"
  [→ View in Brand Memory]
```
Optimistic: renders before API resolves. Reverts on failure.
**Centre pane:** `MemoryDiffCard` — the full list of that field's rules with new one highlighted
**TracePanel:** `"→ Memory rule appended: [field]"`, `"→ Brand Memory v[N]"`

#### `evaluate`
**Trigger:** Signal Check or brand completeness read
**Left column:**
```
[Signal icon 13px]  Signal Check
  [score]/100 · [verdict chip]
  [key gaps]
  [→ View full result]  [→ Auto-fix]  (if needs_fix)
```
**Centre pane:** `SignalCard` (score + axis bars + evidence) or `AutoFixResult` (two-panel)
**TracePanel:** brand target loaded → image uploaded → score → gaps → verdict

#### `error`
**Trigger:** any API failure
**Left column:**
```
[AlertTriangle 13px amber-600]  [human-readable error message]
  [retry link]
```
`bg-amber-50/30 border border-amber-200 rounded-sm px-3 py-2.5 text-[13px] text-amber-700`
**Centre pane:**
```
border border-amber-200 bg-amber-50 px-5 py-4 rounded-md
[same error message]
[Retry]
```
**TracePanel:** clears, shows `"Error: [message]"` in `text-red-600`

#### `clarify`
**Trigger:** required input missing (no price in goal, signal check needs image)
**Left column:**
```
[QuestionMark 13px zinc-500]  [one-sentence question]
  [input control — text or file drop zone]
```
One question only. Never two questions in one clarify block. After user responds: transitions
to `thinking` then the relevant action type.
**Centre pane:** unchanged (shows previous result or idle state)
**TracePanel:** unchanged

### 5.5 Confirmation Gate Rules

Two action types require confirmation. Everything else acts immediately.

| Action | Gate type | Rationale |
|---|---|---|
| `POST /identity/apply` | Centre-pane diff card | Locks palette/fonts permanently; high visual impact |
| `PATCH /memory` (voice, positioning) | Inline confirm block in left col (single field) OR centre-pane diff card (multi-field) | Affects every future generation |
| `POST /memory/rules` (append single rule) | None — optimistic | Non-destructive append, easily removed via chip list |
| `DELETE /assets/{id}` | None for P0, inline confirm for P1 | P0: single asset delete is low-stakes demo-wise |
| `DELETE /campaigns/{id}` (P1) | Inline confirm block | Destructive |
| `generate_campaign` | None | Generation is cheap and reversible |
| Signal Check, auto-fix | None | Read/evaluate only |
| `read_*` actions | None | Read-only |

**Threshold for centre-pane diff card vs inline confirm:**
- ≥2 `BrandProfile` fields changing → centre-pane diff card
- 1 field changing → inline confirm block in left column

### 5.6 Memory Injection Contract

Every generation system prompt (both heuristic and LLM) must include the full memory block.
Current `asset_gen.py` only uses `brand.name`, `brand.category`, `brand.positioning`.

**P0 minimum fix — dont-rule check in `_headline()`:**

```python
def _headline(goal: str, profile: BrandProfile) -> str:
    raw = _strip_filler(goal)[:60]
    # Check every dont rule: if any dont-rule word appears in the headline, fall back
    headline_lower = raw.lower()
    for rule in profile.dont:
        for word in rule.lower().split():
            if len(word) > 3 and word in headline_lower:
                return profile.name  # safe fallback
    return raw or profile.name
```

**P1 full injection — into the LLM system prompt:**

```python
MEMORY_BLOCK = """
Brand: {name} ({category})
Voice: {voice_tone}
Personality: {personality}
Do: {do_rules}
Don't: {dont_rules}
Preferences: {preferences}
Positioning target: premium {premium} · modern {modern} · playful {playful} · niche {niche}
""".format(
    name=profile.name,
    category=profile.category,
    voice_tone=profile.voice.tone or "not set",
    personality=", ".join(profile.personality),
    do_rules="; ".join(profile.do) or "none",
    dont_rules="; ".join(profile.dont) or "none",
    preferences="; ".join(profile.preferences) or "none",
    premium=profile.positioning.premium,
    modern=profile.positioning.modern,
    playful=profile.positioning.playful,
    niche=profile.positioning.niche,
)
```

This block is prepended to every generation system prompt. The LLM never invents brand rules —
it reads them from this injection.

### 5.7 Heuristic Fallback Contract (no LLM key)

Every AI feature has an explicit heuristic fallback. The fallback must be visible, never silent.

| Feature | LLM present | No LLM key (heuristic) | Fallback badge |
|---|---|---|---|
| Brand DNA (`propose_*`) | LLM positioning + tone | Lookup table (current behaviour) | TracePanel: `"Brand DNA: heuristic fallback [no AI key]"` in `text-amber-600` |
| Campaign copy generation | LLM `headline/subline/cta` | Regex extraction from goal string | None (regex is already the current P0 behaviour) |
| Signal Check | Vision LLM, real score | `match=50, verdict="needs_fix", issue="heuristic fallback"` | `bg-amber-50 border border-amber-200` badge in `SignalCard` header |
| Intent classification | LLM classifier | Keyword matching Python function | None visible (backend concern) |
| Auto-fix (round 2) | Vision LLM | Same heuristic `SignalResult` with `match=50` | Same amber badge |

**`VisionNotConfiguredError` in `routers/signal.py` — P0 required fix:**

```python
# routers/signal.py
from schemas import FixKnobs, Positioning, SignalGaps, SignalResult
from vision import VisionNotConfiguredError, check_signals

@router.post("", response_model=SignalResult)
async def check_signal(brand_id: str, image: UploadFile, round: int = Form(1), session=...):
    brand = await _get_brand_or_404(brand_id, session)
    profile = BrandProfile(**brand.profile_json)
    data = await image.read()
    try:
        validate_upload(data)
    except BadUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        result = await check_signals(profile, data, round=round)
    except VisionNotConfiguredError:
        # Heuristic fallback — never 503
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
    except (InvalidImageError, VisionCheckError) as exc:
        raise HTTPException(status_code=422 if isinstance(exc, InvalidImageError) else 502,
                            detail=str(exc)) from exc
    return result
```

### 5.8 TracePanel Events — Real vs. Theater

Current TracePanel shows 8 canned strings with CSS animation stagger. For P0 demo this is
acceptable — the steps are real (Brand Memory IS loaded, 4 assets ARE generated). They are not
fabricated outcomes, just rendered as a fixed list rather than streamed.

**P0 honest trace (return with CampaignOut):**
Add `trace: list[str]` to `CampaignOut` (optional field, ignored by frontend if absent).
`agent_run` populates it:

```python
trace = [
    "Loaded Brand Memory",
    f"Applied {len(profile.dont)} Don't rules",
    f"Wrote creative core: {campaign_data['core_message'][:40]}…",
    f"Rendered {len(campaign_data['assets'])} assets",
    "Campaign ready",
]
```

Frontend `Workspace.jsx` reads `campaign.trace` if present and renders it as the TracePanel
events instead of the hardcoded `TRACE_STEPS`. Graceful: falls back to `TRACE_STEPS` if absent.

**P1 real streaming:** SSE endpoint `GET /v1/brands/{id}/agent/run/stream` emits events as they
happen. Frontend uses `EventSource`. Not required for P0.

### 5.9 Conversation History State Shape

Client-side only for P0 (not persisted to DB). Each turn in `conversationHistory`:

```js
{
  id: string,           // uuid
  role: "user" | "ai",
  content: string,      // user: raw text; ai: summary sentence
  action_type: "thinking" | "generate" | "read" | "confirm" | "memory" | "evaluate" | "error" | "clarify",
  action_payload: any,  // the raw API response (CampaignOut | BrandProfile | SignalResult | …)
  timestamp: number,    // Date.now()
}
```

`action_type` and `action_payload` drive the left-column action block render. The centre pane
renders from the most recent non-`thinking`/non-`clarify` turn's `action_payload`.

P1: persist `conversationHistory` to `localStorage` keyed by `brandId`. Restore on page load.
P2: persist to backend, enable multi-session continuity.

### 5.10 AskBar Behaviour

The `AskBar` in Workspace sends `goal` to `useAgent.run()`:

1. Disable send button + clear input immediately on submit
2. Append `{ role: "user", content: goal, action_type: "thinking" }` to `conversationHistory`
3. Detect read intent client-side (`detectReadIntent(goal)`)
   - If read intent: call relevant `api.*` directly, skip `agentRun`
   - Else: call `api.agentRun(brandId, goal)`
4. On response: replace `thinking` turn with completed `action_type` + `action_payload`
5. Re-enable send button
6. On error: set `action_type: "error"` on the pending turn, re-enable send button

**Price missing guard (heuristic, P0):**

```js
function extractPrice(goal) {
    const m = goal.match(/[₹$€£]?\s*(\d[\d,]*)/);
    return m ? m[1].replace(",", "") : null;
}

// In useAgent.run():
if (!extractPrice(goal)) {
    // Don't call API — add clarify turn
    addTurn({ action_type: "clarify", content: "What's the price point for this item?" });
    return;
}
```

This fires if the goal looks like a generation request (contains "poster", "campaign", "launch",
etc.) but has no price. If no generation keywords detected, skip the price check (user might be
asking a read question).

### 5.11 P0 Acceptance Criteria — AI Layer

- [ ] `asset_gen._headline()` checks every `dont` rule word — headline never contains a word
      that appears in any dont rule (P0 thin fix)
- [ ] `routers/signal.py` catches `VisionNotConfiguredError` and returns `SignalResult`
      with `match=50, verdict="needs_fix", issue="heuristic fallback — AI key not configured"`
      instead of HTTP 503
- [ ] `SignalCard` shows amber badge when `issue` contains `"heuristic fallback"` — not hidden,
      not a broken state
- [ ] `AssetPreview` in Workspace, CampaignDetail, and Library always receives `palette`/`fonts`
      from `useBrand()` context, never from a static mock import
- [ ] `useAgent.run()` detects 5+ read-intent patterns and calls `api.getBrand()` /
      `api.getIdentityDirections()` directly rather than `api.agentRun()`
- [ ] AskBar price-missing guard fires for generation-intent goals with no price,
      renders a `clarify` block, does not call the backend
- [ ] `CampaignOut.trace` optional field: if present, TracePanel renders it instead of
      hardcoded `TRACE_STEPS`
- [ ] All `signal_match: null` assets show `"Signal not checked"` badge — not blank space

### 5.12 P1 AI Enhancements (post-hackathon, reference only)

- LLM intent classifier replacing the keyword chain
- LLM copywriter (Phase 2 per roadmap): `generate_campaign` uses one LLM call with full memory
  injection, returns `slots` matching current schema
- SSE trace streaming from `agent_run`
- Multi-intent compound requests ("Create a poster and add it to Library")
- Context window: last 5 conversation turns injected into generation prompt
- Preference learning: AI notices patterns in accepted/rejected rule suggestions and proposes
  new memory rules
- `BrandCompletenessCard` component for completeness audit via conversation
- Unsaved-state conflict resolution: when `setBrand(updated)` fires during a dirty Brand.jsx
  form, show an `"Unsaved changes lost"` toast rather than silently discarding

---

## Invariants (never break across all three pillars)

1. `signal_match: null` → always renders `"Signal not checked"` badge, never blank space
2. `VisionNotConfiguredError` → never HTTP 503 to frontend; always a valid `SignalResult` with
   `match=50` and explicit amber badge
3. `AssetPreview` always takes `palette`/`fonts` from `useBrand()`, never a static mock
4. Every `BrandProfile` write from AI conversation fires `setBrand(updated)` so `BrandEditorInner`
   remounts via `key={brand.id}:${brand.version}` — no stale brand state
5. Every AI-proposed `BrandProfile` write requires a diff card or inline confirm block — only
   generation and read actions are fire-and-forget
6. `dna_source: "heuristic"` badge always visible in TracePanel when AI key is absent —
   never silently degrade to generic output with no indication
7. Every action in `conversationHistory` has an explicit `action_type` — no turns with
   `action_type: undefined` reach the render layer

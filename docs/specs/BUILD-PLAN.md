# BUILD-PLAN.md — Marque.ai P0 Demo Build
_Ruthless 12h solo build order for a winning hackathon demo. No fluff._

---

## STATUS (verified 2026-10-01, branch `feat/library-audit`)

Old tooling blocker is **RESOLVED**: backend imports clean (`import main` → OK with RTK disabled);
`uploads.py`, `routers/assets.py`, `routers/audit.py` now exist + are committed; `main.py` no longer
reverts. F8 Library + F10 Audit shipped. Three real bugs remain (below), split across 3 parallel agents.

---

## 3-AGENT PARALLEL SPLIT (disjoint files — no collisions, run concurrently)

Each agent owns a non-overlapping set of files. All three can run at once.

| Agent | Owns (writes) | Reads only | Delivers |
|---|---|---|---|
| **Agent 1 — Frontend wiring** | `frontend/src/components/AssetCard.jsx`, `frontend/src/pages/Workspace.jsx`, `frontend/src/pages/CampaignDetail.jsx`, `frontend/src/components/AssetPreview.jsx` | `context/BrandContext.jsx`, `lib/api.js` | Kills Amnesia Loop (Blocks 1.1-1.3, 3.1), removes 360px cap |
| **Agent 2 — Signal Check fallback** | `backend/routers/signal.py`, `backend/tests/test_signal_check.py` (add cases) | `backend/vision.py`, `backend/schemas.py` | 503 → heuristic `SignalResult` (Block 1.4) + mocked tests |
| **Agent 3 — Memory-aware copy** | `backend/asset_gen.py`, `backend/tests/test_asset_gen.py` (or new) | `backend/schemas.py` | `do`/`dont` actually gate generated copy (Block 1.5) + tests |

**Why these 3 split cleanly:** Agent 1 is 100% `frontend/`. Agents 2 and 3 are both `backend/` but touch
*different* files (`routers/signal.py` vs `asset_gen.py`) and *different* test files. No shared file is written
by two agents. `schemas.py` is read-only for all three (no edits needed — contracts already exist).

**Ground rules for all agents:** zero AI credits (tests mock httpx or unset the key, per `vision.py`
pattern); don't break the 91 existing pytest tests; keep function signatures/output schemas stable so the
seam holds; match surrounding code style.

---

## STEP 0 — (OBSOLETE) old tooling blocker

Previously claimed `main.py` reverted due to mock fallback — this conflated two separate issues and is now
moot. The Amnesia Loop (AssetCard importing `mock/brand.json`) is a *real, separate* bug → now **Agent 1**.

---

## WHAT EXISTS vs. WHAT THE VISION NEEDS

### Pillar 1: Brand Builder

| Concern | What exists | Gap vs vision |
|---|---|---|
| Capture / products | `BrandCreate` schema + `/onboarding` page | Products not editable on `/brand`. No add/remove UI. |
| Identity directions | `GET /v1/brands/{id}/identity` + direction cards in `Brand.jsx` | Partial apply buttons missing (`["palette"]` only / `["fonts"]` only). Photo style input missing. |
| Palette swatch edit | Static display only | No color picker. `patchMemory({ palette })` not called from UI. |
| Voice tone | Read-only `<dd>` in Voice section | Not editable. Auto-save on blur not wired. |
| Preferences ChipList | `brand.preferences` exists in schema | Not surfaced in `Brand.jsx`. `ChipList` component exists, just not used here. |
| Last audit chip | `api.listAudits(brandId)` exists | Not called in `Brand.jsx`. Right column has no audit summary. |
| Signal heuristic fallback | `VisionNotConfiguredError` raised → 503 | Should return `SignalResult(match=50)` not HTTP 503. Frontend has no amber badge handling. |
| Memory injection in asset_gen | `asset_gen._headline()` strips price/numbers | Does NOT check `brand.dont` rules. Amnesia Loop for generated copy. |

### Pillar 2: Asset Creator / Workspace

| Concern | What exists | Gap vs vision |
|---|---|---|
| Campaign generation | Full `generate_campaign` + `POST /agent/run` wired | Works. Core flow is correct. |
| AssetPreview CSS mockup | Fully built, correct knob mapping | Uses mock palette instead of live brand (Step 0 bug). |
| AssetCard "Signal not checked" badge | Code checks `signal_match !== null` — shows score if present | Never shows "Signal not checked" badge when `signal_match === null`. Empty gap. |
| Re-check signal button | Button exists in `AssetCard` | Not wired — onClick does nothing. |
| Workspace 3-col layout | Exists, correct structure | Chat history only shows last campaign chip, not typed message bubbles. Conversation model not started. |
| TracePanel | Shows static `TRACE_STEPS` | Not connected to real run events. Stagger animation not implemented. |

### Pillar 3: Campaign Manager

| Concern | What exists | Gap vs vision |
|---|---|---|
| Campaign list | `GET /v1/brands/{id}/campaigns` + `Campaigns.jsx` | Works but `Campaigns.jsx` has mock data fallback behavior to verify. |
| Campaign detail | `GET /v1/campaigns/{id}` + `CampaignDetail.jsx` | Passes `brandData` from mock to `AssetCard` — same Step 0 bug. |

### AI Layer

| Concern | What exists | Gap vs vision |
|---|---|---|
| Intent routing | `agent_run` always calls `generate_campaign` | No classifier. "Add product" → campaign generation (wrong). P0 acceptable per spec. |
| Memory injection | `generate_campaign` uses `brand.name`, `brand.category`, `brand.positioning` | Does NOT use `brand.dont`, `brand.do`, `brand.voice.tone`, `brand.preferences`. |
| Signal Check real LLM | `vision.py` fully built, temperature 0, retry-once | Works when `OPENROUTER_API_KEY` is set. |
| Signal Check heuristic | Router raises 503 on `VisionNotConfiguredError` | Must return valid `SignalResult` with `match=50` not crash frontend. |

---

## RUTHLESS P0 BUILD ORDER (12h solo)

### Block 1 — Foundation fixes (1.5h) — DO FIRST
These unblock every demo moment.

**1.1 [Agent 1]** Fix `AssetCard.jsx` mock import → accept `palette`/`fonts` props. (~20min)
**1.2 [Agent 1]** Fix `Workspace.jsx` to pass `brand.palette`/`brand.fonts` from `useBrand()` to `<AssetCard>`. (~10min)
**1.3 [Agent 1]** Fix `CampaignDetail.jsx` same way — verify it imports `brandData` and replace. (~10min)
**1.4 [Agent 2]** Fix `routers/signal.py`: catch `VisionNotConfiguredError`, return heuristic `SignalResult(match=50, verdict="needs_fix", issue="heuristic fallback — AI key not configured", evidence=["Signal Check requires OPENROUTER_API_KEY"], fix=FixKnobs())` instead of 503. (~20min)
**1.5 [Agent 3]** Fix `asset_gen._headline()`: after computing `headline`, check each word against `brand.dont` rules. If any dont rule phrase (lowercased, split by spaces) overlaps the headline words, fall back to `brand.name`. (~20min)

### Block 2 — Brand Builder P0 gaps (2.5h)

**2.1** `Brand.jsx` — Products section: add/remove rows, `name` + `price` inputs, empty state, include in `dirty` check and `save()` call. (~75min total)
- Local state: `const [products, setProducts] = useState([...brand.products])`
- Dirty: `|| !sameProducts(products, brand.products)` (deep compare name+price)
- `save()`: include `products` in `patchMemory` body
- UI: `+ Add product` button, row per product with name/price inputs and remove button, empty state text

**2.2** `Brand.jsx` — Palette swatch color picker: add `<input type="color">` hidden per swatch. On swatch click trigger the input. On `change`/`blur`, call `patchMemory({ palette: { ...brand.palette, [key]: newHex } })` immediately. Toast on success/error. (~30min)

**2.3** `Brand.jsx` — Voice tone editable: replace the `<dd>` for `tone` with `<input type="text" maxLength={300}>`. Auto-save on blur. (~20min)

**2.4** `Brand.jsx` — Preferences ChipList: add `const [preferences, setPreferences] = useState([...brand.preferences])`. Add `<ChipList title="Preferences" items={preferences} onChange={setPreferences} />` between Don't and Voice sections. Include in dirty + save. (~20min)

**2.5** `Brand.jsx` — Last audit chip in right column: `useEffect` calls `api.listAudits(brand.id)` on mount, stores `audits[0]`. Render below the Positioning section: consistency score chip + "Run audit" link. (~20min)

### Block 3 — AssetCard "Signal not checked" badge (30min)

**3.1** `AssetCard.jsx`: when `signal_match === null || signal_match === undefined`, render `<span className="bg-zinc-100 text-zinc-500 text-[11px] px-2 py-0.5">Signal not checked</span>` instead of empty. This is the spec invariant that must never be blank.

**3.2** Wire the Re-check button: `onClick` calls `api.checkSignal(brandId, rasterizedBlob, 1)`, shows spinner in badge during call, updates badge inline on return. Requires `brandId` prop on `AssetCard` (pass from `Workspace.jsx` and `CampaignDetail.jsx`). Rasterize via `rasterize.js` if it exists; if not, skip rasterize and just disable Re-check until F5 proper. (~30min total)

### Block 4 — Workspace conversation model (1.5h)

**4.1** `useAgent` hook: add `messages` state (array of `{ role, content, action_type }`). On `run(goal)`: append user message, then append AI response on resolve. This replaces the current single `campaign` state with a richer conversation list.

**4.2** Left column conversation rendering: render `messages` as bubble pairs (user right-aligned `bg-zinc-100`, AI left-aligned transparent). The last AI message shows the generate action block: `"✦ Generated campaign [chip] · 4 assets · Draft · [→ View in Campaigns] [→ Open in Editor]"`. (~45min)

**4.3** TracePanel stagger: after campaign resolves, fill trace events with 60ms CSS stagger using `setTimeout` per event or `transition-opacity` with inline delay. Final event in `text-emerald-600 font-medium`. (~20min)

### Block 5 — Demo polish (30min)

**5.1** Workspace idle state example chips: 3 example pills below AskBar: "Launch our truffle burger at ₹399 this weekend" / "Check our brand signals" / "What rules do we have?" — click to fill AskBar.

**5.2** Verify `BrandContext` loading state shows skeleton pulse (already implemented, just verify it works).

**5.3** Quick pass: every amber heuristic badge visible (Signal Check heuristic fallback badge in `SignalCard`/`Workspace` — add amber badge display when `signal.issue.includes("heuristic fallback")`).

---

## AI SEAM CHECKLIST

How each AI feature stubs now and what happens when the key flips on:

| Feature | Stubbed (no key) | With key | Code location | Verified |
|---|---|---|---|---|
| Brand DNA (propose_positioning, propose_do_dont, propose_tone) | Pure heuristic, always works | Same heuristic (no LLM path here) | `brand_dna.py` | No key needed |
| Identity directions (nearest-2 cosine) | Pure Python cosine on 5 templates | Same (no LLM path) | `identity.py` | No key needed |
| Signal Check (vision LLM) | Returns `match=50, verdict="needs_fix", issue="heuristic fallback"` (after P0 router fix) | Calls `check_signals()` → OpenRouter vision model, parses `VisionCriticResponse`, computes `match` deterministically | `vision.py` + `routers/signal.py` | Fix router first |
| Campaign generation (asset_gen) | Deterministic regex headline + knobs | Same (no LLM path yet; LLM copy pass is P1) | `asset_gen.py` | No key needed |
| Brand Audit | Heuristic fallback (same pattern as Signal Check) | Calls vision LLM per image | `routers/audit.py` + `vision.py` | Verify audit router handles `VisionNotConfiguredError` same way |
| Agent intent classify (F7) | Not built — all goals → `generate_campaign` | P1: separate classify step | `routers/agent.py` | N/A P0 |

**Key flip procedure:** Set `OPENROUTER_API_KEY=<key>` in `.env`. Restart backend. Signal Check immediately uses real vision. No code change needed — `vision.py` auto-detects key presence via `VisionNotConfiguredError` pattern.

---

## REUSE vs. REWRITE vs. CUT

### Reuse as-is (zero changes)
- All 6 backend endpoints for Brand Builder: `PATCH /memory`, `POST /memory/rules`, `GET /identity`, `POST /identity/apply`, `POST /signal-check`, `GET /audits` — fully functional
- `ChipList.jsx`, `SliderRow.jsx`, `Toast.jsx` / `useToast`, `BrandIdentityCard.jsx` — drop in for new sections
- `api.js` — all methods exist including `listAudits`, `appendRule`, `applyIdentity` with `fields` support
- `AssetPreview.jsx` — fully correct, just needs real `palette`/`fonts` props instead of mock
- `BrandEditorInner` `key={brand.id}:${brand.version}` remount pattern — correct, must not break
- `vision.py` — production-grade, do not touch
- 91 pytest tests — do not break

### Targeted edits (surgical changes only)
- `AssetCard.jsx` — remove mock import, accept props (Step 0)
- `Workspace.jsx` — pass palette/fonts from useBrand, add conversation messages, trace stagger
- `CampaignDetail.jsx` — same mock-to-live brand wire-up as AssetCard
- `Brand.jsx` — add 5 P0 sections (products, palette picker, voice tone input, preferences, audit chip)
- `routers/signal.py` — one catch block change (10 lines)
- `asset_gen._headline()` — add dont-rule word check (10 lines)

### Cut (P0, not P1)
- Chat intent classifier / `type: "clarify"` / `type: "memory"` action blocks — too complex, P1
- Diff card for identity apply from chat — P1
- Auto-fix loop (was already cut by owner)
- `BrandCompletenessCard` component
- Inline `AssetPreview` rasterize-and-recheck (keep button, disable onClick until F5 proper)
- Photo style partial apply buttons ("Take palette only" / "Take fonts only") in direction cards
- Bottom sheet mobile layout

---

## RISKS AND FALLBACKS

| Risk | Probability | Fallback |
|---|---|---|
| Palette color picker fires too many `patchMemory` calls (on every picker hover) | Medium | Debounce 500ms OR use `input` `blur` event only, not `change` |
| `brand.products` is `null` not `[]` from legacy seeded brand (seed was created before products field existed) | Low-medium | In `BrandEditorInner`, initialize as `useState([...(brand.products ?? [])])` |
| `api.listAudits` returns empty list for fresh demo brand | Certain for first run | Render "No audit yet" state — already specced. Not a bug. |
| `BrandEditorInner` remount discards unsaved positioning if chat fires `setBrand` mid-edit | By design (spec says this) | Warn user: add `"Unsaved changes will be reset"` to Save button tooltip if `dirty && brand.version !== savedVersion`. P1. |
| Fonts not loading for new direction | Low | `loadBrandFonts(fonts)` in `AssetPreview` already handles this via Google Fonts |
| `CampaignDetail.jsx` unknown shape — may have deeper mock import nesting | Low | Read file before editing (already in plan) |
| Signal Check `VisionCheckError` (502) shown as blank to user | Existing bug | Add to `routers/signal.py` fix pass: catch `VisionCheckError` and return `SignalResult(match=0, verdict="needs_fix", issue="Vision check failed — retry")` |

---

## FILE CHANGE MAP

```
backend/routers/signal.py           — heuristic fallback (Block 1.4)
backend/asset_gen.py                — dont-rule headline check (Block 1.5)

frontend/src/components/AssetCard.jsx       — remove mock import, add "Signal not checked" badge (Blocks 1.1, 3.1, 3.2)
frontend/src/pages/Workspace.jsx            — pass palette/fonts, add messages, trace stagger (Blocks 1.2, 4.1–4.3)
frontend/src/pages/CampaignDetail.jsx       — pass palette/fonts from useBrand (Block 1.3)
frontend/src/pages/Brand.jsx                — products, palette picker, voice tone, preferences, audit chip (Block 2.1–2.5)
```

No new files required for P0. No new backend routes required. No schema changes.

---

## 10-LINE SUMMARY

See end of file.

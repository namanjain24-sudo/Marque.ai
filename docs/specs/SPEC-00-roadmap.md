# Marque.ai — Master Roadmap (post-audit)

**Context:** hackathon, solo + Claude, ruthless P0. AI is **stubbed/off by default** to save
credits; every AI feature is built so it *works first try* when the key is flipped on.
The template for all AI work is `vision.py` (F4) — the one genuinely good LLM integration
already in the repo.

**The core problem (from the audit):** the "AI brand agent" has almost no AI in it. F1/F3/F5
are lookup tables with "LLM later" comments. The only real LLM feature (F4 Signal Check) is
disconnected from the rest. The plan below fixes that *cheaply and safely*.

---

## Status snapshot (verified this session)

| Area | Reality | Keep / Fix |
|---|---|---|
| F1 Brand DNA | Lookup tables, brand-blind | **Make LLM (Phase 1)** |
| F2 Memory | Good CRUD, real race bug fixed | Keep; make it *matter* (Phase 2 reads it) |
| F3 Identity | 5 curated templates, nearest-of-5 | Keep; optional LLM polish later |
| F4 Signal Check | Real vision LLM, well-built | **Keep. It's the crown jewel.** |
| F5 Asset gen | Regex "agent" | **Make LLM copy (Phase 2)** |
| F6 Campaign | Thin (4 formats, shared core) | Folds into Phase 2 |
| F7 Orchestrator/trace/ask-bar | Fake trace, no real agent | Phase 4 (thin) |
| F8 Library | **Missing file, was deleted** | Phase 3 (thin real) |
| F10 Audit | **Missing file** | Cut unless time |
| Infra/CI/deploy | Real, live | Keep |
| **Tooling** | `main.py` edits revert; rtk fakes command output | **BLOCKER — fix first** |

---

## Phase 0 — Honesty + unblock (ZERO AI, do first)

1. **Fix the tooling blocker.** `main.py` edits revert on disk; `rtk`/proxy fabricates
   command output (fake `IMPORT_OK`, mangled grep). Until this is fixed, no backend code can be
   trusted. Likely: an editor holding an unsaved buffer, a sync tool, or another agent session.
2. **Delete dead imports** in `main.py` (`routers.assets`, `routers.audit`, `uploads`,
   `StaticFiles`, `/media` mount) — they reference files that were never committed and break
   startup. (Edits written 2x, reverted 2x — pending #1.)
3. **Rename the "agent" honestly.** `asset_gen.py` / `routers/agent.py` are a deterministic
   heuristic, not an agent. Comment/label as the fallback, so the codebase doesn't lie.
**Exit criteria:** `main.py` imports clean and *stays* clean; `pytest` runs; command output trustworthy.

---

## Phase 1 — Real LLM Brand DNA (spec'd: SPEC-P1-llm-brand-dna.md)

Turn F1's lookup tables into real per-brand DNA via one LLM call, behind the auto-switch,
with graceful fallback and zero-credit mocked tests. **Already fully specified** — see that file.
Biggest "it's generic" win per hour. Open questions pending your answers (expose `dna_source`?,
model choice, golden fixture?).

---

## Phase 2 — Real copywriter / the "agent" (the second-biggest win)

**Problem:** `generate_campaign` is regex — grabs a price + first clause. No real copy, and
Brand Memory (F2) is never actually *used* to make a decision, so "memory" is inert.

**What it becomes:** one LLM call that takes `goal + full brand profile (voice, do, dont,
positioning, products)` and returns a strict **Creative Core**:
- `headline`, `subline`, `price`, `cta` per the PRD's slot contract (9.2)
- Hinglish option, ₹ formatting, festival awareness when the goal mentions one
- **Facts rule enforced in Python, not the LLM:** price/discount/dates come only from the
  owner's words; if no price given, a visible placeholder — the model never invents an offer.

**Seam (same as Phase 1):** key present → LLM copy; else → current regex fallback. Same output
schema (`slots`), so the renderer and campaign persistence don't change.

**Why it's high-value:** this is what makes F2 Memory real — the demo line "it already knows our
brand voice, watch it write on-brand copy" only works once copy is LLM-generated from memory.
And it directly uses the `do`/`dont` rules so "the agent respects my rules" becomes demonstrable.

**Tests (zero credit):** mocked happy path, bad-JSON retry, fallback-on-failure, and the
**facts rule** (goal with no price → placeholder, never a hallucinated number) — this last one
is the trust/safety test judges care about.

**Depth:** medium spec when we get here. Reuses vision.py pattern + Phase 1's schema discipline.

---

## Phase 3 — Library persistence, thin (F8)

**Problem:** generated campaigns persist (agent router does write `campaigns`/`assets`), but
there's no honest list/detail read surface after the `routers.assets` file was deleted. The
frontend has `Library.jsx`, `CampaignDetail.jsx`, `Campaigns.jsx` expecting data.

**What it is (no AI):** restore the thin read endpoints the frontend needs —
`GET /v1/brands/{id}/campaigns` (exists in agent router), `GET /v1/campaigns/{id}` (exists),
and whatever `Library.jsx` calls that 404s now. Wire frontend to them. "Export all" (zip of
PNGs) is **deferred** — depends on server-side render (not doing the loop, so maybe skip).

**Acceptance:** every generated campaign shows in the Library under the right brand, click
through to detail, no dead screens. Pure plumbing.

**Depth:** small. Mostly reconnecting what the deleted file was supposed to serve.

---

## Phase 4 — Make the agent *feel* like an agent (thin F7)

**Problem:** the trace panel is theater — the backend returns a canned campaign instantly, the
trace is a fake animated list.

**Two honest options (pick at the time):**
- **A (cheap, honest):** emit a *real* trace of the *real* steps the code actually does —
  "Loaded Brand Memory", "Wrote creative core (LLM)", "Filled 4 templates", "Saved campaign".
  No fake "Signal 74→91" (we cut the loop). Real, just modest. Stream via SSE or return the
  trace array with the response.
- **B (skip):** drop the trace panel; don't claim "agent reasoning" we don't have.

**Ask bar intent routing:** the PRD's `create_campaign / brand_question / update_memory`
classifier. **Thinnest version:** one LLM call classifies intent → routes to the existing
endpoint. Only worth it if Phases 1-2 land with time. Otherwise the ask bar just = "run campaign".

**Depth:** small-medium. Decide A vs B based on remaining time.

---

## Explicitly CUT (don't build)

- **F4 auto-fix loop** — your call, dropped. (Was the biggest build; removing it is the single
  largest time saver.) Signal Check stays as a manual "check this asset" feature.
- **Server-side Playwright render** — only needed for the loop. Cut with it. (Signal Check keeps
  working on *uploads*; if we want to check *generated* assets, revisit — but not now.)
- **F10 Audit, F11 Photography, F12** — PRD P1, cut for solo/12h.
- **Real image-gen for hero backgrounds** — nice visual win, but doesn't fix the "no
  intelligence" root problem. Only if everything else lands + credits approved. Assets stay
  CSS/gradient (make them *look designed* instead — cheap polish, see Phase 5).

---

## Phase 5 — Cheap polish (if time, no AI)

- Make `AssetPreview` actually look designed (it's one gradient box today) — real layout
  variants, better type scale, the price badge treatment. Pure CSS, zero cost, big visual lift
  for the demo since "the product is about good design."
- Fix the `maxWidth: 360px` cap so exports/previews aren't tiny.
- Demo seed: ensure Burger Lab + one pre-made campaign always present so the app is never empty.

---

## Build order (recommended)

```
Phase 0  (unblock + honesty)        ← REQUIRED, blocked on tooling
Phase 1  (LLM Brand DNA)            ← specced, biggest generic-fix
Phase 2  (LLM copywriter)           ← makes Memory real, 2nd biggest
Phase 3  (library plumbing)         ← reconnect dead screens
Phase 4  (real/thin trace + ask)    ← "feels like an agent", time-permitting
Phase 5  (CSS polish)               ← demo shine, time-permitting
```

Each phase: spec → you approve → build → mocked tests green (zero credits) → you review.
Credits spend ONLY when you deliberately flip the key and run one real call per feature.

---

## The 3 demo-winning claims this plan can honestly support

1. **"It reads your brand and writes real, on-brand copy"** — Phases 1+2, real LLM, uses your
   actual voice/rules from Memory. Not a template.
2. **"It checks what your customer will feel and scores it"** — F4, already real, the crown jewel.
3. **"It never invents offers"** — the facts rule (Phase 2), a trust point judges respect.

What we *cannot* honestly claim (and shouldn't): the self-correcting auto-fix loop (cut), and
AI-generated photography/logos (cut). Honesty per PRD §5.2 — don't fake the demo.

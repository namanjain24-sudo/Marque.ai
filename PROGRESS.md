# Marque.ai — Progress Log

Kept up to date as we build. Status, what's tested, and anything that needs
manual action from you are all here — check this file first before asking
"what's done so far".

Feature IDs (F1, F2, ...) match the PRD (`docs/BrandOS_PRD_BharatAgentic.docx`).
Product name is **Marque.ai** (the PRD's internal codename "BrandOS" is not used anywhere).

## Status

| Area | Status |
|---|---|
| Infra: Docker (React + FastAPI + Postgres), CI, Azure VM deploy | ✅ Done, live at http://20.80.105.52/ |
| Base setup: DB schema, Brand Profile contract | ✅ Done |
| F1 — Brand Onboarding + Brand DNA | ✅ Done, thoroughly tested (backend only, no UI yet) |
| F2 — Brand Memory | ✅ Done, thoroughly tested — found + fixed a real concurrency bug |
| F3 — Brand Identity (light) | ✅ Done, thoroughly tested — found + fixed a matching concurrency bug |
| F1+F2+F3 combined | ✅ Integration-tested together (same brand, multiple brands, persistence) |
| Automated test suite | ✅ 71 pytest tests (`backend/tests/`), wired into CI with a Postgres service |
| F4 and onwards | Not started |

---

## Infra (Docker, CI, deploy)

- `docker-compose.yml` (local dev) / `docker-compose.prod.yml` (deploy — only
  frontend port published, backend/db stay internal).
- `backend/Dockerfile`, `frontend/Dockerfile` + nginx reverse proxy (`/api/*` → backend).
- GitHub Actions CI (`.github/workflows/ci.yml`): lint/build frontend, import-check
  backend, build both Docker images. Runs on every push to `main`.
- Deployed on an **Azure VM** (not EC2 — the access we got was Azure, just FYI;
  `ved-b2s_group`, Ubuntu 24.04, 1 vCPU / 2GB RAM + 2GB swap). Manual redeploy
  steps are in `DEPLOY.md`.
- Only port 80 reachable from the internet; Postgres and the backend are
  internal-only (verified from outside with direct connection attempts — both timeout).

## Base setup

- `backend/models.py` — 6 Postgres tables: `brands`, `campaigns`, `assets`,
  `products`, `audits`, `runs` (PRD Section 9.5).
- `backend/schemas.py` — the Brand Profile contract (PRD Section 9.1) as Pydantic
  models: positioning sliders, palette, fonts, logo, voice, do/dont, etc.
- `backend/seed.py` — demo brand "Burger Lab" (PRD's own example data), seeded
  once on startup so the app is never empty.
- Tested: fresh startup creates tables + seeds demo brand exactly once;
  confirmed no duplicate seeding across restarts; confirmed data survives
  container restarts and full volume-reset rebuilds.

## F1 — Brand Onboarding + Brand DNA

`POST /v1/brands` — owner submits name/category/city/audience/price_level/
personality words/products. The agent fills in the rest of the draft:

- **Positioning sliders** (`backend/brand_dna.py: propose_positioning`) — a
  deterministic heuristic that nudges the 4 axes (premium/modern/playful/niche)
  based on personality words and price level. No AI call, so it's instant.
- **Do/dont rules** (`propose_do_dont`) — always exactly 3 of each, with one
  slot that varies by price level (e.g. premium brands get "no cheap-looking
  discount badges").
- **Tone** (`propose_tone`) — a short tone phrase from personality-word hints
  (e.g. "bold, playful" → "confident, cheeky, ... no corporate words").
- **Starting palette + fonts + meaning** — reuses the closest-matching F3
  identity template (`backend/identity.py`) as a sensible starting point, so
  the draft is never half-empty. F3's own "pick one of 2 directions" flow can
  later override this.

**Why not the PRD's literal "vision LLM reads the website/logo/screenshots"
version?** That needs an LLM API key, which I don't have. See "Needs from you"
below. The heuristic approach above is what currently ships, and it satisfies
F1's own acceptance criteria (see testing below) without any external
dependency — reliable by design, consistent with the PRD's own "slots, not
free-form AI" philosophy (Section 5.1).

### Code-quality pass (bug found and fixed)

Re-reviewed the code looking for real bugs, verified each one by running it
rather than assuming:

- **Real bug, fixed**: `profile.meaning = draft_direction["meaning"]` (in
  `routers/brands.py` and `routers/identity.py`) assigned the *same dict
  object* from the module-level `identity.TEMPLATES` list, not a copy —
  confirmed by test (mutating `profile.meaning` after a plain attribute
  assignment did corrupt the shared template; going through a Pydantic
  constructor, e.g. `Palette(**dict)`, does not have this problem — also
  confirmed, not assumed). No request currently mutates `meaning` in place
  after assignment, so this wasn't live-exploitable yet, but it was a landmine
  for future code. Fixed both sites with `dict(...)` to copy. Verified the fix
  with the same before/after test.
- **Real gap, fixed**: whitespace-only names (`"   "`) were accepted
  (`min_length=1` doesn't catch whitespace). Public strings (name, category,
  city, audience, photo_style, personality words, do/dont/preference rules,
  product names/photo URLs) now go through shared bounded types in
  `schemas.py` (`NameStr`, `ShortStr`, `WordStr`, `RuleStr`) that strip
  whitespace and enforce min/max length. Applies to both `POST /v1/brands`
  and `PATCH /v1/brands/{id}/memory` — same bounds either way.
- **Real gap, fixed**: no upper bound on string length or list size on a
  public endpoint — a 100k-character name or a 500-item product list was
  silently accepted. Added `max_length` bounds (name/category 200 chars,
  personality/do/dont lists capped at 20 items, products capped at 100, a
  custom validator caps the `meaning` dict at 30 entries with bounded key/value
  length). Verified the exact boundary (20 items passes, 21 fails).
- Checked `brand_dna.py`'s list/dict returns for the same aliasing risk —
  verified (not assumed) that `[*GENERIC_DO, ...]` and the dict comprehension
  in `propose_positioning` both produce fresh objects, no sharing issue there.

### Tested (two full rounds, after the fixes above — all passing)

- **Timing**: onboarding responds in ~0.02–0.1s (PRD wants under 30s).
- **Field completeness**: 6 persona scenarios (bold/playful,
  premium/classic/formal, budget, no personality given, unknown personality
  words, minimal input) — every one produces a complete draft: palette, fonts,
  tone, all 4 positioning axes (0-100), exactly 3 do + 3 dont rules. No nulls.
- **Validation**: missing name/category → 422; price_level outside 1-3 → 422;
  whitespace-only or empty name/category → 422; product with no name or
  negative price → 422; malformed JSON → 422; unknown extra fields silently
  ignored (not an error); oversized strings/lists → 422 (see above).
- **Adversarial input**: Hinglish/Devanagari + emoji names round-trip exactly;
  SQL-injection-looking strings (`Robert'); DROP TABLE brands;--`) and
  XSS-looking strings (`<script>...`) are stored as inert text, not executed —
  confirmed the `brands` table still existed and was queryable right after;
  numeric-string and whole-number-float `price_level` are coerced (standard
  Pydantic v2 lax-mode behaviour, not a bug); non-numeric garbage
  (`"2abc"`) is rejected; duplicate/mixed-case personality words don't crash.
- **Editability**: every one of the 17 profile fields can be changed via
  `PATCH /v1/brands/{id}/memory`, including whitespace-stripping and the new
  length bounds applying there too — independently re-confirmed with a
  separate `GET` each time (not just an echo of the request).
- **Persistence**: data survives a backend container restart and a full
  rebuild from a fresh Postgres volume (checked twice, before and after the
  code-quality fixes); demo brand is never duplicated; demo brand's own data
  still validates cleanly against the new, stricter schema.

## F2 — Brand Memory

- `GET /v1/brands` — list all, ordered by creation time.
- `GET /v1/brands/{id}` — read one.
- `PATCH /v1/brands/{id}/memory` — partial update, merges into the existing
  profile. This is the "owner says 'never use neon colours', agent adds a
  Don't rule" tool from PRD Section 8.2 (`update_memory`).
- 404 on unknown brand id, for both read and patch.

Not yet testable end-to-end per the PRD's own acceptance line ("edit a rule,
then generate an asset, the rule is respected") — asset generation doesn't
exist yet (that's F5/F6).

### Bug found and fixed: lost updates under concurrent writes

Tested what happens when multiple writes hit the same brand at once (realistic
for an agent — F7's orchestrator could fire several tool calls in parallel,
same as F1's onboarding fires several proposal steps). Fired 5 concurrent
`PATCH /memory` calls, each setting a different field, at the same brand:
**3 of 5 changes were silently lost.** Root cause: the handler did a plain
read → modify in Python → write, with no locking, so concurrent requests
clobbered each other's writes (classic lost-update race).

Fix: `session.get(Brand, brand_id, with_for_update=True)` — a Postgres
row-level lock (`SELECT ... FOR UPDATE`) for the duration of the request, so
concurrent patches to the same brand serialize instead of racing. Re-ran the
exact same test after the fix: 5/5 concurrent patches landed correctly.
Repeated with 8 concurrent writers across 5 separate brands to rule out a
fluke pass — 5/5 runs, zero lost updates each time.

The same unlocked read-modify-write pattern existed in F3's
`POST /identity/apply` (not in test scope yet, but it's the exact same bug) —
fixed there too for consistency, same mechanism.

### Other findings

- **Fixed**: an empty patch (`{}`) or a patch that doesn't actually change
  anything (e.g. setting a field to the value it already has) no longer bumps
  `version`. Before the fix it always did, even as a no-op — `version` is
  meant to reflect real changes.
- **Confirmed working**: sending an explicit `null` for an optional field
  (e.g. `{"city": null}`) does clear that field, and doesn't touch fields
  that weren't included in the patch body — verified this distinction
  actually holds via Pydantic's `exclude_unset`, not assumed.
- **Resolved**: patching a list field (`dont`, `do`, `preferences`) via
  `PATCH /memory` still **replaces the whole list** — that's unchanged and
  stays the right behavior for "set this to exactly these values" (e.g. a
  UI with a full rules-editor screen). But per your call, added a second,
  additive path for the common case PRD actually describes ("owner says
  'never use neon colours', agent adds a Don't rule"): see
  `POST /memory/rules` below.

### New: `POST /v1/brands/{id}/memory/rules` — add one rule without resending the list

Body: `{"field": "do" | "dont" | "preferences", "value": "..."}`. Appends
`value` to that list if it isn't already there; if it's already present,
it's a no-op (no duplicate, no version bump) — so an agent can call this
repeatedly with the same rule without the list growing junk. Respects the
same size caps as everything else (20 for do/dont, 40 for preferences) —
422 once a list is full. Row-locked the same way as `PATCH /memory`.

8 tests: appends without touching other entries, duplicate is a no-op,
works for all three fields, 404/422 cases, the cap is enforced exactly at
the boundary, and 6 concurrent appends to the same brand at once all land
(no lost entries — same lost-update bug class as everything else this
session, so it got the same test treatment up front instead of waiting to
find it the hard way).

`PATCH /memory` is still there for "replace the whole list" / editing
everything at once; this is for the one-at-a-time case.

## F3 — Brand Identity (light)

Now thoroughly tested (23 checks: shape/completeness of proposals, determinism,
404s on unknown brand/key, exact palette/fonts/meaning on apply, switching
directions fully replaces the previous ones with no mixing, apply doesn't
touch unrelated fields, persistence, all 5 templates individually applyable).

- `backend/identity.py` — 5 curated identity templates (palette + font pair +
  "meaning" text each), covering 8 Google Fonts total. `propose_identity(
  positioning)` returns the 2 closest-matching templates by distance to the
  brand's positioning sliders.
- `GET /v1/brands/{id}/identity` — the 2 proposed directions.
- `POST /v1/brands/{id}/identity/apply` — locks a chosen direction's
  palette/fonts/meaning into Brand Memory (version bump).

### Improvement: "lock/regenerate individual parts"

PRD F3 describes the owner being able to "lock/regenerate individual parts
(colours, fonts)" of a direction — the original `apply` only supported taking
the whole direction (palette + fonts + meaning) at once. Added
`POST /identity/apply` body field `fields: ["palette"] | ["fonts"] | both`
(omit it to apply everything, the old behavior, so this is backward
compatible): pass `["palette"]` to take only the colours from a template and
leave the brand's current fonts alone, or `["fonts"]` for the reverse.
`meaning` only updates on a full apply (its text isn't cleanly splittable
between "this explains a colour" vs "this explains a font" in the template
data). An empty `fields: []` or an unknown field name is rejected (422) — 12
tests cover this, including that an uploaded logo survives a partial apply
too.

### Bugs found and fixed here too

- Same lost-update race as F2 (no row lock) — same fix (`with_for_update=True`).
  Tested with mixed concurrency (identity-apply racing against memory-patch on
  the *same* brand at the same time, 5 operations at once): all landed
  correctly, confirmed over several repeated runs.
- Same version-on-no-op inconsistency as F2 — re-applying the same already-
  applied direction no longer bumps `version`. Fixed and verified.
- Investigated an apparent inconsistency (two concurrent applies to the same
  brand sometimes produced a different final `version` number across runs —
  5 vs 6). Dug into it rather than assuming either "it's fine" or "it's a
  bug": root cause is that `F1` auto-fills a brand's starting palette using
  the *same* closest-template matching `F3` uses, so if a concurrent apply
  happens to target the direction that's already active, that specific apply
  is legitimately a no-op — and which of two racing applies goes first
  (therefore which one "wins" as the real change) is naturally
  non-deterministic. No data was lost in any run (verified 8x); the varying
  version count is a correct side-effect of the no-op optimization, not a bug.

## F1 + F2 + F3 — combined integration testing

Tested together, not just individually, per your ask:

- Full journey on one brand: onboard (F1) → propose + apply identity (F3) →
  patch a Don't rule (F2) → confirm the F3 identity survived the F2 patch →
  re-fetch independently → everything consistent.
- Two brands patched concurrently — confirmed no cross-brand leakage (brand
  A's rule never appeared on brand B and vice versa), and confirmed each
  brand's `meaning` dict is independently owned (the earlier shared-dict bug
  can't resurface across brands either).
- Full brand list reflects everything created across all three features.
- One combined mega-regression script (21 checks spanning base setup + F1 +
  F2 + F3 + cross-feature) run against a fully fresh container rebuild: 21/21
  passed. Two assertions failed on the first run of two different scripts —
  both were mistakes in my own test script's expected numbers (an off-by-one
  brand count, and not accounting for the F1/F3 no-op overlap above), not
  product bugs. Re-checked by hand before concluding that, not assumed.
- Re-verified persistence across a full container restart after all the
  above, and CI-equivalent checks (backend import, frontend `npm run build`)
  both still pass.

## Automated test suite (new this round)

All the ad-hoc curl/Python scripts used for manual testing throughout this
log are now a committed pytest suite instead — `backend/tests/` (54 tests:
`test_onboarding.py`, `test_memory.py`, `test_identity.py`,
`test_integration.py`), run with `uv run pytest tests/ -v` from `backend/`
(needs Postgres reachable at `localhost:5432`, e.g. via `docker compose up -d
db`; it creates and uses its own `marque_test` database, never touches dev
data). Wired into CI with a Postgres service container.

Building this surfaced two more real bugs that manual curl testing had been
missing:

- **Real bug, fixed**: `PATCH /memory`'s merge used
  `patch.model_dump(exclude_unset=True)`, which flattens nested models
  (`Palette`, `Fonts`, `Logo`, `Voice`, `Positioning`) into plain dicts before
  merging them into the current profile via `model_copy`, which does **not**
  re-validate on update. So after certain patches, fields typed as e.g. `Logo`
  actually held a plain `dict` for the rest of that request — harmless for
  the final JSON response (dicts and model instances serialize the same way),
  but wrong for anything doing attribute access on `merged` within the same
  request, and it broke the no-op check (`Logo(...) == {dict}` is always
  `False` in Pydantic, even for identical values, so patches that only
  touched a nested-model field could never be detected as a no-op). Fixed by
  pulling the already-validated values straight off `patch` via
  `patch.model_fields_set` instead of dumping and re-merging dicts. Found via
  a Pydantic serializer warning pytest surfaced that curl testing never
  printed or looked for.
- **Real bug, fixed**: the backend `Dockerfile`'s `CMD` ran `uv run uvicorn
  ...`, and `uv run` auto-syncs the environment against the lockfile by
  default — which silently reinstalled `pytest`/`pytest-asyncio` (the whole
  dev dependency group) into the *production* container at every startup,
  even though the build stage correctly used `--no-dev`. Only caught because
  I went looking for it after adding dev dependencies for this test suite;
  verified by inspecting the running container's `site-packages` directly
  (not through another `uv run` call, which would've triggered the same
  resync and hidden the bug again). Fixed with `uv run --no-sync` in the
  `CMD`, and added `tests/` to `backend/.dockerignore` so the test source
  doesn't even get copied into the image. Matters more than it would on a
  normal server given the VM's 2GB RAM.

## Code-quality pass (another round, verified not assumed)

Re-tested F1, F2 and F3 separately (22, 10 and 19 tests respectively, each
run in isolation with `pytest tests/test_<name>.py`) and together (3
integration tests + the full 63-test suite), then read through every backend
file again looking for real issues:

- **Fixed**: `routers/brands.py` hand-rolled `f"brand_{uuid.uuid4().hex[:12]}"`
  for new brand IDs instead of reusing `models.new_id("brand")`, which is
  already the single source of truth for this exact format (used by every
  other table's SQLAlchemy column default). Two places generating the same
  ID format independently is exactly the kind of thing that quietly drifts —
  now there's one.
- **Fixed, real gap**: `Palette`'s colour fields (`primary`, `secondary`,
  etc.) accepted *any* string — `"banana"` was a valid primary colour.
  Checked all 5 identity templates' and the seed brand's hex codes first
  (`grep -oE '#[0-9A-Fa-f]{3,8}'`) to confirm they're all proper 6-digit hex
  before adding a `^#[0-9A-Fa-f]{6}$` pattern constraint, so the fix couldn't
  break existing data. 6 new tests cover both valid and several invalid
  shapes (short hex, 8-digit hex-with-alpha, missing `#`, non-hex letters,
  a plain colour name).
- **Fixed, real gap**: `Logo.type` was an unconstrained `str`; grepped the
  whole codebase and confirmed only `"wordmark"` and `"upload"` are ever
  used, then constrained it to `Literal["wordmark", "upload"]`.
- **Fixed, real gap**: the demo brand was inserted into Postgres as a raw
  dict (`Brand(profile_json=DEMO_BRAND_PROFILE)`), unlike every other write
  path in the app, which all validate through `BrandProfile` first. If the
  schema and the seed data ever drifted (e.g. a new required field), this
  would have failed silently at startup and only surfaced as a 500 the first
  time anything read the seeded brand. Now goes through `BrandProfile(**...)`
  like everything else — a bad seed now fails loudly at startup instead.
- **Improvement**: `GET /v1/brands` had no limit on how many rows it would
  return — fine today, but an unbounded public endpoint that grows with
  every brand ever created. Added `limit` (default 100, max 500) and
  `offset` query params; out-of-range values are rejected (422) rather than
  silently clamped. 2 new tests (pagination itself, and the rejected
  out-of-bounds values).
- **Improvement**: moved `IdentityApply.fields`'s "must be non-empty if
  given" check from manual logic in the route handler into the schema itself
  (`Field(min_length=1)`), consistent with how every other input bound in
  this codebase is enforced at the schema layer, not scattered across
  handlers.
- **Improvement**: `identity.py`'s `TEMPLATES` was `list[dict]` — any typo in
  a key (`t["palete"]`) would only be caught at runtime. Added `TypedDict`
  definitions (`IdentityTemplate`, plus the nested palette/fonts/mood
  shapes) so a static type checker (or an editor) catches that kind of
  mistake before it ships. No behavior change — verified with the full test
  suite before and after.
- Looked for (and didn't find) further instances of the two bug *classes*
  already fixed this session — re-grepped for every `model_copy`/
  `model_dump` call for the flattening issue, and for every `session.get`
  that reads-then-writes for the missing-lock issue. Nothing else matched.

All 63 tests still pass after every change above, both the whole suite and
each file in isolation; re-verified via a full `docker compose down -v && up
-d --build` (not just `uv run pytest` on the host) that the demo brand still
seeds correctly under the new, stricter validation, that the container
survives a restart with data intact, and that the running container still
has neither `pytest` nor `tests/` in it.

## Manual user-journey test (not automated)

Tried walking through the API the way an actual owner would, instead of
scripted/adversarial requests: onboarded a brand that doesn't exist yet
("Tea Theory", a small café in Bangalore — not the seeded demo brand),
reviewed the draft the way its owner would, looked at the 2 identity
directions, applied one, then asked for a preference in plain language the
way an owner actually talks ("never use neon colours, always show chai in a
kulhad if possible"). (Chrome wasn't available this session to click through
`/docs` directly, so this was curl calls made in that order and read the way
a person would, not a scripted assertion suite.)

Nothing functionally broke — same results as the automated suite — but this
surfaced 3 real UX gaps worth knowing about before anyone builds a frontend
on top of this API:

- **Identity direction keys are internal, not display names.** `GET
  /identity` returns things like `"key": "modern_minimal"` — fine for a
  frontend to switch on, but it reads as a raw slug, not something to show a
  user directly. Whoever builds the identity-picker screen needs to map
  these to friendly labels (PRD just says "2 directions", doesn't name them).
- **`version` isn't a reliable signal for "your save worked".** Applying an
  identity direction that happens to already match the brand's current
  palette is correctly a no-op (see the F3 section above) — `version`
  doesn't change. A frontend that shows "Saved!" only when `version`
  increments would stay silent on a no-op save, which looks like nothing
  happened even though the request succeeded. The UI should confirm on a
  successful response, not on a version diff.
- **The API is a structured form, not yet an assistant.** A real owner's
  request doesn't arrive pre-split into "this part is a Don't rule, this
  part is a preference" — I had to decide that split myself using knowledge
  of the schema. PRD's actual vision (F7's intent-classifying orchestrator,
  not built yet) is what's supposed to do that translation from one sentence
  into the right API calls. Not a bug in what exists today, but a concrete
  reminder of the gap between "backend with a clean contract" (done) and
  "something an owner can talk to directly" (not started).
- Validation error bodies (FastAPI's default Pydantic format — `detail: [{
  loc, msg, type, ... }]`) are clear to a developer but not something to
  show an end user as-is (e.g. a raw `"String should match pattern
  '^#[0-9A-Fa-f]{6}$'"` for an invalid palette colour). Expected to need a
  translation layer in whatever frontend consumes this API; not a backend
  problem since a real colour-picker input would never send a non-hex value
  in the first place.

---

## Needs from you (manual steps)

1. **LLM API key** (vision-capable, e.g. an Anthropic/OpenAI/Gemini key with
   image support) — only needed if you want the PRD's literal "read a website
   URL / logo / screenshots and extract real brand colours/fonts" version of
   F1. Without it, onboarding uses the heuristic defaults described above,
   which already work end-to-end. If you get a key, tell me which provider
   and I'll wire it in as an optional enhancement (gated so onboarding still
   works instantly if the key is ever missing/rate-limited).
2. Nothing else blocking right now for F1–F3.

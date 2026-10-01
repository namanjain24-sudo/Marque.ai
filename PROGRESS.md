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
| F1 — Brand Onboarding + Brand DNA | ✅ Done, thoroughly tested |
| F2 — Brand Memory | ✅ Done, thoroughly tested — found + fixed a real concurrency bug |
| F3 — Brand Identity (light) | ✅ Done, thoroughly tested — found + fixed a matching concurrency bug |
| F1+F2+F3 combined | ✅ Integration-tested together (same brand, multiple brands, persistence) |
| **Frontend** | ✅ Real UI for F1-F3: marketing home, onboarding form, brand dashboard |
| F4 — Brand Signaling + auto-fix (Check half) | ✅ Done, tested, verified against the live vision API — see below for what's intentionally not built yet |
| Automated test suite | ✅ 126 pytest tests (`backend/tests/`), wired into CI with a Postgres service |
| F5 (light) — Asset Creator + campaigns, F6/F7 hero chat | ✅ Done on this branch (deterministic generation) |
| F8 (light) — Asset Library (save-on-check) | ✅ Done, tested |
| F10 — Brand Audit | ✅ Done, tested |
| F11+ (Product Photography, Merch/Pitch) | Not started |

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

## Frontend (new this round)

There was no real UI before this — just the Vite starter page. `frontend/src`
now has an actual app: marketing home page, the F1 onboarding form, a brand
dashboard (positioning, identity directions with apply, Do/Don't/Preferences
editors), and the F4 Signal Check panel described below. React Router,
Tailwind v4, self-hosted fonts (including the 5 identity templates' 8 Google
Fonts, loaded on demand so the home page doesn't pay for all of them
up front). No design-system dependency beyond that — plain components.

Tested by hand against the real running stack end to end: created a brand
("Tea Theory", a Bangalore café) through the onboarding form, applied an
identity direction, added a memory rule, confirmed the dashboard, brands
list, and home page's live demo-brand preview all update correctly. Caught
and fixed three real bugs this surfaced that unit tests wouldn't have:
an input that visually inverted its own width due to a `w-full` class
clashing with `flex-1`, a long font name (`Playfair Display`) getting
silently truncated in the identity card, and a motion transition that made
the homepage's direction-switcher feel broken (card fully disappeared for
~1s) because it reused a scroll-triggered reveal animation for a click
interaction instead of an immediate one.

No automated frontend test suite yet (no component/e2e test runner is wired
up) — `npm run lint` and `npm run build` are clean and run in CI, but
everything above was verified manually in a real browser against the real
API, not asserted in a test file.

## F4 — Brand Signaling + auto-fix

The PRD's own star feature. Built the **Check** half for real; the **auto-fix
loop** (revise style knobs → re-render → re-check, up to 2 rounds) is not
built, because the thing it would revise and re-render — F5's asset
renderer — doesn't exist yet. That's a real, acknowledged scope line, not an
oversight: see "What's deliberately not built" below.

- `backend/vision.py` — `check_signals(profile, image_bytes, mime, round)`.
  Sends the image to a vision LLM (OpenRouter, `qwen/qwen3-vl-32b-instruct`
  by your choice — cheap, vision-capable) with a fixed rubric (0/25/50/75/100
  anchor descriptions per axis, authored from the PRD's own 0/100 poles in
  Table 8, since the PRD names the technique but not the anchor text) and the
  brand's target positioning, do/dont rules and meaning. Temperature 0, per
  PRD Table 25's reliability trick for this exact risk ("signal critic gives
  unstable scores").
- The LLM is only ever trusted for the qualitative read (`detected` axis
  values, `issue`, `evidence`, suggested `fix` knobs). `gaps`, `match` and
  `verdict` are computed in plain Python from the LLM's `detected` vs the
  brand's `target`, using PRD Table 9's formula exactly — same principle as
  F1's deterministic `brand_dna.py`, never trust the model's own arithmetic.
- **Found a real inconsistency in the PRD itself** while implementing this:
  Section 9.4's worked example states `"match": 74` for detected
  `{88,82,40,60}` against target `{70,80,75,55}`, but Table 9's own formula
  (`100 - average absolute gap`) applied to those exact numbers gives `85`,
  not `74`. The gaps and verdict in that example are internally consistent;
  only the match number is off, so it reads as an arithmetic slip in a
  hand-written illustrative example rather than a different intended
  formula. Implemented Table 9's formula as written (the one place that
  actually defines the rule) and have a test (`test_signal_math.py`) that
  asserts the gaps/verdict from the PRD's own example match, but asserts the
  *correct* match value (85), with a comment explaining the discrepancy —
  flagging this rather than quietly picking one number felt like the honest
  thing to do, same spirit as the F1/F3 "found and fixed" write-ups above.
- Reliability per PRD Table 13 ("Invalid JSON from LLM"): the response is
  validated against a strict Pydantic schema; on failure (bad JSON or wrong
  shape), it retries once with the actual validation error appended to the
  conversation so the model can self-correct, before giving up with a clear
  502.
- `POST /v1/brands/{id}/signal-check` — multipart upload (PNG/JPEG/WebP, 10
  MB cap per PRD Table 21's upload-security rule), `round` form field
  (1 or 2, per PRD's "max 2 rounds"). Checks *any* uploaded image against the
  brand's targets — not a saved asset, because there's no asset/library
  (F5/F8) to save one to yet. 404 on unknown brand, 503 if
  `OPENROUTER_API_KEY` isn't set (distinct from 502 for an actual upstream
  failure), 422 on a bad/oversized/empty file.
- Frontend: `SignalCheckPanel` on the brand dashboard — upload an image, see
  the PRD's own "score card" design (Section 12): match score, pass/needs-fix
  badge, the 4 axes as target-vs-detected markers on a hairline (not filled
  progress-bar tracks), the issue sentence, evidence bullets, suggested fix
  knobs.

### Tested

- 18 new pytest tests. 7 are pure math/schema unit tests (no network): exact
  match, the PRD worked example's gaps/verdict, the match formula, the
  "match ≥ 80 AND no single axis gap > 20" pass condition (including a case
  where a high match score must still fail because one axis blew past 20),
  and that `FixKnobs` rejects values outside the PRD's closed knob
  vocabulary (Table 14).
- 11 are endpoint tests with the OpenRouter HTTP call mocked
  (`pytest-httpx`): 404/422/503/502 cases, markdown-fenced JSON responses,
  the retry-once-on-bad-JSON path (asserted by checking exactly 2 requests
  were made), retry-exhausted still failing cleanly, an upstream HTTP error,
  and the `round` field's 1-2 bound being enforced.
- Also ran it for real, twice, against the live OpenRouter API (not
  mocked): once as a standalone script calling `check_signals` directly, once
  through the actual running Docker stack and the browser UI, both times with
  a real downloaded photo against the seeded Burger Lab brand. The model
  correctly identified the test image (a coffee mug) as unrelated to a
  burger brand and referenced Burger Lab's actual `dont` rules in its
  reasoning — confirms the brand context is really reaching the prompt, not
  just that the API call succeeds.
- Full suite (89 tests, all features) still green; `docker build` on the
  backend still succeeds from a clean image.

### Cost and reliability pass (this round)

You asked for cost to stay low and the thing to actually work well - did a
real pass on both rather than assuming either.

- **Measured actual cost, not guessed it.** OpenRouter returns real token
  usage per call. A normal-sized photo (800x1000, 27 KB): **$0.00026/check**.
  The same check on a 3000x4000 (553 KB) photo, unresized: **$0.00044** -
  prompt tokens scale with image resolution, confirmed by measurement, not
  assumption.
- **Fixed: images are now downscaled before being sent** (`_prepare_image` in
  `vision.py` - longest side capped at 1280px, re-encoded as JPEG). An
  owner's phone photo can be 10-20 MP for no benefit here; judging
  palette/typography/density doesn't need full resolution. After this
  change, the same 3000x4000 photo costs **$0.0003** - cost is now bounded
  regardless of what gets uploaded, instead of scaling with it. Re-verified
  with a new test (`test_large_image_is_downscaled_before_being_sent`) that
  actually decodes the bytes sent in the mocked request and checks their
  pixel dimensions, not just that the call succeeded.
- **This caught a real bug while I was at it**: Pillow's stricter decode (as
  part of adding the resize step) rejected one of this suite's own test
  fixtures - a hand-typed base64 PNG that had valid magic bytes but was
  corrupt past the header. The old code never actually decoded uploaded
  images (just re-encoded the raw bytes as base64 and sent them straight to
  the paid API), so a corrupt upload would have silently cost money on a
  request likely to fail or return garbage. Fixed the test fixture (now
  generated with Pillow instead of hand-typed) and added
  `InvalidImageError` -> 422, plus a dedicated test for exactly this shape
  of bug (valid magic bytes, corrupt body) so it can't come back unnoticed.
- **Verified determinism for real**: ran the identical image through
  `check_signals` 3 times against the live API. All 3 runs returned the
  exact same `detected` values and match score - temperature 0 and the
  fixed rubric are actually doing their job, not just configured and hoped
  to work.
- **Verified the pass path, not just needs_fix**: every real test so far had
  happened to fail (needs_fix). Built a brand whose target exactly matched
  what the model was detecting for a test image and confirmed `verdict:
  "pass"` with a gap of exactly 20 on one axis - the PRD's "no single axis
  gap > 20" boundary (strictly greater than, not >=) held correctly in a
  real response, not just in the unit test that asserts the same rule in
  isolation.
- Suite is now 91 tests (2 new: the corrupt-image case and the downscale
  verification). Full suite green, Docker image rebuilds clean, and the
  live dashboard UI re-tested end to end through the rebuilt container.

### What's deliberately not built

- **The actual auto-fix loop** (apply the suggested knobs, re-render, re-check,
  stop at 2 rounds or report the remaining gap per PRD Table 13). This needs
  F5's renderer to have something to apply knobs to and re-render. Right now
  `fix` is a real, schema-validated suggestion from the model — genuinely
  useful on its own — but nothing in this codebase executes it yet.
- **Rate limiting / daily spend cap** (PRD Table 21 names this as a real risk
  for a public endpoint: "someone spams the public endpoint"). Not built —
  there's no auth or per-IP tracking infra in the app yet. Worth knowing
  before this goes anywhere public; a single bad actor could run the
  (admittedly cheap) model a lot of times.
- Signal-check results aren't persisted anywhere (no `runs` row, no asset
  record) — consistent with F4 here checking an arbitrary upload rather than
  a saved asset, but means there's no history yet.

---

## Needs from you (manual steps)

1. ~~**LLM API key**~~ — done. You gave me an OpenRouter key, wired in for F4's
   Signal Check only (`backend/.env` / root `.env`, both gitignored — the key
   is not in git). Model is `qwen/qwen3-vl-32b-instruct` per your "cheap,
   Chinese" ask; current OpenRouter pricing is about $0.10 per million input
   tokens, so a single check (one image + a short brand context) is a small
   fraction of a cent. Not wired into F1's onboarding extraction yet (that's
   still the heuristic) — say if you want that too, it'd reuse the same key.
2. **Rate limiting** for `/signal-check` before this is public anywhere —
   see above. Not blocking for continued local development.
3. Nothing else blocking right now.


---

## F8 (light) — Asset Library (save-on-check)

There's no F5 renderer output to populate a library from in the usual way, so the
Library is fed by a **save-on-check** flow: after a Signal Check, the owner hits
**Save to library** and the uploaded image + its real match score are persisted as
an `Asset` row. The stored (downscaled) JPEG is the preview.

- `backend/uploads.py` — shared upload validation (magic-byte sniff, 10 MB cap,
  empty-file guard) extracted from `routers/signal.py` so F4/F8/F10 all use it,
  plus filesystem image storage (`save_image`/`delete_image`) under `MEDIA_ROOT`,
  served by FastAPI `StaticFiles` at `/media` (nginx proxies `/media/*` → backend).
  Images persist across container rebuilds via a Docker named volume (`media`).
- `backend/routers/assets.py` — `POST /v1/brands/{id}/assets` (multipart upload →
  re-runs `check_signals` so the asset always has a score → stores JPEG → records
  the row), `GET` (list, newest-first, `?type=` filter, paginated), `GET /{id}`,
  `DELETE /{id}` (removes row + file). Same error mapping as F4 (404/422/502/503).
- `LibraryAsset` schema kept separate from F5's `AssetOut` (rendered assets);
  `AssetPreview.jsx` renders the real `png_url` as an `<img>` for uploads and falls
  back to the CSS mockup for rendered assets.
- Frontend `Library.jsx` lists real assets; brand-health strip alerts come from the
  latest audit.
- **Cost/caveat:** each save is one vision call (~$0.0003) — same public-endpoint
  spend risk already flagged for F4; rate-limiting still deferred.

## F10 — Brand Audit (PRD Section 7 F10, P1)

Upload 2–5 existing creatives; a vision read of each is compared against the others
and Brand Memory to produce a consistency score, distinct-treatment counts, and the
top issues each with a suggested fix.

- `backend/vision.py` — `analyse_asset` reuses the F4 reliability scaffolding
  (temperature 0, fixed rubric, schema validation + retry-once-on-bad-JSON, image
  downscaling) via a shared `_critic_call`; the audit prompt additionally tags
  `font_style` / `photo_tone` / dominant `colours` per image.
- `backend/audit.py` — `run_audit` fans `analyse_asset` across the images
  concurrently, then computes everything **deterministically** (never from the
  model's arithmetic, same principle as F4):
  - **Consistency score** = `100 - mean(per-axis spread)/2`, clamped 0–100. The PRD
    gives the 0–100 range but no formula, so this one is ours and is unit-tested
    (`test_audit_math.py`): identical images → 100, max divergence on all axes → 50.
  - **Counts** = distinct `font_style` / `photo_tone` / colour values → the PRD's
    "N font styles, M colour treatments" summary.
  - **Issues** (top 3, each with a fix) ranked from font/colour/photo inconsistency
    and per-axis divergence; **alerts** flag images that read off-brand.
- `backend/routers/audit.py` — `POST /v1/brands/{id}/audit` (2–5 images, 422 outside
  that range) persists an `Audit` row and returns the report; `GET /audits` is the
  history.
- Frontend `Audit.jsx` posts the files and renders the score, summary, and each
  issue with its suggested fix. "Fix with Marque.ai" is deferred to F5's renderer
  (same honest deferral as F4's auto-fix loop).
- **Cost/caveat:** 2–5 vision calls per audit (~$0.0006–$0.0015). Bigger
  public-endpoint spend risk than F4 — rate-limiting still deferred.

### Tested

- `test_assets.py` (8): save creates row+file+score, unknown type → "other",
  list newest-first + type filter, get/delete (file removed), 404 unknown brand,
  422 bad/empty upload, 503 without key.
- `test_audit.py` (6): happy path (counts + ≤3 issues + fixes), 422 on <2 / >5
  images, 404 unknown brand, 503 without key, persistence via `GET /audits`.
- `test_audit_math.py` (7): the consistency formula and distinct-treatment counts,
  no network.
- Full suite **126 passing**; frontend `npm run lint` + `npm run build` green.

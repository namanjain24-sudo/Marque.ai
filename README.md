# Marque.ai

React + FastAPI + Postgres, fully dockerized.

## Architecture

The agent data path, top to bottom: AskBar goal → `classify_intent` → inject
Brand Memory → `generate_campaign` → Signal Check → persist. Numbered steps
`1`–`6` trace the request through the layers (client → edge → API → engines →
persistence).

```mermaid
flowchart TB
    subgraph L1["① CLIENT · browser-as-renderer"]
        U1["<b>1 · Workspace / 3-col chat</b><br/>AskBar → goal : str(1..500)<br/>chat · results · TracePanel"]
        U2["AssetPreview (CSS)<br/>palette+fonts ← useBrand()<br/>text = HTML, never image"]
        U3["rasterize.js<br/>DOM → PNG blob<br/>feeds Signal Check"]
        U4["Library / Campaigns / Brand<br/>where every AI result lands<br/>signal badges"]
    end

    subgraph L2["② EDGE · TLS · static · proxy"]
        N1["<b>2 · Caddy</b><br/>auto Let's Encrypt · TLS<br/>:80 → :443 · only exposed svc"]
        N2["nginx (frontend)<br/>serve SPA<br/>proxy /api · /media"]
    end

    subgraph L3["③ API · FastAPI · orchestrator"]
        R0["<b>3 · POST /agent/run</b><br/>classify_intent(goal)<br/>generate · read · memory · evaluate<br/>inject Brand Memory · do/dont in Python"]
        R1["brands / memory<br/>PATCH /memory · /rules · identity/apply"]
        R2["signal-check<br/>multipart · 422/502 typed · never 503"]
        R3["campaigns / assets<br/>GET lists · detail · library"]
        M0["Brand Memory · BrandProfile vN<br/>positioning · do/dont · voice"]
    end

    subgraph L45["④–⑤ ENGINES · reliability pattern · LLM ⇄ heuristic"]
        E1["<b>4 · asset_gen · F5</b><br/>slots + 6 knobs → 4 assets<br/>dont-guard · Facts Rule<br/>LLM copy ⇄ regex fallback"]
        E2["<b>5 · vision · F4 ★</b><br/>4 axes · detected vs target<br/>match = 100 − avg|gap| (Python)<br/>LLM ⇄ match=50 heuristic"]
        E3["brand_dna · F1<br/>positioning · do/dont · tone<br/>LLM ⇄ lookup tables"]
        E4["identity · F3<br/>5 templates · nearest-2 cosine<br/>deterministic · offline"]
        E5["audit · F10<br/>2–5 img consistency<br/>LLM ⇄ heuristic score"]
        SEAM(["RELIABILITY SEAM: Pydantic schema → validate → retry×1 → typed error → heuristic · temp 0 · auto-switch OPENROUTER_API_KEY · 0-credit tests"])
    end

    subgraph L6["⑥ PERSISTENCE &amp; external"]
        DB[("<b>6 · Postgres 16</b><br/>brands·campaigns·assets·products·audits·runs<br/>persist run · seeded idempotent @ boot")]
        X1["OpenRouter (external)<br/>vision + text models · key-gated"]
        V1["media volume<br/>/media static mount"]
    end

    U1 ==>|goal| N1
    N1 --> N2 --> R0
    R0 ==>|generate| E1
    R2 -->|rasterized PNG| E2
    U3 -.->|DOM→PNG| R2
    R0 --> R1 --> M0
    R1 -.->|consult| E3
    R1 -.->|consult| E4
    R2 --> E5
    E1 ==> DB
    E2 -.->|key-gated| X1
    E3 -.-> X1
    E5 -.-> X1
    DB ==>|result| U4
    U4 -.-> U2 --> U3

    classDef flow fill:#1a1016,stroke:#e7e7ee,stroke-width:2px,color:#e7e7ee;
    classDef comp fill:#101014,stroke:#6e6e78,color:#cfcfd6;
    classDef eng fill:#0c1a14,stroke:#9a9aa4,color:#e7e7ee;
    classDef data fill:#15101f,stroke:#9a9aa4,color:#e7e7ee;
    classDef seam fill:none,stroke:#4a4a52,stroke-dasharray:3 3,color:#9a9aa4;
    class U1,N1,R0,E1,E2,DB flow;
    class U2,U3,U4,N2,R1,R2,R3,M0,E3,E4,E5 comp;
    class X1,V1 data;
    class SEAM seam;
```

A static monochrome schematic version is also kept at
[`docs/architecture.svg`](docs/architecture.svg) /
[`docs/architecture.png`](docs/architecture.png).

### Deployment &amp; invariants

| Deployment | Invariants (never break) |
| --- | --- |
| **host** `marque.skunkworkslab.online` | never a `503` — heuristic fallback instead |
| **stack** FastAPI · React · PG16 · Caddy | `match` / scores computed in Python, never the LLM |
| **infra** Azure VM · 2GB · Docker Compose | AI is key-gated — absent key ⇒ heuristic, zero spend |
| **tests** 132 pass · 0 credits in CI | text = HTML layers, never drawn by an image model |

### Layers, top to bottom

**L1 · CLIENT — browser-as-renderer**

| Node | What it does |
| --- | --- |
| **U1 · Workspace / 3-col chat** `①` | AskBar → `goal : str(1..500)`. e.g. _"Launch truffle burger @ ₹399 this weekend"_. chat · results-pane · TracePanel |
| **U2 · AssetPreview (CSS)** | `palette+fonts ← useBrand()` · 4 knob-driven layout variants · text drawn as HTML, never by an image model |
| **U3 · rasterize.js** | AssetPreview DOM → PNG blob · multipart → signal-check · rasterize for scoring only, not export |
| **U4 · Library / Campaigns / Brand** | where every AI result lands · signal badges · `source=rendered|upload` · read/filter surfaces, no gen here |

**L2 · EDGE — TLS · static · proxy**

| Node | What it does |
| --- | --- |
| **N1 · Caddy (reverse proxy)** `②` | auto Let's Encrypt · TLS terminate · `:80 → :443` (308) · certs in volume · only service exposed to internet |
| **N2 · nginx (frontend container)** | serve SPA (`dist`) · proxy `/api/*` · `/media/*` → `backend:8000` · internal only, no host port |
| _Docker Compose (prod)_ | `caddy` · `frontend(nginx)` · `backend(uvicorn)` · `db(postgres16)` · volumes: `pgdata·media·caddy` · DB + `:8000` not published to host |

**L3 · API — FastAPI routers · orchestrator**

| Node | What it does |
| --- | --- |
| **R0 · `POST /v1/brands/{id}/agent/run`** `③` | `classify_intent(goal)` [keyword → LLM, temp 0] · dispatch → generate · read · memory · evaluate · inject Brand Memory block · do/dont enforced in Python · confirmation-gated writes |
| **R1 · brands / memory** | `PATCH /memory` · `POST /rules` · `identity/apply` · `v++` |
| **R2 · signal-check** | `multipart(image,round)` · 422/502 typed · **never 503** |
| **R3 · campaigns / assets** | GET lists · `GET /campaigns/{id}` · library · audits |
| **M0 · Brand Memory · `BrandProfile vN`** | positioning · do/dont · voice · palette · fonts (single source of truth) |

**L4·L5 · ENGINES — reliability pattern · LLM ⇄ heuristic**

| Node | What it does |
| --- | --- |
| **E1 · asset_gen · F5** `④` | `slots{headline,sub,price,cta,logo}` · 6 knobs → 4 assets (poster/post/story/wa) · dont-guard · Facts Rule (price regex) · LLM copy ⇄ regex fallback |
| **E2 · vision · F4 ★crown** `⑤` | 4 axes: premium·modern·playful·niche · detected vs target → gaps (signed) · `match = 100 − avg|gap|` (Python) · LLM ⇄ `match=50` heuristic · verdict pass/fix |
| **E3 · brand_dna · F1** | positioning · do/dont · tone · meaning → `BrandDNAProposal` · shared 0/25/50/75/100 rubric · LLM ⇄ lookup tables |
| **E5 · identity · F3** | 5 curated templates · nearest-2 cosine (positioning) → palette + fonts + meaning · deterministic · offline · 0 credits |
| **E6 · audit · F10** | 2–5 img consistency · `VisionAuditResponse` · `consistency_score` (Python) · LLM ⇄ heuristic score |

> **Reliability seam (all AI engines):** Pydantic schema + `response_format:json_object` → parse/validate → retry×1 → typed error → heuristic fallback · temp 0 · LLM judgment-only, never arithmetic · auto-switch on `OPENROUTER_API_KEY` · mocked tests, 0-credit.

**L6 · PERSISTENCE &amp; external**

| Node | What it does |
| --- | --- |
| **DB · Postgres 16** `⑥` | `brands·campaigns·assets·products·audits·runs` · persist campaign+assets+run · seeded idempotent @ boot · result surfaces back in U4 |
| **X1 · OpenRouter (external)** | vision + text models · key-gated · absent ⇒ heuristic path, zero spend |
| **V1 · media volume** | uploaded PNG / rendered exports · `/media` static mount (StaticFiles) · bind volume survives redeploy |

### Agent data path (`①→⑥`)

```text
① U1  goal typed in AskBar
② N1  Caddy TLS → N2 nginx proxy → R0
③ R0  classify_intent → inject Brand Memory → dispatch
④ E1  asset_gen → slots + knobs → 4 assets
⑤ E2  rasterized PNG → vision Signal Check → match/verdict
⑥ DB  persist campaign + assets + run → lands back in U4 (Library)
```

## Structure

- `frontend/` — Vite + React, served via nginx in production (also proxies `/api/*` to the backend)
- `backend/` — FastAPI, `uv`-managed, talks to Postgres via SQLAlchemy (async)
- `docker-compose.yml` — local dev stack (all ports exposed on localhost)
- `docker-compose.prod.yml` — deployment stack (only port 80 published; db/backend stay internal)

## Local development

```bash
cp .env.example .env
docker compose up -d
```

- Frontend: http://localhost:80
- Backend: http://localhost:8000 (also reachable at http://localhost/api/* through the frontend's nginx proxy)
- Postgres: localhost:5432

## Tests

```bash
docker compose up -d db
cd backend && uv run pytest tests/ -v
```

Uses its own `marque_test` database (created automatically), so it never
touches the `marque` dev database.

## API (added this branch)

- `POST /v1/brands/{id}/assets` — save an uploaded image to the library (runs a
  Signal Check, stores the image, returns the asset). `GET`/`DELETE` to list/remove.
  Images are served at `/media/{asset_id}.jpg`.
- `POST /v1/brands/{id}/audit` — audit 2–5 images for brand consistency; `GET
  /v1/brands/{id}/audits` for history.

## Deployment

See [DEPLOY.md](DEPLOY.md).

## Progress / what's built so far

See [PROGRESS.md](PROGRESS.md).

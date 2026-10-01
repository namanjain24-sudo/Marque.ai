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

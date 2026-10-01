# Marque.ai

React + FastAPI + Postgres, fully dockerized.

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

## Deployment

See [DEPLOY.md](DEPLOY.md).

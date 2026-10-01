# Deployment

Currently deployed manually on an Azure VM (Ubuntu 24.04, 1 vCPU / 2GB RAM, `ved-b2s_group`).

## Server setup (already done once)

- Docker Engine + compose plugin installed from Docker's official apt repo.
- 2GB swapfile added (`/swapfile`) — the VM only has 2GB RAM, builds can spike memory.
- `azureuser` added to the `docker` group (no sudo needed for docker commands).
- NSG inbound rule: only port 80 (and 22 for SSH) is open. Backend (8000) and Postgres (5432) are **not** published to the host in `docker-compose.prod.yml`, so they're unreachable from the internet even if the NSG allowed it.

## Redeploying

From your machine, with the VM's SSH key:

```bash
IP="20.80.105.52"
KEY="/path/to/ved-b2s_key.pem"

rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.venv' \
  --exclude '__pycache__' --exclude 'dist' --exclude '.env' \
  -e "ssh -i $KEY" \
  ./ azureuser@$IP:~/marque.ai/

ssh -i "$KEY" azureuser@$IP '
  cd ~/marque.ai
  docker compose -f docker-compose.prod.yml build
  docker compose -f docker-compose.prod.yml up -d
'
```

The `.env` on the server is separate from local dev — it has its own generated Postgres password and was copied up once manually. Don't overwrite it with the local `.env.example` defaults.

## Notes / improvement ideas (not done yet)

- No CI auto-deploy yet — CI (`.github/workflows/ci.yml`) only lints/builds and checks the Docker images build. Deploying still means running the rsync+ssh steps above by hand.
- If the team wants push-to-deploy, the next step would be: CI builds images, pushes to GHCR, VM pulls + restarts. That needs the SSH key added as a GitHub Actions secret — worth doing deliberately, not by default, since it's a credential going into a shared repo's settings.
- RAM is tight (2GB). Fine for this template; once heavier features land (e.g. Playwright for rendering), keep an eye on `free -h` on the VM — the swapfile is a safety net, not a real fix.

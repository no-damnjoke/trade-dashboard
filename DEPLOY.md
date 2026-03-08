# VPS Deployment

## App layout

- Repo checkout: `/opt/trade-dashboard`
- Reverse proxy: Caddy on port `80`
- App process: PM2 running `trade-dashboard`
- AI bridge: PM2 running `trade-dashboard-ai-proxy`
- Backend/frontend app port: `3001`
- AI bridge port: `8318` on loopback only

## First-time setup

1. Clone repo to `/opt/trade-dashboard`
2. Copy `.env.example` to `.env` and fill secrets
3. Copy `.cli-proxy-api.yaml` and install auth files in `/root/.cli-proxy-api` if using CLIProxyAPI
4. Install dependencies with `npm install`
5. Build with `npm run build`
6. Install the Linux CLIProxyAPI binary to `/opt/trade-dashboard/.local/cliproxy/cli-proxy-api` if using the bridge provider
7. Start with PM2:

```bash
cd /opt/trade-dashboard
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Updates

```bash
cd /opt/trade-dashboard
git pull --ff-only
npm install
npm run build
pm2 restart ecosystem.config.cjs --update-env
```

## AI agents

To enable AI-backed headline/setup/opportunity agents on the VPS:

1. Set `AI_PROVIDER` to a non-deterministic provider in `.env`
2. Provide `AI_BRIDGE_BASE_URL` and `AI_BRIDGE_API_KEY`
3. Provide model names for the three agents if you do not want defaults
4. If using CLIProxyAPI, keep it bound to loopback and avoid port collisions with other local services
5. Restart PM2 with `pm2 restart ecosystem.config.cjs --update-env`

The dashboard falls back to deterministic mode when AI env vars are missing.

## Production safety

- Keep `ENABLE_DEV_ROUTES=false` in production
- Never commit `.env`
- Keep Caddy proxying only to `localhost:3001`
- Prefer deploying from git, not by editing files directly on the VPS

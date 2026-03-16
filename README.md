# Market Monitor

A real-time trading dashboard that aggregates market data, news headlines, prediction markets, AI-generated trade setups, and macro fundamentals into a single view.

## What It Does

Market Monitor pulls live prices for FX, crypto, rates, indices, and commodities from TradingView, scrapes breaking headlines from Telegram (FirstSquawk) and Twitter/X, tracks prediction market movements on Polymarket, and runs AI agents to generate trade setups and rank opportunities. Everything is displayed in a keyboard-navigable, poll-based dashboard with configurable alerts and velocity monitoring.

## Panels

| Panel | Description |
|-------|-------------|
| **Headlines** | Breaking news from Telegram (FirstSquawk) and Twitter/X with AI-scored market impact |
| **Velocity / Macro Shocks** | Real-time velocity, acceleration, and z-score monitoring across instruments; alerts on unusual moves with per-instrument cooldowns |
| **FX Setups** | AI-generated foreign exchange trade ideas with entry, target, stop, and confidence scores |
| **Opportunities** | AI-ranked cross-asset trade opportunities combining headlines, velocity signals, and technicals |
| **Event Odds** | Polymarket prediction market data with whale tracking |
| **Watchlist** | Configurable instrument watchlist with live prices |
| **Calendar** | Upcoming macro events and economic data releases |
| **Heatmap** | Color-coded grid showing price changes across the tracked instrument universe |

## Architecture

```
Frontend (Preact + Vite)         Backend (Express + TypeScript)
  src/main.tsx                     server/index.ts
  src/app.tsx                      server/routes/*
  src/panels/*                     server/services/*
  src/components/*
         |                                |
         +--- /api/* (poll-based) --------+
                                          |
                          +---------------+---------------+
                          |               |               |
                     TradingView    Telegram/Twitter   Polymarket
                     (prices)       (headlines)        (predictions)
```

- **Frontend:** Preact (not React) with Vite. Two-column grid layout. All data fetching is poll-based (no WebSockets). Plain CSS with design tokens. Keyboard navigation via hotkeys.
- **Backend:** Express on port 3001. Thin route files delegate to service modules. Runs via `tsx` (TypeScript Execute), not compiled to JS.
- **Data sources:** TradingView for prices and candles, Telegram/Twitter scraping for headlines, Polymarket for prediction markets, RSS feeds for context briefs.
- **Proxy:** In development, Vite proxies `/api` to `localhost:3001`. In production, Express serves the built frontend directly.

## AI Layer

### Agents

| Agent | Default Model | Reasoning Effort | Purpose |
|-------|--------------|-------------------|---------|
| `headline-impact` | gpt-5.1-codex-mini | low | Scores headline market impact, identifies affected instruments |
| `fx-setup` | claude-sonnet-4-6 | medium | Generates FX trade setups with entry/target/stop levels |
| `opportunity-ranker` | gpt-5.1-codex-mini | low | Ranks cross-asset opportunities from headlines + velocity + technicals |

All agents use an OpenAI-compatible API interface and support three provider modes: `deterministic` (no AI, fallback output), `bridge-openai-compatible` (local proxy), and `official-openai-compatible` (direct API). When AI is disabled or fails, agents fall back to deterministic output.

### Context Brief

AI agents receive a structured context brief built from RSS feeds scraped every 6 hours:

- Google News (forex/macro/economy queries)
- CNBC Markets and Economy
- WSJ Markets
- MarketWatch Top Stories
- Nikkei Asia
- Reuters and FT (via Google News proxy)

Headlines are filtered by macro keywords and deduplicated before injection into agent payloads.

### Brave Search

The `headline-impact` agent uses Brave Search to verify and enrich headlines. Searches are scoped to the past day (`freshness: pd`) with a 5-second timeout. Requires a `BRAVE_SEARCH_API_KEY`.

## Setup

### Prerequisites

- Node.js >= 20
- npm

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root. All variables are optional unless noted.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `HOST` | Backend bind address | `0.0.0.0` (dev), `127.0.0.1` (prod) |
| `NODE_ENV` | Environment mode | `development` |
| `AI_PROVIDER` | AI provider mode: `deterministic`, `bridge-openai-compatible`, `official-openai-compatible` | `deterministic` |
| `AI_BRIDGE_BASE_URL` | Base URL for the AI proxy | `http://127.0.0.1:8765/v1` |
| `AI_BRIDGE_API_KEY` | API key for the AI proxy | (none) |
| `AI_HEADLINE_MODEL` | Model for headline-impact agent | `gpt-5.1-codex-mini` |
| `AI_FX_SETUP_MODEL` | Model for fx-setup agent | `claude-sonnet-4-6` |
| `AI_OPPORTUNITY_MODEL` | Model for opportunity-ranker agent | `gpt-5.1-codex-mini` |

| `AI_HEADLINE_REASONING_EFFORT` | Reasoning effort for headline-impact | `low` |
| `AI_FX_SETUP_REASONING_EFFORT` | Reasoning effort for fx-setup | `medium` |
| `AI_OPPORTUNITY_REASONING_EFFORT` | Reasoning effort for opportunity-ranker | `low` |

| `AI_TIMEOUT_MS` | AI request timeout in milliseconds | `12000` |
| `AI_MAX_RETRIES` | Max retry attempts per AI request | `1` |
| `AI_HEADLINE_MIN_CONFIDENCE` | Minimum confidence to surface a headline impact | `60` |
| `AI_HEADLINE_ALERT_MIN_CONFIDENCE` | Minimum confidence to trigger a headline alert | `65` |
| `AI_FX_SETUP_MIN_CONFIDENCE` | Minimum confidence for FX setups | `60` |
| `AI_OPPORTUNITY_MIN_CONFIDENCE` | Minimum confidence for opportunities | `60` |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key for headline verification | (none) |
| `TWITTER_AUTH_TOKEN` | Twitter/X cookie auth token | (none) |
| `TWITTER_CT0` | Twitter/X CSRF token | (none) |
| `TWITTER_USER` | Twitter/X username (fallback login) | (none) |
| `TWITTER_PASS` | Twitter/X password (fallback login) | (none) |
| `TWITTER_EMAIL` | Twitter/X email (fallback login) | (none) |
| `FIRSTSQUAWK_TG_CHANNEL` | Telegram channel for headline scraping | (none) |
| `FINNHUB_KEY` | Finnhub API key (free tier) | (none) |
| `DISABLE_VELOCITY_POLLING` | Set `true` to skip velocity monitor on startup | `false` |
| `ENABLE_DEV_ROUTES` | Set `true` to enable dev mock routes in production | `false` |

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full stack (Vite on :5173 + backend on :3001) |
| `npm run dev:fe` | Start frontend only |
| `npm run dev:be` | Start backend only |
| `npm run build` | TypeScript check + Vite production build |
| `npm run start` | Start production server (serves built frontend) |
| `npm run ai:proxy` | Start the CLI proxy API for AI model access |
| `npm run tunnel` | Start Cloudflare tunnel to localhost:5173 |
| `npm run dev:remote` | Full stack + Cloudflare tunnel |
| `npm run sim:fx-setup` | Run FX setup simulation |
| `npm run sim:fx-10d` | Run 10-day FX simulation |
| `npm run sim:fx-compare` | Compare FX reasoning across models |

## Production

- **VPS:** Deployed behind Caddy reverse proxy
- **Process manager:** PM2 manages the backend process and the AI bridge proxy
- **Backend:** Bound to `127.0.0.1:3001` (not publicly exposed)
- **AI bridge:** Bound to `127.0.0.1:8318`
- **Remote access:** Cloudflare tunnel available via `npm run tunnel`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check, returns `{ status, timestamp }` |
| `GET /api/headlines` | Breaking news headlines with AI impact scores |
| `GET /api/heatmap` | Price change heatmap across all tracked instruments |
| `GET /api/predictions` | Polymarket prediction market data and whale activity |
| `GET /api/alerts` | Active alerts (polled every 5s by frontend) |
| `GET /api/opportunities` | AI-ranked trade opportunities |
| `GET /api/velocity` | Velocity monitor signals (velocity, acceleration, z-score) |
| `GET /api/setups` | AI-generated trade setups |
| `GET /api/fx-setup` | FX-specific trade setup endpoint |
| `GET /api/ai-status` | AI provider status, usage stats, per-agent metrics |
| `GET /api/market-state` | Current market state summary |
| `GET /api/context-brief` | Current RSS context brief used by AI agents |
| `GET /api/api-tracker` | Outbound API call log and hourly stats (last 48h) |
| `GET /api/dev/mock-market` | Mock market data (dev only, disabled in production) |

## Rate Limit Safety

The system includes several mechanisms to prevent rate limit cascading:

- **429 fail-fast:** When an AI agent receives a 429 (rate limited) response, it returns immediately without retrying. This prevents retry loops from compounding the rate limit pressure.
- **Per-instrument cooldowns:** Velocity alerts enforce cooldown periods (4--8 minutes depending on instrument class) to prevent alert storms during volatile periods.
- **API tracker:** All outbound requests (AI proxy, Brave Search, RSS feeds) are logged with timestamps, latency, and status codes. Hourly stats are retained for 48 hours and exposed via `/api/api-tracker` for rate limit investigation.
- **Rate limit header tracking:** AI responses capture `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers per agent for monitoring remaining quota.

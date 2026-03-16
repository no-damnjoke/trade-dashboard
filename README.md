# Market Monitor

A real-time trading dashboard that aggregates market data, news headlines, prediction markets, and AI-generated trade setups into a single view.

## What It Does

Market Monitor pulls live prices for FX, crypto, rates, indices, and commodities from TradingView, scrapes breaking headlines from Telegram (FirstSquawk) and Twitter/X, tracks prediction market movements on Polymarket, and runs AI agents to generate trade setups and rank opportunities. Everything is displayed in a keyboard-navigable, poll-based dashboard with configurable alerts and velocity monitoring.

## Panels

| Panel | Description |
|-------|-------------|
| **Headlines** | Breaking news from Telegram (FirstSquawk) and Twitter/X with AI-scored market impact |
| **Velocity / Macro Shocks** | Real-time velocity, acceleration, and z-score monitoring across instruments; alerts on unusual moves with per-instrument cooldowns |
| **FX Setups** | AI-generated G10 FX trade ideas with entry, stop loss, targets, R:R ratio, and quality grades (ICT/SMC framework) |
| **Opportunities** | AI macro strategist board — institutional-quality desk notes with causal hierarchy, scenario trees, key S/R levels, cross-asset triggers, and session memory feedback loop |
| **Event Odds** | Polymarket prediction market data with whale tracking |
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

- **Frontend:** Preact (not React) with Vite. Customizable drag-and-resize grid layout (12x12, persisted to localStorage). All data fetching is poll-based (no WebSockets). Plain CSS with design tokens. Keyboard navigation via hotkeys.
- **Backend:** Express on port 3001. Thin route files delegate to service modules. Runs via `tsx` (TypeScript Execute), not compiled to JS.
- **Data sources:** TradingView for prices and candles, Telegram/Twitter scraping for headlines, Polymarket for prediction markets, RSS feeds for context briefs, Brave Search for live web verification.
- **Proxy:** In development, Vite proxies `/api` to `localhost:3001`. In production, Express serves the built frontend directly.

## AI Layer

### Agents

| Agent | Default Model | Provider | Purpose |
|-------|--------------|----------|---------|
| `headline-impact` | claude-haiku-4-5 | CLI proxy | Scores headline market impact, identifies affected instruments |
| `fx-setup` | minimax/minimax-m2.5 | OpenRouter | Generates FX trade setups with entry, stop loss, targets, and R:R (ICT/SMC) |
| `opportunity-ranker` | gpt-5.2 | CLI proxy | Senior macro strategist — institutional desk notes with feedback loop |

Each agent can route to a different API endpoint via per-agent env vars (`AI_*_BASE_URL`, `AI_*_API_KEY`). FX setups and opportunities are AI-only — no deterministic fallbacks. When AI is unavailable, the panels show a clean empty state.

### Multi-Provider Routing

Agents route to different providers to balance cost, speed, and rate limits:

- **CLI proxy** (port 8318): Routes GPT and Claude models via CLIProxyAPI with OAuth
- **OpenRouter**: Routes MiniMax and other third-party models via API key
- **Per-agent overrides**: `AI_FX_SETUP_BASE_URL` + `AI_FX_SETUP_API_KEY` etc.

### Model Rotation (Rate Limit Resilience)

The opportunity-ranker automatically rotates between `gpt-5.2` and `claude-sonnet-4-6` on rate limit (429/529):

1. Primary model (gpt-5.2) gets rate-limited
2. Swaps to fallback (claude-sonnet-4-6), retries immediately
3. Swap persists — next cycles use whichever model succeeded last
4. After 5 min cooldown, auto-reverts to primary to check if quota recovered

Both models route through the same CLI proxy. The feedback loop is model-agnostic — session memory carries across model switches.

### Two-Tier AI Gating

The opportunity agent uses smart polling to balance responsiveness with rate limits:

- **Reactive (3 min floor):** Fires when critical headlines land, new FX setups appear, or regime/heatmap direction flips
- **Steady (10 min):** Regular re-evaluation cycle when no structural changes detected
- Medium/high headlines and score fluctuations wait for the steady cycle

### Session Memory & Feedback Loop

The opportunity-ranker compounds understanding across cycles:

- **Session memory** (`opportunityMemory.ts`): Ring buffer of last 6 AI cycles (~1 hour). Tracks which S/R levels held or broke, which themes persisted or faded. Compressed summary injected into each AI prompt.
- **Daily digest** (`dailyDigest.ts`): At 22:00 UTC, session is summarized to `data/digests/YYYY-MM-DD.json`. Next morning loads yesterday's digest for cross-day learning. Keeps last 5 days.
- **Level tracking**: When the agent calls a support/resistance level, the system monitors whether price tests or breaks it, feeding results back in subsequent cycles.
- **Live web search**: Each cycle, Brave Search queries the prior cycle's themes for real-time web results. The agent uses these to validate narratives and identify drivers that other data sources may miss.

### Opportunity Board Quality Standards

The opportunity-ranker prompt enforces institutional-quality output:

- **Causal hierarchy**: Narratives must rank drivers (primary/secondary/tertiary), not just describe the tape
- **Scenario trees**: Base case + adverse case with specific cross-asset flip conditions
- **Multi-asset triggers**: Each opportunity needs triggers from rates, commodities, AND price action
- **Real price levels**: Key levels must be actual prices from candle data, not percentage thresholds
- **Expression risk**: Commentary must state what makes this the wrong expression even if the thesis is right
- **Haven channel nuance**: Explain transmission paths (energy/inflation vs classic risk-off), not binary risk-on/risk-off

### Context Sources

| Source | Service | Update Frequency | Used By |
|--------|---------|-----------------|---------|
| FX prices / candles | TradingView | 30s | fx-setup, velocity, heatmap |
| Headlines | Telegram / Twitter | 30s | headline-impact, opportunity-ranker |
| Prediction markets | Polymarket | periodic | opportunity-ranker |
| RSS context brief | Google News, CNBC, WSJ, Reuters, FT | 6 hours | All agents |
| Live web search | Brave Search | Per AI cycle | headline-impact, opportunity-ranker |
| Session memory | opportunityMemory.ts | Per AI cycle | opportunity-ranker |
| Daily digest | dailyDigest.ts | Daily at 22:00 UTC | opportunity-ranker |

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
| `AI_BRIDGE_BASE_URL` | Default base URL for AI agents | `http://127.0.0.1:8765/v1` |
| `AI_BRIDGE_API_KEY` | Default API key for AI agents | (none) |
| `AI_HEADLINE_MODEL` | Model for headline-impact agent | `claude-haiku-4-5-20251001` |
| `AI_FX_SETUP_MODEL` | Model for fx-setup agent | `minimax/minimax-m2.5` |
| `AI_FX_SETUP_BASE_URL` | Base URL override for fx-setup | (uses default) |
| `AI_FX_SETUP_API_KEY` | API key override for fx-setup | (uses default) |
| `AI_OPPORTUNITY_MODEL` | Model for opportunity-ranker agent | `gpt-5.2` |
| `AI_OPPORTUNITY_FALLBACK_MODEL` | Fallback model on rate limit | `claude-sonnet-4-6` |
| `AI_HEADLINE_REASONING_EFFORT` | Reasoning effort for headline-impact | `low` |
| `AI_FX_SETUP_REASONING_EFFORT` | Reasoning effort for fx-setup | `medium` |
| `AI_OPPORTUNITY_REASONING_EFFORT` | Reasoning effort for opportunity-ranker | `medium` |
| `AI_TIMEOUT_MS` | AI request timeout in milliseconds | `12000` |
| `AI_MAX_RETRIES` | Max retry attempts per AI request | `1` |
| `AI_HEADLINE_MIN_CONFIDENCE` | Minimum confidence to surface a headline impact | `60` |
| `AI_HEADLINE_ALERT_MIN_CONFIDENCE` | Minimum confidence to trigger a headline alert | `65` |
| `AI_FX_SETUP_MIN_CONFIDENCE` | Minimum confidence for FX setups | `60` |
| `AI_OPPORTUNITY_MIN_CONFIDENCE` | Minimum confidence for opportunities | `50` |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key for headline verification and macro search | (none) |
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
| `GET /api/opportunities` | AI-ranked trade opportunities with narrative, themes, conflicts |
| `GET /api/velocity` | Velocity monitor signals (velocity, acceleration, z-score) |
| `GET /api/setups` | AI-generated trade setups |
| `GET /api/fx-setup` | FX-specific trade setup endpoint with AI debug info |
| `GET /api/ai-status` | AI provider status, usage stats, per-agent metrics, model rotation state |
| `GET /api/market-state` | Current market state summary |
| `GET /api/context-brief` | Current RSS context brief used by AI agents |
| `GET /api/api-tracker` | Outbound API call log and hourly stats (last 48h) |
| `GET /api/dev/mock-market` | Mock market data (dev only, disabled in production) |

## Rate Limit Safety

The system includes several mechanisms to prevent rate limit cascading:

- **Model rotation:** The opportunity-ranker auto-rotates between gpt-5.2 and claude-sonnet-4-6 on 429/529 responses, with 5-minute cooldown before retrying the primary model.
- **Two-tier gating:** Reactive (3 min) for critical events, steady (10 min) for regular cycles. Prevents over-polling in active markets.
- **429 fail-fast:** Non-opportunity agents return immediately on rate limit without retrying.
- **Per-instrument cooldowns:** Velocity alerts enforce cooldown periods (4-8 minutes) to prevent alert storms.
- **API tracker:** All outbound requests are logged with timestamps, latency, and status codes. Hourly stats retained for 48 hours via `/api/api-tracker`.
- **Rate limit header tracking:** AI responses capture `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers per agent.

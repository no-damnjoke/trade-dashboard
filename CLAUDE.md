# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Market Monitor — a real-time trading dashboard that aggregates market data (FX, crypto, rates, indices, commodities), news headlines, prediction markets, AI-generated trade setups, and macro country fundamentals into a single view.

## Commands

- **Dev (full stack):** `npm run dev` — runs Vite frontend (`:5173`) + tsx-watched backend (`:3001`) concurrently
- **Dev frontend only:** `npm run dev:fe`
- **Dev backend only:** `npm run dev:be`
- **Build:** `npm run build` — runs `tsc -b && vite build`
- **Production start:** `npm run start` — serves built app through Express
- **AI proxy:** `npm run ai:proxy` — starts the cli-proxy-api for AI model access
- **FX simulations:** `npm run sim:fx-setup`, `npm run sim:fx-10d`, `npm run sim:fx-compare`

No test runner is configured. Validate with `npm run build` and manual verification.

## Architecture

### Frontend (Preact + Vite)

- **Framework:** Preact (not React) — uses `preact/hooks` and `preact/compat`. JSX import source is `preact`.
- **Entry:** `src/main.tsx` → `src/app.tsx` → `AppProvider` context wraps `Layout`
- **State:** `src/context/AppContext.tsx` — global UI state (focused panel, alerts, overlays) via Preact context
- **Data fetching:** All poll-based, no WebSockets. `src/hooks/usePolling.ts` polls backend endpoints at fixed intervals. All API calls go through `src/services/api.ts` (`fetchJSON<T>()` hitting `/api/*`).
- **Layout:** `src/components/Layout.tsx` — two-column grid with 7 panels: Headlines, Velocity, Setups, Predictions, Watchlist, Calendar, Fundamentals. Plus: Header, Heatmap, StatusBar, CommandPalette, HelpOverlay, AlertsDrawer.
- **Panels:** `src/panels/` — self-contained feature views. Each panel polls its own API endpoint.
- **Styling:** Plain CSS co-located with components (no CSS modules, no Tailwind). Design tokens in `src/styles/tokens.css`.
- **Keyboard navigation:** `src/hooks/useKeyboard.ts` handles hotkeys and panel focus

### Backend (Express + TypeScript)

- **Entry:** `server/index.ts` — Express app on port 3001
- **Routes:** `server/routes/` — thin Express routers mounted at `/api/<resource>`. Push logic into services.
- **Services:** `server/services/` — business logic, data aggregation, external API integrations
- **Market data:** `server/services/instruments.ts` defines tracked universe (`MARKET_INSTRUMENTS`). Prices via TradingView (`tradingview.ts`, `tradingviewCandles.ts`).
- **Velocity monitor:** `server/services/velocityMonitor.ts` — polls every 30s, computes velocity/acceleration/z-score
- **Headlines:** `server/services/headlines.ts` — Telegram (FirstSquawk) + Twitter scraping
- **Market fundamentals:** `server/services/marketFundamentals.ts` — G10 country research packets with macro stats, charts, sources. Cached on startup, refreshed every 6 hours via AI or deterministic fallback.
- **AI layer:** `server/services/aiProvider.ts` — OpenAI-compatible client with three provider modes. Four AI agents: `headline-impact`, `fx-setup`, `opportunity-ranker`, `country-fundamentals` (defined in `aiAgents.ts`). Falls back to deterministic output when AI is disabled/fails.
- **Prediction markets:** `server/services/polymarket.ts` — whale tracking and prediction data
- **Mock data:** `server/services/mockMarketData.ts` + `server/routes/devMockMarket.ts` for dev without live feeds

### Shared Types

`shared/` directory contains types used by both frontend and backend (e.g., `shared/marketFundamentals.ts`). Frontend re-exports these from `src/types/index.ts`. Key domain types: `Headline`, `HeatmapEntry`, `PredictionMarket`, `Alert`, `VelocitySignal`, `TechnicalSetup`, `MarketOpportunity`, `MarketState`, `CountryResearchPacket`, `MarketFundamentalsPayload`.

### Frontend ↔ Backend

Vite proxies `/api` → `localhost:3001` during development (configured in `vite.config.ts`). In production, Express serves static files directly. All data flow is poll-based at various intervals (alerts 5s, fundamentals 60s, etc.).

## Key Env Vars

- `AI_PROVIDER` — `deterministic` (default, no AI), `bridge-openai-compatible`, or `official-openai-compatible`
- `AI_BRIDGE_BASE_URL` / `AI_BRIDGE_API_KEY` — AI proxy connection
- `AI_HEADLINE_MODEL`, `AI_FX_SETUP_MODEL`, `AI_OPPORTUNITY_MODEL`, `AI_COUNTRY_MODEL` — per-agent model overrides
- `AI_COUNTRY_REASONING_EFFORT` — reasoning level for country fundamentals (default `medium`)
- `FIRSTSQUAWK_TG_CHANNEL` — Telegram channel for headline scraping
- `DISABLE_VELOCITY_POLLING` — set `true` to skip velocity monitor on startup
- `PORT` — backend port (default 3001)

## TypeScript Config

- Frontend: `tsconfig.json` — ES2020, bundler resolution, `jsxImportSource: "preact"`, includes `src/` and `shared/`
- Backend: `server/tsconfig.json` — ES2020, bundler resolution, no JSX, includes `server/` only
- Backend runs via `tsx` (TypeScript Execute), not compiled to JS

## Code Style

- Strict TypeScript, 2-space indentation, semicolons, single quotes
- Components/panels in PascalCase; hooks, helpers, services in camelCase
- Co-locate CSS with its component (e.g., `StatusBar.tsx` + `StatusBar.css`)
- Route files stay thin — push business logic into `server/services/`

## Production

VPS deployment behind Caddy at `152.42.236.158:80`. Backend bound to `127.0.0.1:3001`, AI bridge to `127.0.0.1:8318`, managed by PM2. Do not reintroduce public binds, enable dev mock routes in production, or change AI bridge port to `8317` (stale conflict).

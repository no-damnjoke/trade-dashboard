# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Market Monitor — a real-time trading dashboard that aggregates market data (FX, crypto, rates, indices, commodities), news headlines, prediction markets, and AI-generated trade setups into a single view.

## Commands

- **Dev (full stack):** `npm run dev` — runs Vite frontend + tsx-watched backend concurrently
- **Dev frontend only:** `npm run dev:fe` — Vite on port 5173
- **Dev backend only:** `npm run dev:be` — Express on port 3001
- **Build:** `npm run build` — runs `tsc -b && vite build`
- **AI proxy:** `npm run ai:proxy` — starts the cli-proxy-api for AI model access
- **FX setup simulations:** `npm run sim:fx-setup`, `npm run sim:fx-10d`, `npm run sim:fx-compare`

No test runner is configured.

## Architecture

### Frontend (Preact + Vite)

- **Framework:** Preact (not React) with `preact/hooks` and `preact/compat`. JSX import source is `preact`.
- **Entry:** `src/main.tsx` → `src/app.tsx` → `AppProvider` context wraps `Layout`
- **State:** `src/context/AppContext.tsx` manages global UI state (focused panel, alerts, overlays) via Preact context
- **Data fetching:** `src/hooks/usePolling.ts` — custom hook that polls backend API endpoints at fixed intervals. All API calls go through `src/services/api.ts` (`fetchJSON` helper hitting `/api/*`)
- **Layout:** `src/components/Layout.tsx` — two-column grid. Left: Headlines, Velocity, Setups, Predictions. Right: Watchlist, Calendar. Plus: Header, Heatmap, StatusBar, CommandPalette, HelpOverlay, AlertsDrawer.
- **Panels:** `src/panels/` — each panel is a self-contained feature view (HeadlinesPanel, WatchlistPanel, CalendarPanel, VelocityPanel, SetupsPanel, PredictionPanel)
- **Styling:** Plain CSS files co-located with components (no CSS modules, no Tailwind). Design tokens in `src/styles/tokens.css`.
- **Keyboard navigation:** `src/hooks/useKeyboard.ts` handles hotkeys and panel focus

### Backend (Express + TypeScript)

- **Entry:** `server/index.ts` — Express app on port 3001
- **Routes:** `server/routes/` — each file exports an Express router mounted at `/api/<resource>`
- **Services:** `server/services/` — business logic, data aggregation, external API integrations
- **Market data:** `server/services/instruments.ts` defines the tracked universe (`MARKET_INSTRUMENTS` array). Price data sourced via TradingView (`server/services/tradingview.ts`, `tradingviewCandles.ts`)
- **Velocity monitor:** `server/services/velocityMonitor.ts` — polls market data every 30s, computes velocity/acceleration/z-score signals
- **Headlines:** `server/services/headlines.ts` — scrapes from Telegram (FirstSquawk) and Twitter via `@the-convocation/twitter-scraper`
- **AI layer:** `server/services/aiProvider.ts` — OpenAI-compatible API client supporting three providers (`deterministic`, `bridge-openai-compatible`, `official-openai-compatible`). Three AI agents: `headline-impact`, `fx-setup`, `opportunity-ranker` (defined in `server/services/aiAgents.ts`)
- **Prediction markets:** `server/services/polymarket.ts` — whale tracking and prediction market data
- **Mock data:** `server/services/mockMarketData.ts` + `server/routes/devMockMarket.ts` for development without live feeds

### Key Env Vars

- `AI_PROVIDER` — `deterministic` (default, no AI), `bridge-openai-compatible`, or `official-openai-compatible`
- `AI_BRIDGE_BASE_URL` / `AI_BRIDGE_API_KEY` — AI proxy connection
- `AI_HEADLINE_MODEL`, `AI_FX_SETUP_MODEL`, `AI_OPPORTUNITY_MODEL` — per-agent model overrides
- `FIRSTSQUAWK_TG_CHANNEL` — Telegram channel for headline scraping
- `DISABLE_VELOCITY_POLLING` — set `true` to skip velocity monitor polling on startup
- `PORT` — backend port (default 3001)

### Frontend ↔ Backend

Vite proxies `/api` requests to `localhost:3001` during development. The frontend polls various `/api/*` endpoints at different intervals (e.g., alerts every 5s). There are no WebSocket connections — all data flow is poll-based.

## Types

Shared types are defined in `src/types/index.ts` (frontend) and mirrored in server service files. Key domain types: `Headline`, `HeatmapEntry`, `PredictionMarket`, `Alert`, `VelocitySignal`, `TechnicalSetup`, `MarketOpportunity`, `MarketState`.

## TypeScript Config

- Frontend: `tsconfig.json` — targets ES2020, bundler module resolution, `jsxImportSource: "preact"`
- Backend: `server/tsconfig.json` — separate config, also ES2020/bundler resolution, no JSX
- Backend runs via `tsx` (TypeScript Execute) in watch mode, not compiled to JS

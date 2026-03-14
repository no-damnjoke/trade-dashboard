# Repository Guidelines

## Project Structure & Module Organization
Market Monitor is a production-first Preact + Vite frontend with an Express + TypeScript backend. The main UI shell is [`src/components/Layout.tsx`](/Users/reyesmak/Desktop/trade_dashboard/src/components/Layout.tsx), which assembles the header, heatmap, status bar, alerts, command palette, and the six main panels in `src/panels/`. Reusable UI rows and detail blocks live in `src/components/`. Shared UI state is in `src/context/AppContext.tsx`, polling in `src/hooks/usePolling.ts`, and REST access in `src/services/api.ts`.

Backend entry is [`server/index.ts`](/Users/reyesmak/Desktop/trade_dashboard/server/index.ts). HTTP handlers live in `server/routes/`; trading, headlines, AI, and market logic live in `server/services/`. Deployment and process definitions are in [`DEPLOY.md`](/Users/reyesmak/Desktop/trade_dashboard/DEPLOY.md) and [`ecosystem.config.cjs`](/Users/reyesmak/Desktop/trade_dashboard/ecosystem.config.cjs).

## Build, Test, and Development Commands
- `npm run dev` starts Vite on `:5173` and the backend on `:3001`.
- `npm run dev:fe` runs the frontend only.
- `npm run dev:be` runs the backend with `tsx watch`.
- `npm run build` performs TypeScript build checks and creates the production bundle.
- `npm run start` serves the built app through the Express server.
- `npm run sim:fx-setup`, `npm run sim:fx-10d`, `npm run sim:fx-compare` run strategy simulation scripts.

## Coding Style & Naming Conventions
Use strict TypeScript, 2-space indentation, semicolons, and single quotes. Keep component and panel files in `PascalCase`; hooks, helpers, and service functions in `camelCase`. Co-locate CSS with its component, for example `StatusBar.tsx` with `StatusBar.css`. Keep route files thin and push business logic into `server/services/`.

## Testing Guidelines
No automated test runner is configured yet. Minimum validation is `npm run build` plus the relevant simulation script or manual UI/API verification. Add future tests as `*.test.ts` near the feature or under `src/__tests__/` and `server/__tests__/`.

## Commit & Pull Request Guidelines
Follow the existing commit style: short, imperative subjects such as `Tighten production network exposure`. Keep each commit focused. PRs should summarize user-visible impact, mention env or provider changes, link the issue when available, and include screenshots for dashboard UI changes.

## Production & Agent Notes
Treat the VPS deployment as the primary runtime, not local dev. Production runs behind Caddy on `http://152.42.236.158`, with the app bound to `127.0.0.1:3001` and the AI bridge bound to `127.0.0.1:8318` under PM2. Do not reintroduce public binds, enable dev mock routes in production, or change the AI bridge port back to `8317` unless you verify the stale port conflict is gone and the change is intentional.

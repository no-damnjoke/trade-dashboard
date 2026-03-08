import { Router } from 'express';
import { fetchHeadlinesBundle, getHeadlineStatus } from '../services/headlines.js';

export const headlinesRouter = Router();

let cachedHeadlines: any[] = [];
let lastFetch = 0;
let activeProvider = 'demo';
const POLL_INTERVAL = 30_000;
const DISABLE_HEADLINE_POLLING = process.env.DISABLE_HEADLINE_POLLING === 'true';

async function refreshHeadlines() {
  try {
    const bundle = await fetchHeadlinesBundle();
    cachedHeadlines = bundle.headlines;
    activeProvider = bundle.activeProvider;
    lastFetch = bundle.lastUpdated;
  } catch (e) {
    console.error('[Headlines] Fetch failed:', (e as Error).message);
  }
}

if (!DISABLE_HEADLINE_POLLING) {
  refreshHeadlines();
  setInterval(refreshHeadlines, POLL_INTERVAL);
}

headlinesRouter.get('/', (_req, res) => {
  res.json({
    headlines: cachedHeadlines,
    lastUpdated: lastFetch,
    source: activeProvider,
  });
});

headlinesRouter.get('/status', (_req, res) => {
  res.json(getHeadlineStatus());
});

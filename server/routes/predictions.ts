import { Router } from 'express';
import { fetchPredictions } from '../services/polymarket.js';

export const predictionsRouter = Router();

let cachedPredictions: any[] = [];
let lastFetch = 0;
const POLL_INTERVAL = 120_000;

async function refreshPredictions() {
  try {
    cachedPredictions = await fetchPredictions();
    lastFetch = Date.now();
  } catch (e) {
    console.error('[Predictions] Fetch failed:', (e as Error).message);
  }
}

refreshPredictions();
setInterval(refreshPredictions, POLL_INTERVAL);

predictionsRouter.get('/', (_req, res) => {
  res.json({
    markets: cachedPredictions,
    lastUpdated: lastFetch,
  });
});

predictionsRouter.get('/whales', (_req, res) => {
  res.json({
    markets: cachedPredictions,
    lastUpdated: lastFetch,
  });
});

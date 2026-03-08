import { Router } from 'express';
import { getCachedHeatmapData, refreshHeatmapCache } from '../services/heatmap.js';

export const heatmapRouter = Router();

refreshHeatmapCache().catch(e => console.error('[Heatmap] Initial fetch failed:', (e as Error).message));
setInterval(() => {
  refreshHeatmapCache().catch(e => console.error('[Heatmap] Fetch failed:', (e as Error).message));
}, 30_000);

heatmapRouter.get('/', (_req, res) => {
  const { entries, lastUpdated } = getCachedHeatmapData();
  res.json({
    currencies: entries,
    lastUpdated,
  });
});

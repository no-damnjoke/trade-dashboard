import { Router } from 'express';
import { refreshFXSetups } from '../services/setups.js';
import { refreshOpportunityBoard } from '../services/opportunities.js';
import { pollVelocityMonitor } from '../services/velocityMonitor.js';
import {
  clearMockMarketData,
  disableMockMarketData,
  enableMockMarketData,
  getMockMarketStatus,
  setMockScenario,
  upsertMockPrice,
} from '../services/mockMarketData.js';

export const devMockMarketRouter = Router();

devMockMarketRouter.get('/status', (_req, res) => {
  res.json(getMockMarketStatus());
});

devMockMarketRouter.post('/reset', (_req, res) => {
  clearMockMarketData();
  enableMockMarketData();
  res.json(getMockMarketStatus());
});

devMockMarketRouter.post('/disable', (_req, res) => {
  disableMockMarketData();
  clearMockMarketData();
  res.json(getMockMarketStatus());
});

devMockMarketRouter.post('/scenario', (req, res) => {
  const symbol = String(req.body?.symbol || '');
  const candles = req.body?.candles;
  const prevClose = req.body?.prevClose == null ? undefined : Number(req.body.prevClose);

  if (!symbol || !candles || typeof candles !== 'object') {
    res.status(400).json({ error: 'symbol and candles are required' });
    return;
  }

  enableMockMarketData();
  try {
    setMockScenario(symbol, candles, prevClose);
    res.json(getMockMarketStatus());
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

devMockMarketRouter.post('/evaluate', async (req, res) => {
  await pollVelocityMonitor();
  await refreshFXSetups();
  if (req.body?.refreshOpportunity === true) {
    await refreshOpportunityBoard();
  }

  res.json({
    status: getMockMarketStatus(),
    refreshedAt: Date.now(),
  });
});

devMockMarketRouter.post('/price', async (req, res) => {
  const symbol = String(req.body?.symbol || '');
  const price = Number(req.body?.price);
  const prevClose = req.body?.prevClose == null ? undefined : Number(req.body.prevClose);

  if (!symbol || !Number.isFinite(price)) {
    res.status(400).json({ error: 'symbol and numeric price are required' });
    return;
  }

  enableMockMarketData();
  const result = upsertMockPrice(symbol, price, prevClose);

  if (result.changed) {
    await pollVelocityMonitor();
    await refreshFXSetups();
    if (req.body?.refreshOpportunity === true) {
      await refreshOpportunityBoard();
    }
  }

  res.json({
    changed: result.changed,
    status: getMockMarketStatus(),
  });
});

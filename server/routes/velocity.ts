import { Router } from 'express';
import { getActiveSignals, getMonitorStatus } from '../services/velocityMonitor.js';
import { getQuoteStreamStatus } from '../services/tradingview.js';

export const velocityRouter = Router();

velocityRouter.get('/', (_req, res) => {
  res.json({
    signals: getActiveSignals(),
    monitor: getMonitorStatus(),
    quoteStream: getQuoteStreamStatus(),
    timestamp: Date.now(),
  });
});

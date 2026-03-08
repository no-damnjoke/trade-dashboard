import { Router } from 'express';
import { getActiveSignals, getMonitorStatus } from '../services/velocityMonitor.js';

export const velocityRouter = Router();

velocityRouter.get('/', (_req, res) => {
  res.json({
    signals: getActiveSignals(),
    monitor: getMonitorStatus(),
    timestamp: Date.now(),
  });
});

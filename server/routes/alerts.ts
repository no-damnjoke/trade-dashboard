import { Router } from 'express';
import { getAlerts, clearAlerts } from '../services/alertEngine.js';

export const alertsRouter = Router();

alertsRouter.get('/', (_req, res) => {
  res.json({ alerts: getAlerts() });
});

alertsRouter.delete('/', (_req, res) => {
  clearAlerts();
  res.json({ ok: true });
});

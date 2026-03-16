import { Router } from 'express';
import { getAIProviderStatus, resetAIUsageStats, setAIEnabled, getAIKillSwitch } from '../services/aiProvider.js';

export const aiStatusRouter = Router();

aiStatusRouter.get('/', (_req, res) => {
  res.json(getAIProviderStatus());
});

aiStatusRouter.post('/reset', (_req, res) => {
  resetAIUsageStats();
  res.json(getAIProviderStatus());
});

aiStatusRouter.post('/toggle', (_req, res) => {
  const currentlyKilled = getAIKillSwitch();
  setAIEnabled(currentlyKilled); // flip: if killed → enable, if enabled → kill
  res.json({ enabled: !getAIKillSwitch() });
});

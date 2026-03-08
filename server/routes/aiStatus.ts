import { Router } from 'express';
import { getAIProviderStatus, resetAIUsageStats } from '../services/aiProvider.js';

export const aiStatusRouter = Router();

aiStatusRouter.get('/', (_req, res) => {
  res.json(getAIProviderStatus());
});

aiStatusRouter.post('/reset', (_req, res) => {
  resetAIUsageStats();
  res.json(getAIProviderStatus());
});

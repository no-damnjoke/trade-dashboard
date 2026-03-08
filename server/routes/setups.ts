import { Router } from 'express';
import { getFXSetupContext, getTechnicalSetups } from '../services/setups.js';

export const setupsRouter = Router();

setupsRouter.get('/', (_req, res) => {
  res.json({
    setups: getTechnicalSetups(),
    context: getFXSetupContext(),
    lastUpdated: Date.now(),
  });
});

import { Router } from 'express';
import { getDashboardMarketState } from '../services/marketState.js';

export const marketStateRouter = Router();

marketStateRouter.get('/', (_req, res) => {
  res.json(getDashboardMarketState());
});

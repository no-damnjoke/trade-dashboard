import { Router } from 'express';
import { getMarketFundamentals } from '../services/marketFundamentals.js';

export const marketFundamentalsRouter = Router();

marketFundamentalsRouter.get('/', (_req, res) => {
  res.json(getMarketFundamentals());
});

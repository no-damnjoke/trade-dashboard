import { Router } from 'express';
import {
  getMarketOpportunities,
  getOpportunityNarrative,
  getOpportunityThemes,
  getOpportunityConflicts,
  refreshOpportunityBoard,
} from '../services/opportunities.js';

export const opportunitiesRouter = Router();
let lastUpdated = 0;
const DISABLE_OPPORTUNITY_POLLING = process.env.DISABLE_OPPORTUNITY_POLLING === 'true';

async function refreshOpportunities() {
  try {
    await refreshOpportunityBoard();
    lastUpdated = Date.now();
  } catch (error) {
    console.error('[Opportunities] Refresh failed:', (error as Error).message);
  }
}

if (!DISABLE_OPPORTUNITY_POLLING) {
  refreshOpportunities();
  setInterval(() => {
    void refreshOpportunities();
  }, 30_000);
}

opportunitiesRouter.get('/', (_req, res) => {
  res.json({
    opportunities: getMarketOpportunities(),
    narrative: getOpportunityNarrative(),
    themes: getOpportunityThemes(),
    conflicts: getOpportunityConflicts(),
    lastUpdated,
  });
});

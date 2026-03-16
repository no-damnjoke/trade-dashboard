import { Router } from 'express';
import { getFXSetupContext, getTechnicalSetups, refreshFXSetups } from '../services/setups.js';
import { getFXSetupAIDebug } from '../services/fxSetupEngine.js';

export const fxSetupRouter = Router();
let lastUpdated = 0;
const DISABLE_FX_SETUP_POLLING = process.env.DISABLE_FX_SETUP_POLLING === 'true';

async function refreshSetups() {
  try {
    await refreshFXSetups();
    lastUpdated = Date.now();
  } catch (error) {
    console.error('[FX Setup] Refresh failed:', (error as Error).message);
  }
}

if (!DISABLE_FX_SETUP_POLLING) {
  refreshSetups();
  setInterval(() => {
    void refreshSetups();
  }, 10 * 60_000);
}

fxSetupRouter.get('/', (_req, res) => {
  res.json({
    context: getFXSetupContext(),
    setups: getTechnicalSetups(),
    lastUpdated,
  });
});

fxSetupRouter.get('/debug', (_req, res) => {
  res.json(getFXSetupAIDebug());
});

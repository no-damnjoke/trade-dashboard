import { getAIProviderStatus } from './aiProvider.js';
import { getHeadlineStatus } from './headlines.js';
import { MARKET_INSTRUMENTS } from './instruments.js';
import { getMarketOpportunities } from './opportunities.js';
import { getWhaleSnapshot } from './polymarket.js';
import { getFXSetupContext, getTechnicalSetups } from './setups.js';
import { getActiveSignals, getMonitorStatus, getRegimeSnapshot } from './velocityMonitor.js';

const cachedAssets = MARKET_INSTRUMENTS.map(instrument => ({
  id: instrument.id,
  displayName: instrument.displayName,
  assetClass: instrument.assetClass,
  signalSource: instrument.signalSource,
  realtimeEligible: instrument.realtimeEligible,
}));

export function getDashboardMarketState() {
  const regime = getRegimeSnapshot();
  const monitor = getMonitorStatus();
  const headlines = getHeadlineStatus();
  const opportunities = getMarketOpportunities().slice(0, 8);
  const signals = getActiveSignals().slice(0, 10);
  const setups = getTechnicalSetups().slice(0, 5);
  const fxSetupContext = getFXSetupContext();

  return {
    timestamp: Date.now(),
    regime,
    aiProvider: getAIProviderStatus(),
    monitor,
    opportunities,
    signals,
    setups,
    whales: getWhaleSnapshot().slice(0, 5),
    headlines,
    assets: cachedAssets,
    macro: { regime, monitor, opportunities, signals, headlines },
    fxSetup: { context: fxSetupContext, setups },
  };
}

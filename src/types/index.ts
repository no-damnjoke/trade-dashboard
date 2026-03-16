export interface Headline {
  id: string;
  text: string;
  timestamp: number;
  source: string;
  provider: string;
  classificationMethod: 'deterministic' | 'ai';
  importance: 'critical' | 'high' | 'medium' | 'low';
  marketImpact: 'broad' | 'fx' | 'rates' | 'crypto' | 'asia' | 'commodity' | 'mixed';
  affectedAssets: string[];
  whyItMatters: string;
  actionability: 'actionable' | 'watch' | 'ignore';
  thesisChange?: boolean;
  alertRecommended?: boolean;
  confidence?: number;
  fallbackReason?: string;
  dedupeKey: string;
}

export interface HeatmapEntry {
  currency: string;
  pair: string;
  sourceSymbol?: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface PredictionMarket {
  id: string;
  question: string;
  outcomePrices: number[];
  volume24h: number;
  liquidity: number;
  endDate: string;
  image: string;
  slug: string;
  tags: string[];
  volumeSpike?: boolean;
  yesPct: number;
  delta1h: number | null;
  delta24h: number | null;
  side?: 'YES' | 'NO' | 'unknown';
  estimatedSizeUsd?: number;
}

export interface Alert {
  id: string;
  type: 'price_shock' | 'volume_spike' | 'headline';
  category: string;
  source: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  timestamp: number;
  pair?: string;
  change?: number;
  assetIds?: string[];
  reason?: string;
  suppressed?: boolean;
}

export interface VelocitySignal {
  pair: string;
  displayName: string;
  assetClass: 'fx' | 'crypto' | 'rate' | 'index' | 'commodity';
  currentPrice: number;
  velocity: number;
  acceleration: number;
  zScore: number;
  moveBps: number;
  moveUnit: 'pips' | 'bps';
  direction: 'up' | 'down';
  severity: 'critical' | 'high' | 'medium';
  timestamp: number;
  normalizedMove: number;
  actionable: boolean;
}

export interface TechnicalSetup {
  id: string;
  type: 'event_continuation' | 'range_break_accel' | 'failed_break_reversal' | 'usd_regime_impulse' | string;
  pair: string;
  direction: 'long' | 'short';
  confidence: number;
  invalidation: string;
  supportingFactors: string[];
  staleAfter: number;
  entryZone?: string;
  targets?: string[];
  timeframeAlignment?: string;
  quality?: 'A' | 'B' | 'C' | 'skip';
  reasoning?: string;
  sourceTimeframes?: string;
  classificationMethod?: 'deterministic' | 'ai';
  fallbackReason?: string;
}

export interface HeadlineProviderStatus {
  id: string;
  label: string;
  state: 'ok' | 'degraded' | 'stale' | 'blocked';
  lastSuccess: number;
  failureReason?: string;
  active: boolean;
}

export interface AIProviderStatus {
  provider: 'deterministic' | 'bridge-openai-compatible' | 'official-openai-compatible';
  model: string | null;
  enabled: boolean;
  available: boolean;
  baseUrl?: string;
  lastError?: string;
  headlineImpactModel?: string;
  fxSetupModel?: string;
  opportunityRankerModel?: string;
  lastLatencyMs?: number;
  avgLatencyMs?: number;
}

export interface OpportunityConflict {
  instrument: string;
  description: string;
  sources: string[];
  recommendation: 'watch' | 'fade' | 'wait';
}

export interface MarketOpportunity {
  id: string;
  instrument: string;
  displayName: string;
  directionBias: 'long' | 'short' | 'neutral';
  setupType: 'macro_continuation' | 'event_reprice' | 'breakout_with_confirmation' | 'failed_break' | 'cross_asset_divergence';
  trigger: string;
  confirmationSignals: string[];
  invalidation: string;
  urgency: 'high' | 'medium' | 'low';
  staleAfter: number;
  score: number;
  tvSymbol?: string;
  commentary?: string;
  supportingFactors?: string[];
  sourceMix?: string[];
  confidence?: number;
  classificationMethod?: 'deterministic' | 'ai';
  fallbackReason?: string;
  theme?: string;
  isSynthetic?: boolean;
  conflictFlag?: string;
}

export interface MarketState {
  timestamp: number;
  regime: {
    usdBias: 'stronger' | 'weaker' | 'mixed';
    usdBreadth: number;
    topShock: VelocitySignal | null;
    cryptoImpulse: VelocitySignal | null;
    updatedAt: number;
  };
  aiProvider: AIProviderStatus;
  monitor: {
    assetsTracked: number;
    pairsTracked: number;
    cryptoTracked: number;
    samplesCollected: number;
    marketOpen: boolean;
    fxMarketOpen?: boolean;
    lastPollTime: number;
  };
  opportunities: MarketOpportunity[];
  signals: VelocitySignal[];
  setups: TechnicalSetup[];
  whales: PredictionMarket[];
  headlines: {
    activeProvider: string;
    lastUpdated: number;
    providers: HeadlineProviderStatus[];
  };
  assets: Array<{
    id: string;
    displayName: string;
    assetClass: string;
    signalSource: string;
    realtimeEligible: boolean;
  }>;
  macro?: {
    regime: MarketState['regime'];
    monitor: MarketState['monitor'];
    opportunities: MarketOpportunity[];
    signals: VelocitySignal[];
    headlines: MarketState['headlines'];
  };
  fxSetup?: {
    context: {
      timestamp: number;
      session: 'open' | 'closed';
      regime: MarketState['regime'];
      pairs: Array<{
        id: string;
        displayName: string;
        tvSymbol: string;
        currentPrice: number | null;
        hasActiveSignal: boolean;
        latestSignal: VelocitySignal | null;
      }>;
      headlines: Headline[];
      signals: VelocitySignal[];
    };
    setups: TechnicalSetup[];
  };
}

export type PanelId =
  | 'headlines'
  | 'watchlist'
  | 'calendar'
  | 'velocity'
  | 'setups'
  | 'predictions';

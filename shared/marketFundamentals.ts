export type CountryProfileDepth = 'primary' | 'secondary';

export type CountryRefreshState = 'fresh' | 'stale' | 'degraded';

export type CountrySourceKind = 'policy' | 'macro' | 'trade' | 'market';

export type IndicatorCategory = 'policy_rate' | 'inflation' | 'labor' | 'growth'
  | 'trade' | 'housing' | 'commodity_link' | 'fiscal' | 'intervention'
  | 'sentiment' | 'yields' | 'fx_reserves';

export type IndicatorFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type RateStance = 'hiking' | 'cutting' | 'hold';

export interface CountryNodePosition {
  x: number;
  y: number;
}

export interface CountryMapNode {
  code: string;
  name: string;
  currency: string;
  region: string;
  depth: CountryProfileDepth;
  rateStance: RateStance;
  position: CountryNodePosition;
}

export interface CountryIndicator {
  id: string;
  label: string;
  category: IndicatorCategory;
  value: string;
  previousValue?: string;
  direction?: 'up' | 'down' | 'flat';
  signal: string;
  frequency: IndicatorFrequency;
  lastUpdate: string;
  sourceLabel: string;
  isPrimary: boolean;
}

export interface CountryResearchSource {
  id: string;
  title: string;
  publisher: string;
  kind: CountrySourceKind;
  url: string;
  publishedAt: string;
  whyItMatters: string;
  extracts: string[];
}

export interface CountryChartSeries {
  id: string;
  title: string;
  subtitle: string;
  unit: string;
  latest: string;
  data: number[];
  labels: string[];
  color: string;
  frequency?: IndicatorFrequency;
  category?: IndicatorCategory;
  sourceLabel?: string;
}

export interface CountryAIInsight {
  method: 'ai' | 'deterministic';
  generatedAt: number;
  model?: string;
  summary: string;
  activeDrivers: string[];
  whatChanged: string[];
  gameTheory: string[];
  tradingImplications: string[];
  blindSpots: string[];
}

export interface CountryDependency {
  countryCode: string;
  relationship: string;
  whyNow: string;
}

export interface CountryResearchPacket {
  code: string;
  name: string;
  currency: string;
  region: string;
  depth: CountryProfileDepth;
  centralBank: string;
  policyRate: string;
  rateStance: RateStance;
  nextKeyEvent?: string;
  lastDataUpdate: number;
  summary: string;
  keyAnchors: string[];
  indicators: CountryIndicator[];
  keyThemes: string[];
  structuralForces: string[];
  dependencies: CountryDependency[];
  charts: CountryChartSeries[];
  sources: CountryResearchSource[];
  insight: CountryAIInsight;
}

export interface CountryFundamentalsRefreshStatus {
  state: CountryRefreshState;
  generatedAt: number;
  lastSuccessfulRefresh: number;
  nextScheduledRefresh: number;
  note?: string;
}

export interface DivergenceInsight {
  method: 'ai' | 'deterministic';
  generatedAt: number;
  narrative: string;
  policyDivergences: string[];
  carryImplications: string[];
  riskRegime: string;
  blindSpots: string[];
}

export interface MarketFundamentalsPayload {
  defaultCountryCode: string;
  countries: CountryMapNode[];
  profiles: Record<string, CountryResearchPacket>;
  refresh: CountryFundamentalsRefreshStatus;
  divergence?: DivergenceInsight;
}

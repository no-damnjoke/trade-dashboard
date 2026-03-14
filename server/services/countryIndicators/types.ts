import type { IndicatorCategory, IndicatorFrequency } from '../../../shared/marketFundamentals.js';
import type { RefreshTier } from '../dataProviders/types.js';

export interface IndicatorMapping {
  id: string;
  label: string;
  category: IndicatorCategory;
  frequency: IndicatorFrequency;
  isPrimary: boolean;
  tier: RefreshTier;
  // data source config — exactly one should be set
  tvSymbol?: string;
  policyRateKey?: string;
  macroReadingKey?: string;
  computedSpread?: { symbol1: string; symbol2: string };
}

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  region: string;
  centralBank: string;
  indicators: IndicatorMapping[];
  keyAnchors: string[];
  structuralForces: string[];
  dependencies: Array<{ countryCode: string; relationship: string; whyNow: string }>;
  sources: Array<{
    id: string;
    title: string;
    publisher: string;
    kind: 'policy' | 'macro' | 'trade' | 'market';
    url: string;
    publishedAt: string;
    whyItMatters: string;
    extracts: string[];
  }>;
}

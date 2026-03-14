import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'CAD',
  name: 'Canada',
  currency: 'CAD',
  region: 'North America',
  centralBank: 'Bank of Canada',
  indicators: [
    {
      id: 'cad-overnight-rate',
      label: 'BoC Overnight Rate',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'CAD',
    },
    {
      id: 'cad-cpi-trim',
      label: 'CPI Trim Mean YoY',
      category: 'inflation',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'ca-cpi-trim',
    },
    {
      id: 'cad-unemployment',
      label: 'Unemployment Rate',
      category: 'labor',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'ca-unemployment',
    },
    {
      id: 'cad-wti',
      label: 'WTI Crude Oil',
      category: 'commodity_link',
      frequency: 'daily',
      isPrimary: true,
      tier: 'fast',
      tvSymbol: 'TVC:USOIL',
    },
  ],
  keyAnchors: [
    'BoC rate path vs Fed',
    'Oil price pass-through',
    'Housing vulnerability',
    'US-Canada trade policy',
  ],
  structuralForces: [
    'Deep economic integration with the US links CAD to US cycle and trade policy',
    'Commodity exposure makes CAD a petrocurrency with terms-of-trade sensitivity',
    'Highly leveraged household sector amplifies rate sensitivity',
  ],
  dependencies: [
    {
      countryCode: 'USD',
      relationship: 'Trade integration and rate spread',
      whyNow: 'BoC-Fed divergence directly drives USDCAD',
    },
  ],
  sources: [
    {
      id: 'cad-boc-mpr',
      title: 'BoC Monetary Policy Report — January 2026',
      publisher: 'Bank of Canada',
      kind: 'policy',
      url: 'https://www.bankofcanada.ca/publications/mpr/',
      publishedAt: '2026-01-22',
      whyItMatters: 'Quarterly projection update with growth, inflation, and output gap estimates',
      extracts: [
        'Inflation is expected to remain close to the 2% target over the projection horizon',
        'GDP growth is forecast to pick up gradually through 2026',
      ],
    },
  ],
};

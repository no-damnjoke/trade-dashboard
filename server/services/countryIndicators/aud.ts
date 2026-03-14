import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'AUD',
  name: 'Australia',
  currency: 'AUD',
  region: 'Asia-Pacific',
  centralBank: 'Reserve Bank of Australia',
  indicators: [
    {
      id: 'aud-cash-rate',
      label: 'RBA Cash Rate',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'AUD',
    },
    {
      id: 'aud-trimmed-cpi',
      label: 'Trimmed Mean CPI YoY',
      category: 'inflation',
      frequency: 'quarterly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'au-trimmed-cpi',
    },
    {
      id: 'aud-unemployment',
      label: 'Unemployment Rate',
      category: 'labor',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'au-unemployment',
    },
    {
      id: 'aud-iron-ore',
      label: 'Iron Ore Price',
      category: 'commodity_link',
      frequency: 'daily',
      isPrimary: true,
      tier: 'fast',
      tvSymbol: 'SGX:FEF1!',
    },
  ],
  keyAnchors: [
    'RBA policy normalization',
    'China demand cycle',
    'Iron ore terms of trade',
    'Housing market correction risk',
  ],
  structuralForces: [
    'China is the dominant trade partner — AUD is effectively a China-proxy currency',
    'Commodity export concentration links AUD to global growth expectations',
    'Household debt levels among the highest globally amplify rate sensitivity',
  ],
  dependencies: [
    {
      countryCode: 'NZD',
      relationship: 'Regional peer and policy comparison',
      whyNow: 'AUDNZD tracks relative rate expectations across the Tasman',
    },
    {
      countryCode: 'JPY',
      relationship: 'Risk sentiment proxy',
      whyNow: 'AUDJPY is a widely watched risk-on/risk-off barometer',
    },
  ],
  sources: [
    {
      id: 'aud-rba-smp',
      title: 'RBA Statement on Monetary Policy — February 2026',
      publisher: 'Reserve Bank of Australia',
      kind: 'policy',
      url: 'https://www.rba.gov.au/publications/smp/',
      publishedAt: '2026-02-07',
      whyItMatters: 'Quarterly economic outlook with updated forecasts for inflation and growth',
      extracts: [
        'Underlying inflation has continued to moderate broadly as expected',
        'The labour market remains tight relative to full employment estimates',
      ],
    },
  ],
};

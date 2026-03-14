import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'GBP',
  name: 'United Kingdom',
  currency: 'GBP',
  region: 'Europe',
  centralBank: 'Bank of England',
  indicators: [
    {
      id: 'gbp-bank-rate',
      label: 'BoE Bank Rate',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'GBP',
    },
    {
      id: 'gbp-services-cpi',
      label: 'Services CPI YoY',
      category: 'inflation',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'uk-services-cpi',
    },
    {
      id: 'gbp-unemployment',
      label: 'Unemployment Rate',
      category: 'labor',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'uk-unemployment',
    },
    {
      id: 'gbp-gilt-10y',
      label: 'Gilt 10Y Yield',
      category: 'yields',
      frequency: 'daily',
      isPrimary: true,
      tier: 'fast',
      tvSymbol: 'TVC:GB10Y',
    },
    {
      id: 'gbp-wage-growth',
      label: 'Wage Growth',
      category: 'labor',
      frequency: 'monthly',
      isPrimary: false,
      tier: 'slow',
      macroReadingKey: 'uk-wage-growth',
    },
  ],
  keyAnchors: [
    'BoE services inflation focus',
    'Gilt market stability',
    'Wage-price persistence',
    'Fiscal headroom constraints',
  ],
  structuralForces: [
    'Post-Brexit trade friction keeps structural inflation higher than pre-2016 norms',
    'Tight labor market with immigration-driven supply dynamics',
    'Gilt market sensitivity to fiscal credibility after 2022 crisis',
  ],
  dependencies: [
    {
      countryCode: 'EUR',
      relationship: 'Trade and policy proximity',
      whyNow: 'EURGBP reflects relative growth and rate expectations',
    },
    {
      countryCode: 'USD',
      relationship: 'Global risk appetite',
      whyNow: 'Cable tracks USD strength cycles and rate differentials',
    },
  ],
  sources: [
    {
      id: 'gbp-boe-mpr',
      title: 'BoE Monetary Policy Report — February 2026',
      publisher: 'Bank of England',
      kind: 'policy',
      url: 'https://www.bankofengland.co.uk/monetary-policy-report/2026/february-2026',
      publishedAt: '2026-02-06',
      whyItMatters: 'Updated inflation and growth projections shape market rate expectations',
      extracts: [
        'Services inflation is expected to decline gradually through 2026',
        'GDP growth forecast revised slightly higher on stronger consumption',
      ],
    },
  ],
};

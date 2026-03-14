import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'CHF',
  name: 'Switzerland',
  currency: 'CHF',
  region: 'Europe',
  centralBank: 'Swiss National Bank',
  indicators: [
    {
      id: 'chf-policy-rate',
      label: 'SNB Policy Rate',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'CHF',
    },
    {
      id: 'chf-cpi',
      label: 'CPI YoY',
      category: 'inflation',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'ch-cpi',
    },
    {
      id: 'chf-eurchf',
      label: 'EURCHF',
      category: 'fx_reserves',
      frequency: 'daily',
      isPrimary: true,
      tier: 'fast',
      tvSymbol: 'OANDA:EURCHF',
    },
  ],
  keyAnchors: [
    'SNB FX intervention stance',
    'Safe-haven flows',
    'Low inflation persistence',
  ],
  structuralForces: [
    'Persistent safe-haven demand creates appreciation pressure the SNB must manage',
    'Inflation structurally lower than peers — SNB often leads the cutting cycle',
    'Large current account surplus reinforces CHF strength bias',
  ],
  dependencies: [
    {
      countryCode: 'EUR',
      relationship: 'Trade and FX management',
      whyNow: 'EURCHF is the SNB primary policy instrument and eurozone stress gauge',
    },
  ],
  sources: [
    {
      id: 'chf-snb-assessment',
      title: 'SNB Monetary Policy Assessment — March 2026',
      publisher: 'Swiss National Bank',
      kind: 'policy',
      url: 'https://www.snb.ch/en/ifor/monetary/monpol/id/monpol_current',
      publishedAt: '2026-03-13',
      whyItMatters: 'SNB only meets quarterly — each decision carries outsized signaling weight',
      extracts: [
        'The SNB lowered the policy rate by 25 basis points to 0.50%',
        'Inflation remains within the price stability range',
      ],
    },
  ],
};

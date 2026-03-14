import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'NOK',
  name: 'Norway',
  currency: 'NOK',
  region: 'Europe',
  centralBank: 'Norges Bank',
  indicators: [
    {
      id: 'nok-policy-rate',
      label: 'Norges Bank Rate',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'NOK',
    },
    {
      id: 'nok-cpi-ate',
      label: 'CPI-ATE YoY',
      category: 'inflation',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'no-cpi-ate',
    },
    {
      id: 'nok-brent',
      label: 'Brent Crude Oil',
      category: 'commodity_link',
      frequency: 'daily',
      isPrimary: true,
      tier: 'fast',
      tvSymbol: 'NYMEX:BZ1!',
    },
    {
      id: 'nok-unemployment',
      label: 'Unemployment Rate',
      category: 'labor',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'no-unemployment',
    },
  ],
  keyAnchors: [
    'Norges Bank rate path',
    'Oil price and fiscal revenue',
    'Sovereign wealth fund flows',
    'Krone weakness tolerance',
  ],
  structuralForces: [
    'Oil and gas revenue dominance links NOK to energy prices and global demand',
    'Government Pension Fund Global creates unique fiscal buffer and FX flow dynamics',
    'Norges Bank has tolerated NOK weakness as an inflation offset mechanism',
  ],
  dependencies: [
    {
      countryCode: 'SEK',
      relationship: 'Scandinavian peer',
      whyNow: 'NOKSEK reflects relative commodity exposure and rate paths',
    },
    {
      countryCode: 'EUR',
      relationship: 'Trade partner and rate anchor',
      whyNow: 'EURNOK driven by oil prices and ECB-Norges Bank rate differential',
    },
  ],
  sources: [
    {
      id: 'nok-norges-mpr',
      title: 'Norges Bank Monetary Policy Report — March 2026',
      publisher: 'Norges Bank',
      kind: 'policy',
      url: 'https://www.norges-bank.no/en/news-events/news-publications/Reports/Monetary-Policy-Report-with-financial-stability-assessment/',
      publishedAt: '2026-03-06',
      whyItMatters: 'Rate path projection and oil price assumptions drive NOK expectations',
      extracts: [
        'The policy rate will most likely be reduced in the course of 2026',
        'Underlying inflation has declined but remains above target',
      ],
    },
  ],
};

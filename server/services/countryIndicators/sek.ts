import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'SEK',
  name: 'Sweden',
  currency: 'SEK',
  region: 'Europe',
  centralBank: 'Sveriges Riksbank',
  indicators: [
    {
      id: 'sek-riksbank-rate',
      label: 'Riksbank Rate',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'SEK',
    },
    {
      id: 'sek-cpif',
      label: 'CPIF YoY',
      category: 'inflation',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'se-cpif',
    },
    {
      id: 'sek-unemployment',
      label: 'Unemployment Rate',
      category: 'labor',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'se-unemployment',
    },
  ],
  keyAnchors: [
    'Riksbank rate path',
    'CPIF dynamics',
    'Housing market leverage',
    'Export sector competitiveness',
  ],
  structuralForces: [
    'Highly leveraged household sector with variable-rate mortgages amplifies rate transmission',
    'Export-oriented economy sensitive to eurozone demand cycle',
    'Riksbank has historically been willing to move ahead of ECB',
  ],
  dependencies: [
    {
      countryCode: 'EUR',
      relationship: 'Trade and policy proximity',
      whyNow: 'EURSEK tracks ECB-Riksbank rate differential and eurozone growth',
    },
    {
      countryCode: 'NOK',
      relationship: 'Scandinavian peer',
      whyNow: 'NOKSEK reflects relative commodity exposure and rate paths',
    },
  ],
  sources: [
    {
      id: 'sek-riksbank-mpr',
      title: 'Riksbank Monetary Policy Report — February 2026',
      publisher: 'Sveriges Riksbank',
      kind: 'policy',
      url: 'https://www.riksbank.se/en-gb/monetary-policy/monetary-policy-report/',
      publishedAt: '2026-02-12',
      whyItMatters: 'Riksbank rate path projection and inflation outlook guide SEK positioning',
      extracts: [
        'CPIF inflation is close to the target of 2 per cent',
        'The policy rate is expected to remain at current levels in the near term',
      ],
    },
  ],
};

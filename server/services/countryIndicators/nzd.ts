import type { CountryConfig } from './types.js';

export const config: CountryConfig = {
  code: 'NZD',
  name: 'New Zealand',
  currency: 'NZD',
  region: 'Asia-Pacific',
  centralBank: 'Reserve Bank of New Zealand',
  indicators: [
    {
      id: 'nzd-ocr',
      label: 'RBNZ OCR',
      category: 'policy_rate',
      frequency: 'monthly',
      isPrimary: true,
      tier: 'slow',
      policyRateKey: 'NZD',
    },
    {
      id: 'nzd-cpi',
      label: 'CPI YoY',
      category: 'inflation',
      frequency: 'quarterly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'nz-cpi',
    },
    {
      id: 'nzd-unemployment',
      label: 'Unemployment Rate',
      category: 'labor',
      frequency: 'quarterly',
      isPrimary: true,
      tier: 'slow',
      macroReadingKey: 'nz-unemployment',
    },
  ],
  keyAnchors: [
    'RBNZ rate path',
    'Dairy export prices',
    'Migration-driven demand',
  ],
  structuralForces: [
    'Small open economy highly sensitive to global risk appetite and commodity prices',
    'Dairy export concentration links NZD to GDT auction outcomes',
    'Housing affordability and migration policy create demand-side inflation pressure',
  ],
  dependencies: [
    {
      countryCode: 'AUD',
      relationship: 'Regional peer and trade partner',
      whyNow: 'AUDNZD reflects relative monetary policy expectations',
    },
  ],
  sources: [
    {
      id: 'nzd-rbnz-mps',
      title: 'RBNZ Monetary Policy Statement — February 2026',
      publisher: 'Reserve Bank of New Zealand',
      kind: 'policy',
      url: 'https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement',
      publishedAt: '2026-02-19',
      whyItMatters: 'Sets OCR with updated projections and signals future policy direction',
      extracts: [
        'The Committee agreed to lower the OCR as inflation returns sustainably to target',
        'Economic growth is expected to recover gradually through 2026',
      ],
    },
  ],
};

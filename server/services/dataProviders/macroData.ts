export interface MacroReading {
  value: string;
  numericValue: number;
  previousValue?: string;
  previousNumeric?: number;
  releaseDate: string;
  nextRelease?: string;
  source: string;
}

/**
 * Manually-maintained registry of latest macro indicator readings.
 *
 * Keyed by a stable indicator ID (e.g. 'us-core-cpi').
 * More reliable than scraping national statistics agencies — update
 * each entry after the official release.
 */
const MACRO_READINGS: Record<string, MacroReading> = {
  // ── USD ────────────────────────────────────────────────────────────
  'us-core-cpi': {
    value: '3.3%',
    numericValue: 3.3,
    previousValue: '3.3%',
    previousNumeric: 3.3,
    releaseDate: '2025-02-12',
    source: 'BLS',
  },
  'us-core-pce': {
    value: '2.6%',
    numericValue: 2.6,
    previousValue: '2.8%',
    previousNumeric: 2.8,
    releaseDate: '2025-02-28',
    source: 'BEA',
  },
  'us-nfp': {
    value: '+151K',
    numericValue: 151,
    previousValue: '+125K',
    previousNumeric: 125,
    releaseDate: '2025-03-07',
    source: 'BLS',
  },
  'us-unemployment': {
    value: '4.1%',
    numericValue: 4.1,
    previousValue: '4.0%',
    previousNumeric: 4.0,
    releaseDate: '2025-03-07',
    source: 'BLS',
  },
  'us-ism-mfg': {
    value: '50.3',
    numericValue: 50.3,
    previousValue: '50.9',
    previousNumeric: 50.9,
    releaseDate: '2025-03-03',
    source: 'ISM',
  },
  'us-initial-claims': {
    value: '221K',
    numericValue: 221,
    previousValue: '242K',
    previousNumeric: 242,
    releaseDate: '2025-03-06',
    source: 'DOL',
  },

  // ── EUR ────────────────────────────────────────────────────────────
  'ez-core-hicp': {
    value: '2.6%',
    numericValue: 2.6,
    previousValue: '2.7%',
    previousNumeric: 2.7,
    releaseDate: '2025-03-03',
    source: 'Eurostat',
  },
  'ez-unemployment': {
    value: '6.2%',
    numericValue: 6.2,
    previousValue: '6.3%',
    previousNumeric: 6.3,
    releaseDate: '2025-03-03',
    source: 'Eurostat',
  },
  'de-ifo': {
    value: '85.2',
    numericValue: 85.2,
    previousValue: '84.7',
    previousNumeric: 84.7,
    releaseDate: '2025-02-24',
    source: 'ifo Institute',
  },
  'ez-composite-pmi': {
    value: '50.2',
    numericValue: 50.2,
    previousValue: '50.2',
    previousNumeric: 50.2,
    releaseDate: '2025-03-05',
    source: 'S&P Global',
  },

  // ── GBP ────────────────────────────────────────────────────────────
  'uk-services-cpi': {
    value: '5.0%',
    numericValue: 5.0,
    previousValue: '4.4%',
    previousNumeric: 4.4,
    releaseDate: '2025-02-19',
    source: 'ONS',
  },
  'uk-unemployment': {
    value: '4.4%',
    numericValue: 4.4,
    previousValue: '4.4%',
    previousNumeric: 4.4,
    releaseDate: '2025-02-18',
    source: 'ONS',
  },
  'uk-wage-growth': {
    value: '5.9%',
    numericValue: 5.9,
    previousValue: '5.6%',
    previousNumeric: 5.6,
    releaseDate: '2025-02-18',
    source: 'ONS',
  },

  // ── JPY ────────────────────────────────────────────────────────────
  'jp-core-core-cpi': {
    value: '2.5%',
    numericValue: 2.5,
    previousValue: '2.5%',
    previousNumeric: 2.5,
    releaseDate: '2025-02-21',
    source: 'MIC',
  },
  'jp-trade-balance': {
    value: '¥-2584B',
    numericValue: -2584,
    previousValue: '¥-1209B',
    previousNumeric: -1209,
    releaseDate: '2025-02-20',
    source: 'MOF',
  },

  // ── CHF ────────────────────────────────────────────────────────────
  'ch-cpi': {
    value: '0.3%',
    numericValue: 0.3,
    previousValue: '0.6%',
    previousNumeric: 0.6,
    releaseDate: '2025-03-04',
    source: 'FSO',
  },

  // ── CAD ────────────────────────────────────────────────────────────
  'ca-cpi-trim': {
    value: '2.9%',
    numericValue: 2.9,
    previousValue: '2.5%',
    previousNumeric: 2.5,
    releaseDate: '2025-02-18',
    source: 'StatCan',
  },
  'ca-unemployment': {
    value: '6.6%',
    numericValue: 6.6,
    previousValue: '6.7%',
    previousNumeric: 6.7,
    releaseDate: '2025-03-07',
    source: 'StatCan',
  },

  // ── AUD ────────────────────────────────────────────────────────────
  'au-trimmed-cpi': {
    value: '3.2%',
    numericValue: 3.2,
    previousValue: '3.5%',
    previousNumeric: 3.5,
    releaseDate: '2025-01-29',
    source: 'ABS',
  },
  'au-unemployment': {
    value: '4.1%',
    numericValue: 4.1,
    previousValue: '4.0%',
    previousNumeric: 4.0,
    releaseDate: '2025-02-20',
    source: 'ABS',
  },

  // ── NZD ────────────────────────────────────────────────────────────
  'nz-cpi': {
    value: '2.2%',
    numericValue: 2.2,
    previousValue: '2.2%',
    previousNumeric: 2.2,
    releaseDate: '2025-01-22',
    source: 'Stats NZ',
  },
  'nz-unemployment': {
    value: '5.1%',
    numericValue: 5.1,
    previousValue: '4.8%',
    previousNumeric: 4.8,
    releaseDate: '2025-02-05',
    source: 'Stats NZ',
  },

  // ── SEK ────────────────────────────────────────────────────────────
  'se-cpif': {
    value: '2.9%',
    numericValue: 2.9,
    previousValue: '1.5%',
    previousNumeric: 1.5,
    releaseDate: '2025-02-13',
    source: 'SCB',
  },
  'se-unemployment': {
    value: '8.6%',
    numericValue: 8.6,
    previousValue: '8.5%',
    previousNumeric: 8.5,
    releaseDate: '2025-02-20',
    source: 'SCB',
  },

  // ── NOK ────────────────────────────────────────────────────────────
  'no-cpi-ate': {
    value: '3.4%',
    numericValue: 3.4,
    previousValue: '3.0%',
    previousNumeric: 3.0,
    releaseDate: '2025-02-10',
    source: 'SSB',
  },
  'no-unemployment': {
    value: '4.1%',
    numericValue: 4.1,
    previousValue: '4.2%',
    previousNumeric: 4.2,
    releaseDate: '2025-01-30',
    source: 'SSB',
  },
};

/**
 * Get a single macro reading by its indicator ID (e.g. 'us-core-cpi').
 */
export function getMacroReading(indicatorId: string): MacroReading | null {
  return MACRO_READINGS[indicatorId] ?? null;
}

/**
 * Return the full registry of macro readings.
 */
export function getAllMacroReadings(): Record<string, MacroReading> {
  return { ...MACRO_READINGS };
}

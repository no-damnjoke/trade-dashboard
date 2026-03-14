export interface PolicyRate {
  centralBank: string;
  rate: string;
  rateNumeric: number;
  stance: 'hiking' | 'cutting' | 'hold';
  lastChanged: string; // ISO date
  nextMeeting?: string;
  source: string;
}

/**
 * Manually-maintained registry of current G10 policy rates.
 *
 * This is intentionally static rather than scraped — central bank websites
 * are fragile targets and rates change only 8–12 times per year.
 * Update this map after each rate decision.
 */
const POLICY_RATES: Record<string, PolicyRate> = {
  USD: {
    centralBank: 'Federal Reserve',
    rate: '4.25–4.50%',
    rateNumeric: 4.375,
    stance: 'hold',
    lastChanged: '2024-12-18',
    nextMeeting: 'FOMC Mar 18-19',
    source: 'Federal Reserve',
  },
  EUR: {
    centralBank: 'ECB',
    rate: '2.65%',
    rateNumeric: 2.65,
    stance: 'cutting',
    lastChanged: '2025-03-06',
    nextMeeting: 'ECB Apr 17',
    source: 'ECB',
  },
  GBP: {
    centralBank: 'Bank of England',
    rate: '4.50%',
    rateNumeric: 4.50,
    stance: 'cutting',
    lastChanged: '2025-02-06',
    nextMeeting: 'BoE Mar 20',
    source: 'Bank of England',
  },
  JPY: {
    centralBank: 'Bank of Japan',
    rate: '0.50%',
    rateNumeric: 0.50,
    stance: 'hiking',
    lastChanged: '2025-01-24',
    nextMeeting: 'BoJ Mar 13-14',
    source: 'Bank of Japan',
  },
  CHF: {
    centralBank: 'SNB',
    rate: '0.50%',
    rateNumeric: 0.50,
    stance: 'cutting',
    lastChanged: '2024-12-12',
    nextMeeting: 'SNB Mar 20',
    source: 'SNB',
  },
  CAD: {
    centralBank: 'Bank of Canada',
    rate: '2.75%',
    rateNumeric: 2.75,
    stance: 'cutting',
    lastChanged: '2025-03-12',
    nextMeeting: 'BoC Apr 16',
    source: 'Bank of Canada',
  },
  AUD: {
    centralBank: 'RBA',
    rate: '4.10%',
    rateNumeric: 4.10,
    stance: 'cutting',
    lastChanged: '2025-02-18',
    nextMeeting: 'RBA Apr 1',
    source: 'RBA',
  },
  NZD: {
    centralBank: 'RBNZ',
    rate: '3.75%',
    rateNumeric: 3.75,
    stance: 'cutting',
    lastChanged: '2025-02-19',
    nextMeeting: 'RBNZ Apr 9',
    source: 'RBNZ',
  },
  SEK: {
    centralBank: 'Riksbank',
    rate: '2.25%',
    rateNumeric: 2.25,
    stance: 'cutting',
    lastChanged: '2025-01-29',
    nextMeeting: 'Riksbank Mar 20',
    source: 'Riksbank',
  },
  NOK: {
    centralBank: 'Norges Bank',
    rate: '4.50%',
    rateNumeric: 4.50,
    stance: 'hold',
    lastChanged: '2023-12-14',
    nextMeeting: 'Norges Mar 27',
    source: 'Norges Bank',
  },
};

/**
 * Get the current policy rate for a given currency code (e.g. 'USD', 'EUR').
 */
export function getPolicyRate(countryCode: string): PolicyRate | null {
  return POLICY_RATES[countryCode.toUpperCase()] ?? null;
}

/**
 * Return the full registry of policy rates, keyed by currency code.
 */
export function getAllPolicyRates(): Record<string, PolicyRate> {
  return { ...POLICY_RATES };
}

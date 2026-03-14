import type { CountryConfig } from './types.js';

import { config as usd } from './usd.js';
import { config as eur } from './eur.js';
import { config as gbp } from './gbp.js';
import { config as jpy } from './jpy.js';
import { config as chf } from './chf.js';
import { config as cad } from './cad.js';
import { config as aud } from './aud.js';
import { config as nzd } from './nzd.js';
import { config as sek } from './sek.js';
import { config as nok } from './nok.js';

const registry = new Map<string, CountryConfig>([
  ['USD', usd],
  ['EUR', eur],
  ['GBP', gbp],
  ['JPY', jpy],
  ['CHF', chf],
  ['CAD', cad],
  ['AUD', aud],
  ['NZD', nzd],
  ['SEK', sek],
  ['NOK', nok],
]);

export function getCountryConfig(code: string): CountryConfig | undefined {
  return registry.get(code.toUpperCase());
}

export function getAllConfigs(): CountryConfig[] {
  return Array.from(registry.values());
}

export function getAllCountryCodes(): string[] {
  return Array.from(registry.keys());
}

export type { CountryConfig, IndicatorMapping } from './types.js';

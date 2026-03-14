import { getTradingViewQuote } from '../tradingview.js';
import { dataCache, FAST_TTL } from './cache.js';
import type { SeriesFetchResult } from './types.js';

/**
 * Fetch a single TradingView indicator value through the data provider interface.
 * Results are cached with FAST_TTL (5 min).
 */
export async function fetchTradingViewIndicator(
  tvSymbol: string,
  label: string,
): Promise<SeriesFetchResult> {
  const cacheKey = `tv:${tvSymbol}`;

  // Check cache first
  const cached = dataCache.get<SeriesFetchResult>(cacheKey);
  if (cached && !cached.stale) {
    return cached.value;
  }

  try {
    const quote = await getTradingViewQuote(tvSymbol);

    if (!quote) {
      // Return stale cache if available, otherwise error
      if (cached) {
        return { ...cached.value, stale: true };
      }
      return {
        ok: false,
        error: `No quote returned for ${tvSymbol}`,
        source: 'TradingView',
      };
    }

    const result: SeriesFetchResult = {
      ok: true,
      value: quote.price,
      formatted: formatPrice(quote.price, tvSymbol),
      previousValue: quote.prevClose,
      date: new Date(quote.updatedAt).toISOString(),
      source: 'TradingView',
    };

    dataCache.set(cacheKey, result, FAST_TTL);
    return result;
  } catch (err) {
    // Return stale cache on error if available
    if (cached) {
      return { ...cached.value, stale: true };
    }
    return {
      ok: false,
      error: `Failed to fetch ${label}: ${err instanceof Error ? err.message : String(err)}`,
      source: 'TradingView',
    };
  }
}

/**
 * Compute a spread between two TradingView symbols.
 * Useful for yield curve spreads (2Y/10Y) or cross-country spreads (BTP-Bund).
 */
export async function fetchYieldSpread(
  symbol1: string,
  symbol2: string,
  label: string,
): Promise<SeriesFetchResult> {
  const cacheKey = `tv-spread:${symbol1}:${symbol2}`;

  const cached = dataCache.get<SeriesFetchResult>(cacheKey);
  if (cached && !cached.stale) {
    return cached.value;
  }

  try {
    const [q1, q2] = await Promise.all([
      getTradingViewQuote(symbol1),
      getTradingViewQuote(symbol2),
    ]);

    if (!q1 || !q2) {
      if (cached) {
        return { ...cached.value, stale: true };
      }
      const missing = !q1 ? symbol1 : symbol2;
      return {
        ok: false,
        error: `No quote for ${missing} when computing ${label}`,
        source: 'TradingView',
      };
    }

    const spread = q1.price - q2.price;
    const prevSpread =
      q1.prevClose && q2.prevClose ? q1.prevClose - q2.prevClose : undefined;

    const result: SeriesFetchResult = {
      ok: true,
      value: Number(spread.toFixed(3)),
      formatted: `${spread >= 0 ? '+' : ''}${(spread * 100).toFixed(1)} bps`,
      previousValue: prevSpread !== undefined ? Number(prevSpread.toFixed(3)) : undefined,
      date: new Date(Math.max(q1.updatedAt, q2.updatedAt)).toISOString(),
      source: 'TradingView',
    };

    dataCache.set(cacheKey, result, FAST_TTL);
    return result;
  } catch (err) {
    if (cached) {
      return { ...cached.value, stale: true };
    }
    return {
      ok: false,
      error: `Failed to compute ${label}: ${err instanceof Error ? err.message : String(err)}`,
      source: 'TradingView',
    };
  }
}

// ── Well-known TradingView symbols ──────────────────────────────────

export const TV_YIELDS = {
  US02Y: 'TVC:US02Y',
  US10Y: 'TVC:US10Y',
  DE10Y: 'TVC:DE10Y',
  GB10Y: 'TVC:GB10Y',
  JP10Y: 'TVC:JP10Y',
  AU10Y: 'TVC:AU10Y',
} as const;

export const TV_COMMODITIES = {
  WTI:      'TVC:USOIL',
  BRENT:    'NYMEX:BZ1!',
  GOLD:     'COMEX:GC1!',
  IRON_ORE: 'SGX:FEF1!',
} as const;

export const TV_FX = {
  USDJPY: 'OANDA:USDJPY',
  EURCHF: 'OANDA:EURCHF',
  EURUSD: 'OANDA:EURUSD',
  GBPUSD: 'OANDA:GBPUSD',
  AUDUSD: 'OANDA:AUDUSD',
  NZDUSD: 'OANDA:NZDUSD',
  USDCAD: 'OANDA:USDCAD',
  USDCHF: 'OANDA:USDCHF',
  USDSEK: 'OANDA:USDSEK',
  USDNOK: 'OANDA:USDNOK',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function formatPrice(price: number, symbol: string): string {
  // Yields are displayed as percentages with 3 decimals
  if (symbol.includes('US02Y') || symbol.includes('US10Y') ||
      symbol.includes('DE10Y') || symbol.includes('GB10Y') ||
      symbol.includes('JP10Y') || symbol.includes('AU10Y')) {
    return `${price.toFixed(3)}%`;
  }

  // Gold / iron ore — no decimals
  if (symbol.includes('GC1') || symbol.includes('FEF1')) {
    return price.toFixed(0);
  }

  // Oil — 2 decimals
  if (symbol.includes('USOIL') || symbol.includes('BZ1')) {
    return price.toFixed(2);
  }

  // FX — 4 decimals (JPY pairs get 2)
  if (symbol.includes('JPY') || symbol.includes('SEK') || symbol.includes('NOK')) {
    return price.toFixed(2);
  }

  return price.toFixed(4);
}

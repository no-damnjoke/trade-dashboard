import type { Candle } from './tradingviewCandles.js';
import type { TradingViewQuote } from './tradingview.js';

interface MockPairState {
  symbol: string;
  price: number;
  prevClose: number;
  updatedAt: number;
  candles: Record<string, Candle[]>;
}

const mockPairs = new Map<string, MockPairState>();
let enabled = false;

function timeframeMs(timeframe: string) {
  switch (timeframe) {
    case '5':
      return 5 * 60_000;
    case '15':
      return 15 * 60_000;
    case '60':
      return 60 * 60_000;
    default:
      return 60_000;
  }
}

function buildSeedCandles(price: number, timeframe: string, range: number, updatedAt: number): Candle[] {
  const step = timeframeMs(timeframe);
  return Array.from({ length: range }, (_value, index) => {
    const drift = ((index % 7) - 3) * price * 0.00003;
    const close = Number((price + drift).toFixed(6));
    const open = Number((close - price * 0.00002).toFixed(6));
    return {
      time: updatedAt - (range - index) * step,
      open,
      high: Number((Math.max(open, close) + price * 0.00004).toFixed(6)),
      low: Number((Math.min(open, close) - price * 0.00004).toFixed(6)),
      close,
      volume: 100 + index,
    };
  });
}

function updateCandles(state: MockPairState, price: number, updatedAt: number) {
  for (const timeframe of ['5', '15', '60']) {
    const candles = state.candles[timeframe] ?? buildSeedCandles(price, timeframe, timeframe === '5' ? 120 : timeframe === '15' ? 100 : 80, updatedAt);
    const last = candles[candles.length - 1];
    const next: Candle = {
      time: Math.max(updatedAt, last?.time ? last.time + timeframeMs(timeframe) : updatedAt),
      open: last?.close ?? price,
      high: Number((Math.max(last?.close ?? price, price) + price * 0.00008).toFixed(6)),
      low: Number((Math.min(last?.close ?? price, price) - price * 0.00008).toFixed(6)),
      close: Number(price.toFixed(6)),
      volume: (last?.volume ?? 100) + 5,
    };
    state.candles[timeframe] = [...candles.slice(1), next];
  }
}

export function enableMockMarketData() {
  enabled = true;
}

export function disableMockMarketData() {
  enabled = false;
}

export function clearMockMarketData() {
  mockPairs.clear();
}

export function isMockMarketDataEnabled() {
  return enabled;
}

export function upsertMockPrice(symbol: string, price: number, previousClose?: number) {
  const now = Date.now();
  const existing = mockPairs.get(symbol);
  if (existing && existing.price === price) {
    return { changed: false, quote: existing };
  }

  const state: MockPairState = existing ?? {
    symbol,
    price,
    prevClose: previousClose ?? price,
    updatedAt: now,
    candles: {
      '5': buildSeedCandles(price, '5', 120, now),
      '15': buildSeedCandles(price, '15', 100, now),
      '60': buildSeedCandles(price, '60', 80, now),
    },
  };

  state.prevClose = existing?.prevClose ?? previousClose ?? price;
  state.price = price;
  state.updatedAt = now;
  updateCandles(state, price, now);
  mockPairs.set(symbol, state);
  return { changed: true, quote: state };
}

export function setMockScenario(symbol: string, candles: Record<string, Candle[]>, previousClose?: number) {
  const latestTimeframe = candles['5']?.length ? '5' : candles['15']?.length ? '15' : '60';
  const latestCandle = candles[latestTimeframe]?.[candles[latestTimeframe].length - 1];
  if (!latestCandle) {
    throw new Error(`mock scenario for ${symbol} requires at least one candle`);
  }

  const state: MockPairState = {
    symbol,
    price: latestCandle.close,
    prevClose: previousClose ?? candles[latestTimeframe][0]?.open ?? latestCandle.close,
    updatedAt: latestCandle.time,
    candles: {
      '5': candles['5'] ?? [],
      '15': candles['15'] ?? [],
      '60': candles['60'] ?? [],
    },
  };

  mockPairs.set(symbol, state);
  return state;
}

export function getMockQuote(symbol: string): TradingViewQuote | null {
  if (!enabled) return null;
  const state = mockPairs.get(symbol);
  if (!state) return null;
  return {
    symbol,
    price: state.price,
    prevClose: state.prevClose,
    changePercent: state.prevClose ? ((state.price - state.prevClose) / state.prevClose) * 100 : 0,
    bid: state.price,
    ask: state.price,
    session: 'regular',
    updatedAt: state.updatedAt,
  };
}

export function getMockCandles(symbol: string, timeframe: string, range: number): Candle[] | null {
  if (!enabled) return null;
  const state = mockPairs.get(symbol);
  if (!state) return null;
  const candles = state.candles[timeframe];
  return candles ? candles.slice(-range) : null;
}

export function getMockMarketStatus() {
  return {
    enabled,
    symbols: Array.from(mockPairs.values()).map(pair => ({
      symbol: pair.symbol,
      price: pair.price,
      updatedAt: pair.updatedAt,
    })),
  };
}

export function getMockSymbols() {
  return Array.from(mockPairs.keys());
}

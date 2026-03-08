import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TradingView = require('@mathieuc/tradingview');
import { getMockCandles } from './mockMarketData.js';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const client = new TradingView.Client({ server: 'widgetdata' });
const CANDLE_CACHE_TTL_MS = 60_000;
const candleCache = new Map<string, { candles: Candle[]; timestamp: number }>();

function cacheKey(symbol: string, timeframe: string, range: number) {
  return `${symbol}:${timeframe}:${range}`;
}

export async function getTradingViewCandles(symbol: string, timeframe: string, range: number): Promise<Candle[]> {
  const mock = getMockCandles(symbol, timeframe, range);
  if (mock) {
    return mock;
  }

  const key = cacheKey(symbol, timeframe, range);
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.timestamp < CANDLE_CACHE_TTL_MS) {
    return cached.candles;
  }

  const candles = await new Promise<Candle[]>((resolve, reject) => {
    const chart = new client.Session.Chart();
    const timeout = setTimeout(() => {
      chart.delete();
      reject(new Error(`candles timeout ${symbol} ${timeframe}`));
    }, 8_000);

    chart.onError((...err: unknown[]) => {
      clearTimeout(timeout);
      chart.delete();
      reject(new Error(`chart error ${symbol} ${timeframe}: ${err.map(String).join(' ')}`));
    });

    chart.onUpdate(() => {
      if (chart.periods.length < Math.min(range, 10)) return;

      clearTimeout(timeout);
      const periods = chart.periods
        .slice(0, range)
        .map((period: { time: number; open: number; max: number; min: number; close: number; volume: number }) => ({
          time: period.time * 1000,
          open: period.open,
          high: period.max,
          low: period.min,
          close: period.close,
          volume: period.volume,
        }))
        .sort((left: Candle, right: Candle) => left.time - right.time);

      chart.delete();
      resolve(periods);
    });

    chart.setMarket(symbol, {
      timeframe,
      range,
    });
  });

  candleCache.set(key, { candles, timestamp: Date.now() });
  return candles;
}

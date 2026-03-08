import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TradingView = require('@mathieuc/tradingview');
import { getMockQuote } from './mockMarketData.js';

export interface TradingViewQuote {
  symbol: string;
  price: number;
  prevClose: number;
  changePercent: number;
  bid?: number;
  ask?: number;
  session?: string;
  updatedAt: number;
}

const client = new TradingView.Client({ server: 'widgetdata' });
const quoteSession = new client.Session.Quote({
  customFields: ['lp', 'bid', 'ask', 'prev_close_price', 'chp', 'current_session'],
});

const marketListeners = new Map<string, any>();
const quotes = new Map<string, TradingViewQuote>();
const pendingResolvers = new Map<string, Array<() => void>>();

function ensureMarket(symbol: string) {
  if (marketListeners.has(symbol)) return;

  const market = new quoteSession.Market(symbol);
  market.onData((data: any) => {
    const prevClose = Number(data.prev_close_price || 0);
    const price = Number(data.lp || data.bid || data.ask || prevClose || 0);
    if (!price) return;

    const chp = Number(data.chp ?? (prevClose ? ((price - prevClose) / prevClose) * 100 : 0));
    quotes.set(symbol, {
      symbol,
      price,
      prevClose: prevClose || price,
      changePercent: Number.isFinite(chp) ? chp : 0,
      bid: Number(data.bid || 0) || undefined,
      ask: Number(data.ask || 0) || undefined,
      session: data.current_session,
      updatedAt: Date.now(),
    });

    const resolvers = pendingResolvers.get(symbol);
    if (resolvers) {
      pendingResolvers.delete(symbol);
      for (const resolve of resolvers) resolve();
    }
  });

  marketListeners.set(symbol, market);
}

export async function getTradingViewQuote(symbol: string): Promise<TradingViewQuote | null> {
  const mock = getMockQuote(symbol);
  if (mock) return mock;

  ensureMarket(symbol);

  const existing = quotes.get(symbol);
  if (existing) return existing;

  return new Promise<TradingViewQuote | null>(resolve => {
    const timeout = setTimeout(() => {
      const list = pendingResolvers.get(symbol);
      if (list) {
        const idx = list.indexOf(onData);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) pendingResolvers.delete(symbol);
      }
      resolve(quotes.get(symbol) || null);
    }, 4000);

    const onData = () => {
      clearTimeout(timeout);
      resolve(quotes.get(symbol) || null);
    };

    const list = pendingResolvers.get(symbol);
    if (list) list.push(onData);
    else pendingResolvers.set(symbol, [onData]);
  });
}

export async function getTradingViewQuotes(symbols: string[]): Promise<TradingViewQuote[]> {
  await Promise.all(symbols.map(symbol => getTradingViewQuote(symbol)));
  return symbols
    .map(symbol => quotes.get(symbol))
    .filter((quote): quote is TradingViewQuote => !!quote);
}

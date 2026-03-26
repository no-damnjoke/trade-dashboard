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

// How long before we consider the entire quote stream stale and reconnect
const STREAM_STALE_MS = 90_000;
// How often to check stream health
const HEALTH_CHECK_INTERVAL_MS = 30_000;
// Minimum delay between reconnection attempts
const RECONNECT_COOLDOWN_MS = 10_000;

let client: any;
let quoteSession: any;
let lastDataReceived = Date.now();
let reconnecting = false;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

const marketListeners = new Map<string, any>();
const quotes = new Map<string, TradingViewQuote>();
const pendingResolvers = new Map<string, Array<() => void>>();
const subscribedSymbols = new Set<string>();

function log(message: string) {
  console.log(`[TradingView] ${message}`);
}

function createClient() {
  client = new TradingView.Client({ server: 'widgetdata' });
  quoteSession = new client.Session.Quote({
    customFields: ['lp', 'bid', 'ask', 'prev_close_price', 'chp', 'current_session'],
  });
  lastDataReceived = Date.now();
  log('Client created');
}

function handleQuoteData(symbol: string, data: any) {
  const prevClose = Number(data.prev_close_price || 0);
  const price = Number(data.lp || data.bid || data.ask || prevClose || 0);
  if (!price) return;

  lastDataReceived = Date.now();

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
}

function ensureMarket(symbol: string) {
  subscribedSymbols.add(symbol);
  if (marketListeners.has(symbol)) return;

  const market = new quoteSession.Market(symbol);
  market.onData((data: any) => handleQuoteData(symbol, data));

  if (typeof market.onError === 'function') {
    market.onError((...err: unknown[]) => {
      log(`Market error for ${symbol}: ${err.map(String).join(' ')}`);
    });
  }

  marketListeners.set(symbol, market);
}

async function reconnect() {
  if (reconnecting) return;
  reconnecting = true;
  log('Reconnecting — clearing old session');

  // Tear down old listeners and client
  marketListeners.clear();

  try {
    if (client && typeof client.end === 'function') {
      client.end();
    }
  } catch {
    // ignore teardown errors
  }

  // Create fresh client
  createClient();

  // Re-subscribe all previously tracked symbols
  for (const symbol of subscribedSymbols) {
    ensureMarket(symbol);
  }

  log(`Reconnected — re-subscribed ${subscribedSymbols.size} symbols`);
  reconnecting = false;
}

function checkStreamHealth() {
  if (reconnecting) return;
  if (subscribedSymbols.size === 0) return;

  const staleDuration = Date.now() - lastDataReceived;
  if (staleDuration > STREAM_STALE_MS) {
    log(`Stream stale for ${Math.round(staleDuration / 1000)}s — triggering reconnect`);
    reconnect();
  }
}

// Initialize
createClient();
healthCheckTimer = setInterval(checkStreamHealth, HEALTH_CHECK_INTERVAL_MS);

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

export function getQuoteStreamStatus() {
  const now = Date.now();
  const staleDuration = now - lastDataReceived;
  return {
    subscribedSymbols: subscribedSymbols.size,
    cachedQuotes: quotes.size,
    lastDataReceivedAgo: Math.round(staleDuration / 1000),
    isStale: staleDuration > STREAM_STALE_MS,
    reconnecting,
  };
}

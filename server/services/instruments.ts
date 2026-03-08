export type AssetClass = 'fx' | 'crypto' | 'rate' | 'index' | 'commodity';
export type SignalSource = 'tradingview';

export interface MarketInstrument {
  id: string;
  assetClass: AssetClass;
  displayName: string;
  tvSymbol: string;
  signalSource: SignalSource;
  realtimeEligible: boolean;
  session: '24x5' | '24x7' | 'market-hours';
  pipMultiplier?: number;
  invertHeatmap?: boolean;
  tags?: string[];
}

// Tracked universe: only instruments we can source as non-delayed from TradingView-backed feeds.
export const MARKET_INSTRUMENTS: MarketInstrument[] = [
  { id: 'EURUSD', assetClass: 'fx', displayName: 'EUR/USD', tvSymbol: 'OANDA:EURUSD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'GBPUSD', assetClass: 'fx', displayName: 'GBP/USD', tvSymbol: 'OANDA:GBPUSD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'USDJPY', assetClass: 'fx', displayName: 'USD/JPY', tvSymbol: 'OANDA:USDJPY', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 100, tags: ['usd'] },
  { id: 'AUDUSD', assetClass: 'fx', displayName: 'AUD/USD', tvSymbol: 'OANDA:AUDUSD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'NZDUSD', assetClass: 'fx', displayName: 'NZD/USD', tvSymbol: 'OANDA:NZDUSD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'USDCAD', assetClass: 'fx', displayName: 'USD/CAD', tvSymbol: 'OANDA:USDCAD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'USDCHF', assetClass: 'fx', displayName: 'USD/CHF', tvSymbol: 'OANDA:USDCHF', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'USDSEK', assetClass: 'fx', displayName: 'USD/SEK', tvSymbol: 'OANDA:USDSEK', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'USDNOK', assetClass: 'fx', displayName: 'USD/NOK', tvSymbol: 'OANDA:USDNOK', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000, tags: ['usd'] },
  { id: 'EURGBP', assetClass: 'fx', displayName: 'EUR/GBP', tvSymbol: 'OANDA:EURGBP', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000 },
  { id: 'EURJPY', assetClass: 'fx', displayName: 'EUR/JPY', tvSymbol: 'OANDA:EURJPY', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 100 },
  { id: 'GBPJPY', assetClass: 'fx', displayName: 'GBP/JPY', tvSymbol: 'OANDA:GBPJPY', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 100 },
  { id: 'EURCHF', assetClass: 'fx', displayName: 'EUR/CHF', tvSymbol: 'OANDA:EURCHF', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000 },
  { id: 'AUDNZD', assetClass: 'fx', displayName: 'AUD/NZD', tvSymbol: 'OANDA:AUDNZD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000 },
  { id: 'EURAUD', assetClass: 'fx', displayName: 'EUR/AUD', tvSymbol: 'OANDA:EURAUD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000 },
  { id: 'GBPCHF', assetClass: 'fx', displayName: 'GBP/CHF', tvSymbol: 'OANDA:GBPCHF', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 10000 },
  { id: 'CADJPY', assetClass: 'fx', displayName: 'CAD/JPY', tvSymbol: 'OANDA:CADJPY', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 100 },
  { id: 'AUDJPY', assetClass: 'fx', displayName: 'AUD/JPY', tvSymbol: 'OANDA:AUDJPY', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 100 },
  { id: 'NZDJPY', assetClass: 'fx', displayName: 'NZD/JPY', tvSymbol: 'OANDA:NZDJPY', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', pipMultiplier: 100 },
  { id: 'BTCUSDT', assetClass: 'crypto', displayName: 'BTC/USD', tvSymbol: 'BINANCE:BTCUSDT', signalSource: 'tradingview', realtimeEligible: true, session: '24x7', tags: ['crypto'] },
  { id: 'ETHUSDT', assetClass: 'crypto', displayName: 'ETH/USD', tvSymbol: 'BINANCE:ETHUSDT', signalSource: 'tradingview', realtimeEligible: true, session: '24x7', tags: ['crypto'] },
  { id: 'SOLUSDT', assetClass: 'crypto', displayName: 'SOL/USD', tvSymbol: 'BINANCE:SOLUSDT', signalSource: 'tradingview', realtimeEligible: true, session: '24x7', tags: ['crypto'] },
  { id: 'XRPUSDT', assetClass: 'crypto', displayName: 'XRP/USD', tvSymbol: 'BINANCE:XRPUSDT', signalSource: 'tradingview', realtimeEligible: true, session: '24x7', tags: ['crypto'] },
  { id: 'US02Y', assetClass: 'rate', displayName: 'UST 2Y', tvSymbol: 'TVC:US02Y', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['rate', 'usd'] },
  { id: 'US10Y', assetClass: 'rate', displayName: 'UST 10Y', tvSymbol: 'TVC:US10Y', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['rate', 'usd'] },
  { id: 'DE10Y', assetClass: 'rate', displayName: 'Bund 10Y', tvSymbol: 'TVC:DE10Y', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['rate', 'europe'] },
  { id: 'DXY', assetClass: 'index', displayName: 'DXY', tvSymbol: 'TVC:DXY', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['usd'] },
  { id: 'VIX', assetClass: 'index', displayName: 'VIX', tvSymbol: 'TVC:VIX', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['volatility', 'risk'] },
  { id: 'SPX', assetClass: 'index', displayName: 'S&P 500', tvSymbol: 'TVC:SPX', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['risk', 'us'] },
  { id: 'NDX', assetClass: 'index', displayName: 'Nasdaq 100', tvSymbol: 'TVC:NDX', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['risk', 'us'] },
  { id: 'DJI', assetClass: 'index', displayName: 'Dow Jones', tvSymbol: 'TVC:DJI', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['risk', 'us'] },
  { id: 'IXIC', assetClass: 'index', displayName: 'Nasdaq Composite', tvSymbol: 'TVC:IXIC', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['risk', 'us'] },
  { id: 'DAX', assetClass: 'index', displayName: 'DAX', tvSymbol: 'TVC:DAX', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['risk', 'europe'] },
  { id: 'UKX', assetClass: 'index', displayName: 'FTSE 100', tvSymbol: 'TVC:UKX', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['risk', 'europe'] },
  { id: 'NIKKEI', assetClass: 'index', displayName: 'Nikkei 225', tvSymbol: 'TVC:NI225', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['asia', 'risk'] },
  { id: 'HSI', assetClass: 'index', displayName: 'Hang Seng', tvSymbol: 'TVC:HSI', signalSource: 'tradingview', realtimeEligible: true, session: 'market-hours', tags: ['asia', 'china', 'risk'] },
  { id: 'XAUUSD', assetClass: 'commodity', displayName: 'Gold', tvSymbol: 'TVC:GOLD', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', tags: ['commodity', 'safe-haven'] },
  { id: 'WTI', assetClass: 'commodity', displayName: 'WTI', tvSymbol: 'TVC:USOIL', signalSource: 'tradingview', realtimeEligible: true, session: '24x5', tags: ['commodity', 'energy'] },
];

export const G10_FX_INSTRUMENT_IDS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'NZDUSD',
  'USDCAD',
  'USDCHF',
  'USDSEK',
  'USDNOK',
  'EURGBP',
  'EURJPY',
  'GBPJPY',
  'EURCHF',
  'AUDNZD',
  'EURAUD',
  'GBPCHF',
  'CADJPY',
  'AUDJPY',
  'NZDJPY',
] as const;

export const HEATMAP_INSTRUMENTS = [
  { currency: 'EUR', id: 'EURUSD', invert: false },
  { currency: 'GBP', id: 'GBPUSD', invert: false },
  { currency: 'JPY', id: 'USDJPY', invert: true },
  { currency: 'CHF', id: 'USDCHF', invert: true },
  { currency: 'AUD', id: 'AUDUSD', invert: false },
  { currency: 'CAD', id: 'USDCAD', invert: true },
  { currency: 'NZD', id: 'NZDUSD', invert: false },
  { currency: 'SEK', id: 'USDSEK', invert: true },
  { currency: 'NOK', id: 'USDNOK', invert: true },
] as const;

export function getInstrument(id: string): MarketInstrument | undefined {
  return MARKET_INSTRUMENTS.find(instrument => instrument.id === id);
}

export function getRealtimeInstruments(): MarketInstrument[] {
  return MARKET_INSTRUMENTS.filter(instrument => instrument.realtimeEligible);
}

export function getG10FXInstruments(): MarketInstrument[] {
  return G10_FX_INSTRUMENT_IDS
    .map(id => getInstrument(id))
    .filter((instrument): instrument is MarketInstrument => !!instrument);
}

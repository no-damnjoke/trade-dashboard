export interface PredictionMarket {
  id: string;
  question: string;
  outcomePrices: number[];
  volume24h: number;
  liquidity: number;
  endDate: string;
  image: string;
  slug: string;
  tags: string[];
  volumeSpike?: boolean;
  yesPct: number;
  delta1h: number | null;
  delta24h: number | null;
  // kept for downstream consumers (opportunities, aiAgents)
  side?: 'YES' | 'NO' | 'unknown';
  estimatedSizeUsd?: number;
}

interface PriceSnapshot {
  yesPct: number;
  timestamp: number;
}

const RELEVANT_KEYWORDS = [
  'fed', 'interest rate', 'inflation', 'cpi', 'gdp', 'recession',
  'tariff', 'trump', 'biden', 'election', 'president', 'congress',
  'war', 'ukraine', 'russia', 'china', 'taiwan', 'nato',
  'oil', 'opec', 'bitcoin', 'crypto', 'stock', 'market',
  'default', 'debt ceiling', 'government shutdown', 'sanctions',
  'central bank', 'ecb', 'boj', 'boe', 'rba', 'snb',
  'employment', 'jobs', 'unemployment', 'nonfarm',
  'trade', 'deficit', 'surplus', 'treasury',
  'iran', 'israel', 'middle east', 'korea', 'india',
  'currency', 'dollar', 'euro', 'pound', 'yen', 'nikkei', 'kospi',
];

const SPORTS_EXCLUSION = [
  'nba', 'nfl', 'mlb', 'nhl', 'premier league', 'la liga', 'champions league',
  'serie a', 'bundesliga', 'ligue 1', 'world cup', 'super bowl', 'playoffs',
  'finals', 'mvp', 'touchdown', 'home run', 'ufc', 'boxing', 'tennis',
  'grand slam', 'formula 1', 'f1', 'nascar', 'copa', 'eredivisie',
];

const priceHistory = new Map<string, PriceSnapshot[]>();
const volumeHistory = new Map<string, number[]>();
let cachedMarkets: PredictionMarket[] = [];

const MAX_HISTORY_POINTS = 750; // ~25 hours at 2-min intervals

function isRelevant(question: string): boolean {
  const lower = question.toLowerCase();
  if (SPORTS_EXCLUSION.some(keyword => lower.includes(keyword))) return false;
  return RELEVANT_KEYWORDS.some(keyword => lower.includes(keyword));
}

function marketTags(question: string): string[] {
  const lower = question.toLowerCase();
  return RELEVANT_KEYWORDS.filter(keyword => lower.includes(keyword)).slice(0, 6);
}

function safeJsonParse(input: string, fallback: string[] = ['0', '0']): number[] {
  try {
    return JSON.parse(input).map((value: string) => parseFloat(value) || 0);
  } catch {
    return fallback.map(value => parseFloat(value));
  }
}

function recordPrice(id: string, yesPct: number): void {
  const history = priceHistory.get(id) ?? [];
  history.push({ yesPct, timestamp: Date.now() });
  if (history.length > MAX_HISTORY_POINTS) {
    history.splice(0, history.length - MAX_HISTORY_POINTS);
  }
  priceHistory.set(id, history);
}

function computeDelta(id: string, windowMs: number): number | null {
  const history = priceHistory.get(id);
  if (!history || history.length < 2) return null;

  const cutoff = Date.now() - windowMs;
  // find the oldest snapshot within the window
  let oldest: PriceSnapshot | null = null;
  for (const snap of history) {
    if (snap.timestamp <= cutoff) {
      oldest = snap;
    } else {
      break;
    }
  }
  // if no snapshot before the cutoff, use the earliest available
  if (!oldest) oldest = history[0];

  const latest = history[history.length - 1];
  if (oldest.timestamp === latest.timestamp) return null;
  return latest.yesPct - oldest.yesPct;
}

function detectVolumeSurge(id: string, volume: number): boolean {
  const history = volumeHistory.get(id) ?? [];
  history.push(volume);
  if (history.length > 10) history.shift();
  volumeHistory.set(id, history);
  if (history.length < 3) return false;

  const average = history.slice(0, -1).reduce((sum, value) => sum + value, 0) / (history.length - 1);
  return average > 0 && volume / average > 3;
}

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
}

function enrichMarket(market: any): PredictionMarket {
  const prices = safeJsonParse(market.outcomePrices);
  const yesPrice = prices[0] || 0;
  const yesPct = Math.round(yesPrice * 1000) / 10; // e.g. 99.5
  const volume24h = Number(market.volume24hr || 0);
  const liquidity = parseFloat(market.liquidity || '0') || 0;

  recordPrice(market.id, yesPct);

  const delta1h = computeDelta(market.id, 60 * 60_000);
  const delta24h = computeDelta(market.id, 24 * 60 * 60_000);
  const volumeSpike = detectVolumeSurge(market.id, volume24h);

  // simple side/size inference for downstream consumers
  const side: PredictionMarket['side'] = yesPrice >= 0.5 ? 'YES' : 'NO';
  const estimatedSizeUsd = Math.max(liquidity * 0.2, volume24h * 0.15);

  return {
    id: market.id,
    question: market.question,
    outcomePrices: prices,
    volume24h,
    liquidity,
    endDate: market.endDate || '',
    image: market.image || '',
    slug: market.slug || '',
    tags: marketTags(market.question),
    volumeSpike,
    yesPct,
    delta1h,
    delta24h,
    side,
    estimatedSizeUsd,
  };
}

export async function fetchPredictions(): Promise<PredictionMarket[]> {
  try {
    const data = await fetchJSON('https://gamma-api.polymarket.com/markets?closed=false&limit=80&order=volume24hr&ascending=false');
    const relevant = data.filter((market: any) => market.outcomePrices && isRelevant(market.question)).slice(0, 20);
    const enriched = relevant.map(enrichMarket);

    // sort by biggest absolute probability shift (24h), then volume
    cachedMarkets = enriched
      .sort((a: PredictionMarket, b: PredictionMarket) => {
        const aDelta = Math.abs(a.delta24h ?? 0);
        const bDelta = Math.abs(b.delta24h ?? 0);
        if (aDelta !== bDelta) return bDelta - aDelta;
        return b.volume24h - a.volume24h;
      })
      .slice(0, 12);

    return cachedMarkets;
  } catch (error) {
    console.error('[Polymarket]', (error as Error).message);
    return cachedMarkets;
  }
}

export function getWhaleSnapshot(): PredictionMarket[] {
  return cachedMarkets;
}

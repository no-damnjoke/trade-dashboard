export interface WhaleProfile {
  wallet: string;
  label: string;
  classification: 'proven_trader_building' | 'large_anonymous_position';
  reputationScore: number;
  convictionScore: number;
  impactScore: number;
  pnl?: number;
  size?: number;
  reason: string;
}

export interface WhaleSignal {
  type: 'proven_trader_building' | 'large_anonymous_position' | 'price_dislocation';
  description: string;
  magnitude: number;
  timestamp: number;
}

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
  whaleActivity?: WhaleSignal[];
  whaleProfiles?: WhaleProfile[];
  confidenceLabel?: string;
  side?: 'YES' | 'NO' | 'unknown';
  estimatedSizeUsd?: number;
  avgEntryPrice?: number | null;
  currentMark?: number;
  markMove?: number | null;
  unrealizedPnlProxy?: number | null;
  confidenceInEstimate?: 'high' | 'medium' | 'low';
  estimationNotes?: string;
}

interface HolderEntry {
  proxyWallet: string;
  amount: number;
  outcomeIndex: number;
  name?: string;
  pseudonym?: string;
  verified?: boolean;
}

interface PositionEntry {
  proxyWallet: string;
  name?: string;
  profileImage?: string;
  verified?: boolean;
  avgPrice?: number;
  size?: number;
  currPrice?: number;
  currentValue?: number;
  cashPnl?: number;
  realizedPnl?: number;
  totalPnl?: number;
  outcome?: string;
  outcomeIndex?: number;
}

interface TradeEntry {
  proxyWallet?: string;
  side?: 'BUY' | 'SELL' | string;
  size?: number;
  price?: number;
  timestamp?: number;
  outcome?: string;
  outcomeIndex?: number;
  name?: string;
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

const prevPrices = new Map<string, { price: number; timestamp: number }>();
const volumeHistory = new Map<string, number[]>();
let whaleSnapshot: PredictionMarket[] = [];

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

function detectProbabilityJump(id: string, currentPrice: number): WhaleSignal | null {
  const prev = prevPrices.get(id);
  const now = Date.now();
  prevPrices.set(id, { price: currentPrice, timestamp: now });
  if (!prev) return null;

  const minutes = (now - prev.timestamp) / 60_000;
  const delta = Math.abs(currentPrice - prev.price);
  if (minutes < 1) return null;

  if ((delta > 0.07 && minutes < 30) || (delta > 0.12 && minutes < 120)) {
    return {
      type: 'price_dislocation',
      description: `${(delta * 100).toFixed(0)}pt move in ${minutes.toFixed(0)}m`,
      magnitude: Math.min(delta / 0.2, 1),
      timestamp: now,
    };
  }

  return null;
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

async function fetchHolders(conditionId: string): Promise<HolderEntry[]> {
  try {
    const data = await fetchJSON(`https://data-api.polymarket.com/holders?market=${conditionId}`);
    return Array.isArray(data)
      ? data.flatMap((group: any) =>
          Array.isArray(group.holders)
            ? group.holders.map((holder: any) => ({
                proxyWallet: holder.proxyWallet,
                amount: Number(holder.amount || 0),
                outcomeIndex: Number(holder.outcomeIndex || 0),
                name: holder.name,
                pseudonym: holder.pseudonym,
                verified: !!holder.verified,
              }))
            : []
        )
      : [];
  } catch {
    return [];
  }
}

async function fetchPositions(conditionId: string): Promise<PositionEntry[]> {
  try {
    const data = await fetchJSON(`https://data-api.polymarket.com/v1/market-positions?market=${conditionId}&limit=40&sortBy=TOKENS`);
    return Array.isArray(data)
      ? data.flatMap((group: any) =>
          Array.isArray(group.positions)
            ? group.positions.map((position: any) => ({
                proxyWallet: position.proxyWallet,
                name: position.name,
                profileImage: position.profileImage,
                verified: !!position.verified,
                avgPrice: Number(position.avgPrice || 0),
                size: Number(position.size || 0),
                currPrice: Number(position.currPrice || 0),
                currentValue: Number(position.currentValue || 0),
                cashPnl: Number(position.cashPnl || 0),
                realizedPnl: Number(position.realizedPnl || 0),
                totalPnl: Number(position.totalPnl || 0),
                outcome: position.outcome,
                outcomeIndex: Number(position.outcomeIndex || 0),
              }))
            : []
        )
      : [];
  } catch {
    return [];
  }
}

async function fetchRecentTrades(conditionId: string): Promise<TradeEntry[]> {
  try {
    const data = await fetchJSON(`https://data-api.polymarket.com/trades?market=${conditionId}`);
    return Array.isArray(data)
      ? data.slice(0, 50).map((trade: any) => ({
          proxyWallet: trade.proxyWallet,
          side: trade.side,
          size: Number(trade.size || 0),
          price: Number(trade.price || 0),
          timestamp: Number(trade.timestamp || 0),
          outcome: trade.outcome,
          outcomeIndex: Number(trade.outcomeIndex || 0),
          name: trade.name,
        }))
      : [];
  } catch {
    return [];
  }
}

async function fetchLeaderboard(wallet: string): Promise<{ percentile?: number } | null> {
  try {
    const data = await fetchJSON(`https://lb-api.polymarket.com/rank?address=${wallet}`);
    return data || null;
  } catch {
    return null;
  }
}

function toSide(outcome?: string): 'YES' | 'NO' | 'unknown' {
  if (!outcome) return 'unknown';
  if (outcome.toLowerCase() === 'yes') return 'YES';
  if (outcome.toLowerCase() === 'no') return 'NO';
  return 'unknown';
}

function buildAnonymousPosition(
  prices: number[],
  liquidity: number,
  volume24h: number,
  trades: TradeEntry[],
): Pick<PredictionMarket, 'side' | 'estimatedSizeUsd' | 'avgEntryPrice' | 'currentMark' | 'markMove' | 'unrealizedPnlProxy' | 'confidenceInEstimate' | 'estimationNotes'> {
  const latestTrade = trades[0];
  const side = latestTrade?.outcome ? toSide(latestTrade.outcome) : (prices[0] >= 0.5 ? 'YES' : 'NO');
  const currentMark = side === 'NO' ? (prices[1] || 1 - (prices[0] || 0)) : (prices[0] || 0);
  const avgEntryPrice = latestTrade?.price || null;
  const estimatedSizeUsd = Math.max(liquidity * 0.2, volume24h * 0.15);
  const markMove = avgEntryPrice != null ? currentMark - avgEntryPrice : null;
  const unrealizedPnlProxy = markMove != null ? markMove * estimatedSizeUsd : null;
  return {
    side,
    estimatedSizeUsd,
    avgEntryPrice,
    currentMark,
    markMove,
    unrealizedPnlProxy,
    confidenceInEstimate: avgEntryPrice != null ? 'medium' : 'low',
    estimationNotes: avgEntryPrice != null
      ? 'Aggregate anonymous flow inferred from recent public trade prints.'
      : 'Aggregate anonymous flow inferred from market liquidity and recent turnover; entry is partial.',
  };
}

function scoreWhale(
  position: PositionEntry | null,
  holder: HolderEntry | null,
  leaderboard: { percentile?: number } | null,
  market: { liquidity: number; volume24h: number },
  recentTrades: TradeEntry[],
): WhaleProfile {
  const wallet = position?.proxyWallet || holder?.proxyWallet || 'anonymous-flow';
  const size = Number(position?.currentValue || position?.size || holder?.amount || 0);
  const percentile = Number(leaderboard?.percentile || 0);
  const totalPnl = Number(position?.totalPnl || 0);
  const participation = market.liquidity > 0 ? size / market.liquidity : 0;
  const freshTradeCount = recentTrades.filter(trade => (trade.proxyWallet || '').toLowerCase() === wallet.toLowerCase()).length;

  const reputationScore = Math.max(0, Math.min(100, percentile > 0 ? 100 - percentile : totalPnl > 0 ? 70 : 35));
  const convictionScore = Math.max(0, Math.min(100, participation * 100 + freshTradeCount * 8));
  const impactScore = Math.max(0, Math.min(100, market.volume24h > 0 ? (size / market.volume24h) * 100 : 0));
  const classification: WhaleProfile['classification'] = reputationScore >= 65 ? 'proven_trader_building' : 'large_anonymous_position';

  return {
    wallet,
    label: classification === 'proven_trader_building'
      ? `Proven trader ${(position?.name || holder?.name || wallet).slice(0, 20)}`
      : wallet === 'anonymous-flow'
        ? 'Aggregate anonymous flow'
        : `Anon wallet ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
    classification,
    reputationScore: Math.round(reputationScore),
    convictionScore: Math.round(convictionScore),
    impactScore: Math.round(impactScore),
    pnl: totalPnl || undefined,
    size: size || undefined,
    reason: classification === 'proven_trader_building'
      ? `public position ${Math.round(size).toLocaleString()} with track record context`
      : `position ${Math.round(size).toLocaleString()} versus liquidity ${Math.round(market.liquidity).toLocaleString()}`,
  };
}

async function enrichMarket(market: any): Promise<PredictionMarket> {
  const prices = safeJsonParse(market.outcomePrices);
  const yesPrice = prices[0] || 0;
  const noPrice = prices[1] || (1 - yesPrice);
  const volume24h = Number(market.volume24hr || 0);
  const liquidity = parseFloat(market.liquidity || '0') || 0;
  const conditionId = market.conditionId || market.id;

  const [holders, positions, recentTrades] = await Promise.all([
    fetchHolders(conditionId),
    fetchPositions(conditionId),
    fetchRecentTrades(conditionId),
  ]);

  const topPosition = positions
    .sort((left, right) => (right.currentValue || right.size || 0) - (left.currentValue || left.size || 0))[0];
  const topHolder = holders
    .sort((left, right) => right.amount - left.amount)[0];

  const leaderboardWallet = topPosition?.proxyWallet || topHolder?.proxyWallet;
  const leaderboard = leaderboardWallet ? await fetchLeaderboard(leaderboardWallet) : null;

  let whaleProfiles: WhaleProfile[] = [];
  if (topPosition?.proxyWallet) {
    whaleProfiles = [scoreWhale(topPosition, null, leaderboard, { liquidity, volume24h }, recentTrades)];
  } else if (topHolder?.proxyWallet) {
    whaleProfiles = [scoreWhale(null, topHolder, leaderboard, { liquidity, volume24h }, recentTrades)];
  }

  let side: PredictionMarket['side'] = 'unknown';
  let estimatedSizeUsd = 0;
  let avgEntryPrice: number | null = null;
  let currentMark = 0;
  let markMove: number | null = null;
  let unrealizedPnlProxy: number | null = null;
  let confidenceInEstimate: PredictionMarket['confidenceInEstimate'] = 'low';
  let estimationNotes = 'Position context unavailable.';

  if (topPosition) {
    side = toSide(topPosition.outcome);
    currentMark = topPosition.currPrice || (side === 'NO' ? noPrice : yesPrice);
    estimatedSizeUsd = topPosition.currentValue || topPosition.size || 0;
    avgEntryPrice = topPosition.avgPrice || null;
    markMove = avgEntryPrice != null ? currentMark - avgEntryPrice : null;
    unrealizedPnlProxy = typeof topPosition.totalPnl === 'number' ? topPosition.totalPnl : (markMove != null ? markMove * estimatedSizeUsd : null);
    confidenceInEstimate = 'high';
    estimationNotes = `Wallet-backed public position from Polymarket Data API (${topPosition.outcome || 'unknown'} side).`;
  } else if (liquidity > 0 && volume24h > liquidity * 0.75) {
    const aggregate = buildAnonymousPosition(prices, liquidity, volume24h, recentTrades);
    side = aggregate.side;
    estimatedSizeUsd = aggregate.estimatedSizeUsd || 0;
    avgEntryPrice = aggregate.avgEntryPrice ?? null;
    currentMark = aggregate.currentMark || 0;
    markMove = aggregate.markMove ?? null;
    unrealizedPnlProxy = aggregate.unrealizedPnlProxy ?? null;
    confidenceInEstimate = aggregate.confidenceInEstimate;
    estimationNotes = aggregate.estimationNotes || estimationNotes;
    whaleProfiles = [
      scoreWhale(null, null, null, { liquidity, volume24h }, recentTrades),
    ];
  }

  const whaleActivity: WhaleSignal[] = [];
  const priceJump = detectProbabilityJump(market.id, yesPrice);
  if (priceJump) whaleActivity.push(priceJump);

  const volumeSpike = detectVolumeSurge(market.id, volume24h);
  if (volumeSpike) {
    whaleActivity.push({
      type: whaleProfiles[0]?.classification || 'large_anonymous_position',
      description: 'volume surge versus trailing average',
      magnitude: 0.7,
      timestamp: Date.now(),
    });
  }

  if (estimatedSizeUsd > 0) {
    whaleActivity.push({
      type: whaleProfiles[0]?.classification || 'large_anonymous_position',
      description: `${side} side | ${Math.round(estimatedSizeUsd).toLocaleString()} USD notional`,
      magnitude: Math.min((estimatedSizeUsd / Math.max(liquidity, 1)) / 2, 1),
      timestamp: Date.now(),
    });
  }

  const confidenceLabel = whaleProfiles[0]
    ? whaleProfiles[0].classification === 'proven_trader_building'
      ? 'Proven Trader Building'
      : 'Aggregate Anonymous Flow'
    : 'Watching';

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
    whaleActivity: whaleActivity.filter((signal, index, list) => {
      for (let j = 0; j < index; j++) {
        if (list[j].type === signal.type && list[j].description === signal.description) return false;
      }
      return true;
    }).slice(0, 4),
    whaleProfiles,
    confidenceLabel,
    side,
    estimatedSizeUsd,
    avgEntryPrice,
    currentMark,
    markMove,
    unrealizedPnlProxy,
    confidenceInEstimate,
    estimationNotes,
  };
}

export async function fetchPredictions(): Promise<PredictionMarket[]> {
  try {
    const data = await fetchJSON('https://gamma-api.polymarket.com/markets?closed=false&limit=80&order=volume24hr&ascending=false');
    const relevant = data.filter((market: any) => market.outcomePrices && isRelevant(market.question)).slice(0, 12);
    const enriched = await Promise.all(relevant.map(enrichMarket));

    whaleSnapshot = enriched
      .filter(market => market.estimatedSizeUsd || (market.whaleActivity?.length || 0) > 0)
      .sort((left, right) => (right.estimatedSizeUsd || 0) - (left.estimatedSizeUsd || 0) || right.volume24h - left.volume24h)
      .slice(0, 10);

    return whaleSnapshot;
  } catch (error) {
    console.error('[Polymarket]', (error as Error).message);
    return whaleSnapshot;
  }
}

export function getWhaleSnapshot(): PredictionMarket[] {
  return whaleSnapshot;
}

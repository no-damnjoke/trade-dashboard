import { Scraper } from '@the-convocation/twitter-scraper';
import { addAlert } from './alertEngine.js';
import { evaluateHeadlineImpact, type HeadlineImpactSnapshot } from './aiAgents.js';
import { getLatestQuotes, getRegimeSnapshot } from './velocityMonitor.js';
import { getWhaleSnapshot } from './polymarket.js';

export interface Headline {
  id: string;
  text: string;
  timestamp: number;
  source: string;
  provider: string;
  classificationMethod: 'deterministic' | 'ai';
  importance: 'critical' | 'high' | 'medium' | 'low';
  marketImpact: 'broad' | 'fx' | 'rates' | 'crypto' | 'asia' | 'commodity' | 'mixed';
  affectedAssets: string[];
  whyItMatters: string;
  actionability: 'actionable' | 'watch' | 'ignore';
  thesisChange?: boolean;
  alertRecommended?: boolean;
  confidence?: number;
  fallbackReason?: string;
  dedupeKey: string;
}

export interface HeadlineProviderStatus {
  id: string;
  label: string;
  state: 'ok' | 'degraded' | 'stale' | 'blocked';
  lastSuccess: number;
  failureReason?: string;
  active: boolean;
}

interface RawHeadline {
  id: string;
  text: string;
  timestamp: number;
  source: string;
  provider: string;
}

interface HeadlineProvider {
  id: string;
  label: string;
  fetchHeadlines: () => Promise<RawHeadline[]>;
  getHealth: () => HeadlineProviderStatus;
}

const TELEGRAM_CHANNEL = process.env.FIRSTSQUAWK_TG_CHANNEL || 'firstsquaw';
const FINNHUB_KEY = process.env.FINNHUB_KEY || '';
const TWITTER_USER = process.env.TWITTER_USER || '';
const TWITTER_PASS = process.env.TWITTER_PASS || '';
const TWITTER_EMAIL = process.env.TWITTER_EMAIL || '';
const TWITTER_AUTH_TOKEN = process.env.TWITTER_AUTH_TOKEN || '';
const TWITTER_CT0 = process.env.TWITTER_CT0 || '';

const providerState = new Map<string, HeadlineProviderStatus>();
const headlineAlertCache = new Map<string, number>();
const headlineAICache = new Map<string, { headline: Headline; expiresAt: number }>();
let scraper: Scraper | null = null;
let scraperReady = false;
let scraperBlocked = false;
let loginAttempts = 0;
let lastBundle: { headlines: Headline[]; activeProvider: string; lastUpdated: number } = {
  headlines: [],
  activeProvider: 'demo',
  lastUpdated: 0,
};

function nowState(id: string, label: string): HeadlineProviderStatus {
  return providerState.get(id) ?? {
    id,
    label,
    state: 'stale',
    lastSuccess: 0,
    active: false,
  };
}

function updateProviderState(id: string, label: string, patch: Partial<HeadlineProviderStatus>) {
  providerState.set(id, {
    ...nowState(id, label),
    ...patch,
    id,
    label,
  });
}

function normalizeText(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bRT\b/gi, '')
    .trim();
}

function dedupeKey(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9%/$ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAffectedAssets(text: string): string[] {
  const lower = text.toLowerCase();
  const assets = new Set<string>();
  const rules: Array<[string, string]> = [
    ['usd', 'DXY'],
    ['eur', 'EURUSD'],
    ['gbp', 'GBPUSD'],
    ['jpy', 'USDJPY'],
    ['boj', 'USDJPY'],
    ['ecb', 'EURUSD'],
    ['boe', 'GBPUSD'],
    ['rba', 'AUDUSD'],
    ['rbnz', 'NZDUSD'],
    ['cad', 'USDCAD'],
    ['snb', 'USDCHF'],
    ['gold', 'XAUUSD'],
    ['oil', 'WTI'],
    ['bitcoin', 'BTCUSDT'],
    ['btc', 'BTCUSDT'],
    ['ethereum', 'ETHUSDT'],
    ['eth', 'ETHUSDT'],
    ['nikkei', 'NIKKEI'],
    ['hang seng', 'HSI'],
    ['treasury', 'US10Y'],
    ['yield', 'US10Y'],
  ];

  for (const [needle, asset] of rules) {
    if (lower.includes(needle)) assets.add(asset);
  }

  return Array.from(assets);
}

function classifyHeadline(
  text: string,
  marketContext: ReturnType<typeof getRegimeSnapshot>,
  whaleText: string[],
): Omit<Headline, 'id' | 'text' | 'timestamp' | 'source' | 'provider' | 'dedupeKey'> {
  const lower = text.toLowerCase();
  const affectedAssets = extractAffectedAssets(text);

  let score = 0;
  let marketImpact: Headline['marketImpact'] = 'mixed';
  const reasons: string[] = [];

  const criticalTerms = ['fed', 'fomc', 'boj', 'ecb', 'boe', 'nfp', 'nonfarm', 'cpi', 'inflation', 'payrolls', 'intervention', 'tariff', 'ceasefire', 'opec', 'iran', 'israel', 'strait of hormuz', 'missile', 'drone'];
  const actionTerms = ['unexpected', 'breaking', 'sources', 'emergency', 'cuts', 'hikes', 'raises', 'holds', 'stronger than expected', 'weaker than expected', 'misses', 'beats', 'escort', 'attack', 'sanctions'];
  const asiaTerms = ['nikkei', 'kospi', 'hang seng', 'pboc', 'boj', 'china', 'korea', 'japan'];
  const cryptoTerms = ['bitcoin', 'btc', 'ethereum', 'eth', 'sec', 'etf'];

  if (criticalTerms.some(term => lower.includes(term))) {
    score += 3;
    reasons.push('macro catalyst');
  }

  if (actionTerms.some(term => lower.includes(term))) {
    score += 2;
    reasons.push('surprise language');
  }

  if (affectedAssets.length >= 2) {
    score += 1;
    reasons.push('cross-asset reach');
  }

  if (marketContext.topShock && affectedAssets.includes(marketContext.topShock.pair)) {
    score += 2;
    reasons.push('aligns with active shock');
  }

  if (marketContext.usdBias !== 'mixed' && ['fed', 'treasury', 'yield', 'usd'].some(term => lower.includes(term))) {
    score += 1;
    reasons.push(`current usd regime is ${marketContext.usdBias}`);
  }

  if (whaleText.some(entry => lower.includes(entry))) {
    score += 1;
    reasons.push('prediction market attention');
  }

  if (['iran', 'israel', 'strait of hormuz', 'opec', 'oil', 'gulf'].some(term => lower.includes(term))) {
    score += 2;
    reasons.push('energy and geopolitical spillover');
  }

  if (asiaTerms.some(term => lower.includes(term))) {
    marketImpact = 'asia';
  } else if (cryptoTerms.some(term => lower.includes(term))) {
    marketImpact = 'crypto';
  } else if (['yield', 'treasury', 'bond', 'rates'].some(term => lower.includes(term))) {
    marketImpact = 'rates';
  } else if (['eur', 'gbp', 'jpy', 'fx', 'usd', 'ecb', 'boj', 'boe', 'rba', 'snb'].some(term => lower.includes(term))) {
    marketImpact = 'fx';
  } else if (['gold', 'oil', 'opec'].some(term => lower.includes(term))) {
    marketImpact = 'commodity';
  } else if (['fed', 'inflation', 'cpi', 'payrolls', 'war', 'tariff'].some(term => lower.includes(term))) {
    marketImpact = 'broad';
  }

  const importance: Headline['importance'] = score >= 6 ? 'critical' : score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  const actionability: Headline['actionability'] = importance === 'critical' || importance === 'high'
    ? 'actionable'
    : importance === 'medium'
      ? 'watch'
      : 'ignore';

  return {
    classificationMethod: 'deterministic',
    importance,
    marketImpact,
    affectedAssets,
    whyItMatters: reasons.length > 0 ? reasons.join(' | ') : 'context light',
    actionability,
  };
}

function buildHeadlineImpactSnapshot(
  headline: Headline,
  deterministic: Omit<Headline, 'id' | 'text' | 'timestamp' | 'source' | 'provider' | 'dedupeKey'>,
  relatedHeadlines: Headline[],
  marketContext: ReturnType<typeof getRegimeSnapshot>,
): HeadlineImpactSnapshot {
  const quotes = new Map(getLatestQuotes().map(quote => [quote.instrumentId, quote]));

  return {
    schemaVersion: 'headline-impact.v1',
    generatedAt: Date.now(),
    freshness: {
      headlineAgeMs: Date.now() - headline.timestamp,
      marketStateAgeMs: Date.now() - marketContext.updatedAt,
    },
    confidenceInputs: {
      relatedHeadlineCount: relatedHeadlines.length,
      signalCount: marketContext.topShock ? 1 : 0,
      regimeBias: marketContext.usdBias,
    },
    provenance: {
      source: headline.source,
      provider: headline.provider,
    },
    headline: {
      id: headline.id,
      text: headline.text,
      timestamp: headline.timestamp,
      deterministic,
    },
    relatedHeadlines: relatedHeadlines.map(item => ({
      text: item.text,
      importance: item.importance,
      timestamp: item.timestamp,
    })),
    activeSignals: marketContext.topShock ? [{
      pair: marketContext.topShock.pair,
      displayName: marketContext.topShock.displayName,
      assetClass: marketContext.topShock.assetClass,
      zScore: marketContext.topShock.zScore,
      direction: marketContext.topShock.direction,
    }] : [],
    regime: {
      usdBias: marketContext.usdBias,
      usdBreadth: marketContext.usdBreadth,
      leadPair: marketContext.topShock?.pair ?? null,
    },
    affectedQuotes: deterministic.affectedAssets.slice(0, 5).map(asset => ({
      instrument: asset,
      displayName: asset,
      currentPrice: quotes.get(asset)?.price ?? 0,
    })),
  };
}

function trimAICommentary(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) return normalized;
  const cut = normalized.slice(0, 220);
  const lastBoundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf(', '));
  if (lastBoundary >= 110) {
    return `${cut.slice(0, lastBoundary + 1).trim()}...`;
  }
  return `${cut.trim()}...`;
}

function shouldUseHeadlineAI(
  headline: Headline,
  deterministic: Omit<Headline, 'id' | 'text' | 'timestamp' | 'source' | 'provider' | 'dedupeKey'>,
  relatedHeadlines: Headline[],
  marketContext: ReturnType<typeof getRegimeSnapshot>,
) {
  if (headline.timestamp < Date.now() - 90 * 60_000) return false;
  if (deterministic.importance === 'critical' || deterministic.importance === 'high') return true;
  if (deterministic.actionability === 'actionable') return true;
  if (relatedHeadlines.length >= 2) return true;
  if (deterministic.affectedAssets.length > 0 && marketContext.topShock) return true;
  if (deterministic.marketImpact === 'broad' || deterministic.marketImpact === 'commodity') return true;
  return false;
}

async function enhanceWithAI(
  headline: Headline,
  deterministic: Omit<Headline, 'id' | 'text' | 'timestamp' | 'source' | 'provider' | 'dedupeKey'>,
  relatedHeadlines: Headline[],
  marketContext: ReturnType<typeof getRegimeSnapshot>,
): Promise<Headline> {
  const previous = lastBundle.headlines.find(item => item.dedupeKey === headline.dedupeKey);
  if (previous) {
    return {
      ...previous,
      id: headline.id,
      text: headline.text,
      timestamp: headline.timestamp,
      source: headline.source,
      provider: headline.provider,
      dedupeKey: headline.dedupeKey,
    };
  }

  const cached = headlineAICache.get(headline.dedupeKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.headline,
      id: headline.id,
      text: headline.text,
      timestamp: headline.timestamp,
      source: headline.source,
      provider: headline.provider,
      dedupeKey: headline.dedupeKey,
    };
  }

  if (!shouldUseHeadlineAI(headline, deterministic, relatedHeadlines, marketContext)) {
    return {
      ...headline,
      thesisChange: false,
      alertRecommended: headline.actionability === 'actionable',
      confidence: 0,
      fallbackReason: undefined,
    };
  }

  const snapshot = buildHeadlineImpactSnapshot(headline, deterministic, relatedHeadlines, marketContext);
  const result = await evaluateHeadlineImpact(snapshot);
  const minConfidence = Number(process.env.AI_HEADLINE_MIN_CONFIDENCE || 60);

  if (!result.ok || !result.data || result.data.confidence < minConfidence) {
    return {
      ...headline,
      thesisChange: false,
      alertRecommended: headline.actionability === 'actionable',
      confidence: headline.confidence ?? 0,
      fallbackReason: result.error || 'headline ai unavailable',
    };
  }

  const enhanced: Headline = {
    ...headline,
    importance: result.data.importance,
    actionability: result.data.actionability,
    marketImpact: result.data.marketImpact,
    affectedAssets: result.data.affectedAssets,
    whyItMatters: trimAICommentary(result.data.whyItMatters),
    classificationMethod: 'ai',
    thesisChange: result.data.thesisChange,
    alertRecommended: result.data.alertRecommended,
    confidence: result.data.confidence,
    fallbackReason: undefined,
  };

  headlineAICache.set(headline.dedupeKey, {
    headline: enhanced,
    expiresAt: Date.now() + 15 * 60_000,
  });

  return enhanced;
}

function getDemoHeadlines(): RawHeadline[] {
  const now = Date.now();
  const headlines = [
    { text: 'FED\'S WALLER: I SUPPORT HOLDING RATES STEADY AT MARCH MEETING', mins: 2 },
    { text: 'US 10Y YIELD RISES TO 4.15%, HIGHEST IN TWO WEEKS', mins: 5 },
    { text: 'ECB\'S LAGARDE: INFLATION PATH REMAINS BUMPY, DATA-DEPENDENT APPROACH ESSENTIAL', mins: 8 },
    { text: 'PBOC SETS USD/CNY MIDPOINT AT 7.1692, STRONGER THAN EXPECTED', mins: 12 },
    { text: 'BOJ DEPUTY GOV UCHIDA: WILL RAISE RATES IF ECONOMY IMPROVES AS PROJECTED', mins: 15 },
    { text: 'US INITIAL JOBLESS CLAIMS 217K VS 215K EXPECTED', mins: 18 },
    { text: 'OPEC+ CONSIDERING ACCELERATING OIL OUTPUT INCREASES - SOURCES', mins: 22 },
    { text: 'BOE\'S BAILEY: WE ARE ON A GRADUAL PATH OF REMOVING MONETARY POLICY RESTRICTION', mins: 25 },
    { text: 'GOLD HITS NEW ALL-TIME HIGH ABOVE $2,950/OZ', mins: 38 },
    { text: 'USDJPY BREAKS BELOW 149.00, LOWEST SINCE DECEMBER', mins: 42 },
    { text: 'BITCOIN RECLAIMS $90,000 AS RISK APPETITE IMPROVES', mins: 46 },
    { text: 'HANG SENG INDEX OPENS 1.2% HIGHER AFTER STRONGER CHIP EXPORT DATA', mins: 55 },
  ];

  return headlines.map((headline, index) => ({
    id: `demo-${index}`,
    text: headline.text,
    timestamp: now - headline.mins * 60_000,
    source: 'Demo',
    provider: 'demo',
  }));
}

function parseTelegramMessages(html: string): RawHeadline[] {
  const headlines: RawHeadline[] = [];
  const blocks = html.match(/<div class="tgme_widget_message_wrap[\s\S]*?<\/div>\s*<\/div>/g) || [];

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const idMatch = block.match(/data-post="[^/]+\/(\d+)"/);
    const timeMatch = block.match(/datetime="([^"]+)"/);
    const textMatch = block.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    if (!textMatch) continue;

    const text = normalizeText(
      textMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
    );

    if (!text || text.length < 8) continue;

    headlines.push({
      id: `tg-${idMatch?.[1] || index}`,
      text,
      timestamp: timeMatch ? new Date(timeMatch[1]).getTime() : Date.now(),
      source: 'First Squawk',
      provider: 'telegram',
    });
  }

  return headlines.reverse().slice(0, 60);
}

async function fetchTelegramHeadlines(): Promise<RawHeadline[]> {
  const response = await fetch(`https://t.me/s/${TELEGRAM_CHANNEL}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`telegram ${response.status}`);
  }

  const html = await response.text();
  return parseTelegramMessages(html);
}

async function initScraper(): Promise<Scraper | null> {
  if (scraperBlocked) return null;
  if (scraper && scraperReady) return scraper;

  if (TWITTER_AUTH_TOKEN && TWITTER_CT0) {
    try {
      scraper = new Scraper();
      await scraper.setCookies([
        `auth_token=${TWITTER_AUTH_TOKEN}; Domain=.x.com; Path=/; Secure; HttpOnly`,
        `ct0=${TWITTER_CT0}; Domain=.x.com; Path=/; Secure`,
      ]);

      if (await scraper.isLoggedIn()) {
        scraperReady = true;
        return scraper;
      }
    } catch {}
    scraper = null;
  }

  if (TWITTER_USER && TWITTER_PASS && loginAttempts < 2) {
    try {
      loginAttempts++;
      scraper = new Scraper();
      await scraper.login(TWITTER_USER, TWITTER_PASS, TWITTER_EMAIL || undefined);
      scraperReady = true;
      return scraper;
    } catch {
      scraper = null;
    }
  }

  scraperBlocked = true;
  return null;
}

async function fetchTwitterHeadlines(): Promise<RawHeadline[]> {
  const twitter = await initScraper();
  if (!twitter) return [];

  const headlines: RawHeadline[] = [];
  const tweets = twitter.getTweets('FirstSquawk', 30);
  let count = 0;

  for await (const tweet of tweets) {
    if (!tweet.text || count >= 30) continue;

    headlines.push({
      id: tweet.id || `x-${count}`,
      text: normalizeText(tweet.text.replace(/https?:\/\/\S+/g, '')),
      timestamp: tweet.timestamp ? tweet.timestamp * 1000 : Date.now(),
      source: 'First Squawk',
      provider: 'x',
    });
    count++;
  }

  return headlines;
}

async function fetchFinnhubNews(): Promise<RawHeadline[]> {
  if (!FINNHUB_KEY) return [];

  const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
  if (!response.ok) return [];

  const data = await response.json();
  return data.slice(0, 40).map((item: any, index: number) => ({
    id: `fh-${item.id || index}`,
    text: normalizeText(item.headline || item.summary || ''),
    timestamp: (item.datetime || 0) * 1000,
    source: item.source || 'Finnhub',
    provider: 'finnhub',
  }));
}

let _providers: HeadlineProvider[] | null = null;
function buildProviders(): HeadlineProvider[] {
  if (_providers) return _providers;
  _providers = [
    {
      id: 'telegram',
      label: 'First Squawk Telegram',
      fetchHeadlines: async () => {
        const headlines = await fetchTelegramHeadlines();
        updateProviderState('telegram', 'First Squawk Telegram', {
          state: 'ok',
          lastSuccess: Date.now(),
          failureReason: undefined,
        });
        return headlines;
      },
      getHealth: () => nowState('telegram', 'First Squawk Telegram'),
    },
    {
      id: 'x',
      label: 'First Squawk X',
      fetchHeadlines: async () => {
        const headlines = await fetchTwitterHeadlines();
        updateProviderState('x', 'First Squawk X', {
          state: headlines.length > 0 ? 'ok' : 'degraded',
          lastSuccess: headlines.length > 0 ? Date.now() : nowState('x', 'First Squawk X').lastSuccess,
          failureReason: headlines.length > 0 ? undefined : 'x authentication unavailable',
        });
        return headlines;
      },
      getHealth: () => nowState('x', 'First Squawk X'),
    },
    {
      id: 'finnhub',
      label: 'Finnhub News',
      fetchHeadlines: async () => {
        const headlines = await fetchFinnhubNews();
        updateProviderState('finnhub', 'Finnhub News', {
          state: headlines.length > 0 ? 'ok' : 'degraded',
          lastSuccess: headlines.length > 0 ? Date.now() : nowState('finnhub', 'Finnhub News').lastSuccess,
          failureReason: headlines.length > 0 ? undefined : 'finnhub unavailable',
        });
        return headlines;
      },
      getHealth: () => nowState('finnhub', 'Finnhub News'),
    },
    {
      id: 'demo',
      label: 'Demo Headlines',
      fetchHeadlines: async () => {
        const headlines = getDemoHeadlines();
        updateProviderState('demo', 'Demo Headlines', {
          state: 'ok',
          lastSuccess: Date.now(),
          failureReason: undefined,
        });
        return headlines;
      },
      getHealth: () => nowState('demo', 'Demo Headlines'),
    },
  ];
  return _providers;
}

function markActiveProvider(activeId: string) {
  for (const provider of buildProviders()) {
    const current = provider.getHealth();
    updateProviderState(provider.id, provider.label, { ...current, active: provider.id === activeId });
  }
}

function shouldAlert(headline: Headline): boolean {
  const minConfidence = Number(process.env.AI_HEADLINE_ALERT_MIN_CONFIDENCE || 65);
  if (headline.alertRecommended === false) return false;
  if (headline.confidence != null && headline.confidence < minConfidence) return false;
  return headline.actionability === 'actionable' && (headline.importance === 'critical' || headline.importance === 'high');
}

export async function fetchHeadlinesBundle() {
  const providers = buildProviders();
  let rawHeadlines: RawHeadline[] = [];
  let activeProvider = 'demo';

  for (const provider of providers) {
    try {
      const items = await provider.fetchHeadlines();
      if (items.length > 0) {
        rawHeadlines = items;
        activeProvider = provider.id;
        break;
      }

      updateProviderState(provider.id, provider.label, {
        state: provider.id === 'x' ? 'blocked' : 'degraded',
        failureReason: 'no headlines returned',
      });
    } catch (error) {
      updateProviderState(provider.id, provider.label, {
        state: provider.id === 'x' ? 'blocked' : 'degraded',
        failureReason: (error as Error).message,
      });
    }
  }

  markActiveProvider(activeProvider);

  const whaleSnapshot = getWhaleSnapshot();
  const whaleTerms = whaleSnapshot.flatMap(item => [
    item.question.toLowerCase(),
    ...item.tags.map(tag => tag.toLowerCase()),
  ]);
  const marketContext = getRegimeSnapshot();
  const seen = new Set<string>();
  const deduped = rawHeadlines
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter(headline => {
      const key = dedupeKey(headline.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);

  const baseHeadlines = deduped.map(raw => {
    const scored = classifyHeadline(raw.text, marketContext, whaleTerms);
    const headline: Headline = {
      id: raw.id,
      text: raw.text,
      timestamp: raw.timestamp,
      source: raw.source,
      provider: raw.provider,
      dedupeKey: dedupeKey(raw.text),
      ...scored,
    };
    return { headline, deterministic: scored };
  });

  const headlines = await Promise.all(baseHeadlines.map(async ({ headline, deterministic }) => {
    const related = baseHeadlines
      .map(item => item.headline)
      .filter(item => item.id !== headline.id && item.marketImpact === headline.marketImpact)
      .slice(0, 5);
    return enhanceWithAI(headline, deterministic, related, marketContext);
  }));

  const lastUpdated = Date.now();
  lastBundle = { headlines, activeProvider, lastUpdated };

  for (const headline of headlines.slice(0, 10)) {
    if (!shouldAlert(headline)) continue;
    const lastAlerted = headlineAlertCache.get(headline.dedupeKey) || 0;
    if (lastUpdated - lastAlerted < 10 * 60_000) continue;

    headlineAlertCache.set(headline.dedupeKey, lastUpdated);
    addAlert({
      type: 'headline',
      category: headline.marketImpact,
      source: headline.provider,
      assetIds: headline.affectedAssets,
      reason: headline.whyItMatters,
      message: headline.text,
      severity: headline.importance === 'critical' ? 'critical' : 'high',
      suppressed: false,
    });
  }

  return lastBundle;
}

export async function fetchHeadlines(): Promise<Headline[]> {
  const bundle = await fetchHeadlinesBundle();
  return bundle.headlines;
}

export function getHeadlineStatus() {
  return {
    activeProvider: lastBundle.activeProvider,
    lastUpdated: lastBundle.lastUpdated,
    providers: buildProviders().map(provider => provider.getHealth()),
  };
}

export function getCachedHeadlinesBundle() {
  return lastBundle;
}

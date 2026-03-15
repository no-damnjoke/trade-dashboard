/**
 * Context Brief Service
 *
 * Scrapes macro/finance headlines from multiple RSS feeds every 6 hours.
 * Stores a structured context brief that gets injected into AI agent payloads
 * so they have baseline market awareness beyond the Telegram headline feed.
 */

interface ContextHeadline {
  title: string;
  source: string;
  publishedAt: number;
  link: string;
  summary?: string;
}

interface ContextBrief {
  generatedAt: number;
  headlines: ContextHeadline[];
  topThemes: string[];
}

const RSS_FEEDS: Array<{ url: string; source: string }> = [
  // Google News — macro/economy/forex
  { url: 'https://news.google.com/rss/search?q=forex+macro+economy+central+bank&hl=en', source: 'Google News' },
  // Google News — finance topic
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB', source: 'Google Finance' },
  // CNBC World Markets
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC' },
  // MarketWatch Top Stories
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories', source: 'MarketWatch' },
  // WSJ Markets
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ' },
  // Reuters World
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+forex+OR+economy+OR+fed+OR+central+bank&hl=en', source: 'Reuters via Google' },
  // FT via Google
  { url: 'https://news.google.com/rss/search?q=site:ft.com+markets+OR+economy+OR+central+bank&hl=en', source: 'FT via Google' },
  // Nikkei Asia via Google
  { url: 'https://news.google.com/rss/search?q=site:asia.nikkei.com+markets+OR+economy&hl=en', source: 'Nikkei via Google' },
  // 華爾街見聞 via Google
  { url: 'https://news.google.com/rss/search?q=site:wallstreetcn.com&hl=zh-CN', source: '華爾街見聞' },
];

const MACRO_KEYWORDS = [
  'fed', 'fomc', 'rate', 'inflation', 'cpi', 'gdp', 'employment', 'jobs', 'nonfarm',
  'tariff', 'trade', 'treasury', 'yield', 'bond', 'dollar', 'euro', 'yen', 'pound',
  'ecb', 'boj', 'boe', 'rba', 'snb', 'pboc', 'central bank',
  'oil', 'gold', 'commodity', 'opec',
  'recession', 'growth', 'stimulus', 'fiscal',
  'china', 'geopolitical', 'sanctions', 'war',
  'bitcoin', 'crypto',
  'stock', 'equities', 'rally', 'selloff', 'correction',
];

let cachedBrief: ContextBrief = {
  generatedAt: 0,
  headlines: [],
  topThemes: [],
};

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function extractTextFromXML(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'gi');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(decodeEntities((match[1] || match[2] || '').trim()));
  }
  return matches;
}

function extractDateFromXML(xml: string): number {
  const pubDateMatch = xml.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);
  if (pubDateMatch) {
    const d = new Date(pubDateMatch[1].trim());
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const dcDateMatch = xml.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);
  if (dcDateMatch) {
    const d = new Date(dcDateMatch[1].trim());
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return Date.now();
}

function parseRSSItems(xml: string, source: string): ContextHeadline[] {
  const items: ContextHeadline[] = [];
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);

  for (const block of itemBlocks.slice(0, 15)) {
    const titles = extractTextFromXML(block, 'title');
    const links = extractTextFromXML(block, 'link');
    const descriptions = extractTextFromXML(block, 'description');
    const title = titles[0] || '';
    if (!title) continue;

    items.push({
      title: title.replace(/\s+/g, ' ').trim(),
      source,
      publishedAt: extractDateFromXML(block),
      link: links[0] || '',
      summary: descriptions[0]
        ? descriptions[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)
        : undefined,
    });
  }

  return items;
}

function isMacroRelevant(headline: ContextHeadline): boolean {
  const lower = (headline.title + ' ' + (headline.summary || '')).toLowerCase();
  return MACRO_KEYWORDS.some(kw => lower.includes(kw));
}

function dedupeByTitle(headlines: ContextHeadline[]): ContextHeadline[] {
  const seen = new Set<string>();
  return headlines.filter(h => {
    const normalized = h.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    // Use first 8 words as dedup key
    const key = normalized.split(' ').slice(0, 8).join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractThemes(headlines: ContextHeadline[]): string[] {
  const themeCounts = new Map<string, number>();
  const themeKeywords: Record<string, string[]> = {
    'Fed/Rate Policy': ['fed', 'fomc', 'rate cut', 'rate hike', 'rate hold', 'monetary policy'],
    'Inflation': ['inflation', 'cpi', 'pce', 'price pressure', 'disinflation'],
    'Labor Market': ['jobs', 'employment', 'nonfarm', 'payrolls', 'unemployment', 'claims'],
    'Trade/Tariffs': ['tariff', 'trade war', 'trade deal', 'trade deficit'],
    'Geopolitical Risk': ['war', 'conflict', 'sanctions', 'geopolitical', 'iran', 'israel', 'russia', 'ukraine'],
    'China': ['china', 'pboc', 'yuan', 'chinese'],
    'Energy/Commodities': ['oil', 'opec', 'gold', 'commodity', 'natural gas', 'brent'],
    'USD Strength/Weakness': ['dollar', 'dxy', 'usd', 'greenback'],
    'Risk Sentiment': ['rally', 'selloff', 'risk-on', 'risk-off', 'volatility', 'vix'],
    'Crypto': ['bitcoin', 'crypto', 'ethereum', 'btc'],
    'ECB/Europe': ['ecb', 'eurozone', 'euro area', 'lagarde'],
    'BoJ/Japan': ['boj', 'japan', 'yen', 'ueda'],
  };

  for (const h of headlines) {
    const lower = (h.title + ' ' + (h.summary || '')).toLowerCase();
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      }
    }
  }

  return [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
}

async function fetchFeed(feed: { url: string; source: string }): Promise<ContextHeadline[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MarketMonitor/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];
    const xml = await response.text();
    return parseRSSItems(xml, feed.source);
  } catch {
    console.error(`[ContextBrief] Failed to fetch ${feed.source}: ${feed.url}`);
    return [];
  }
}

export async function refreshContextBrief(): Promise<void> {
  console.log('[ContextBrief] Refreshing from RSS feeds...');
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));

  const allHeadlines: ContextHeadline[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allHeadlines.push(...result.value);
    }
  }

  // Filter to macro-relevant, dedupe, sort by recency
  const relevant = dedupeByTitle(allHeadlines.filter(isMacroRelevant))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 40);

  const topThemes = extractThemes(relevant);

  cachedBrief = {
    generatedAt: Date.now(),
    headlines: relevant,
    topThemes,
  };

  console.log(`[ContextBrief] ${relevant.length} headlines from ${RSS_FEEDS.length} feeds. Themes: ${topThemes.join(', ')}`);
}

export function getContextBrief(): ContextBrief {
  return cachedBrief;
}

/**
 * Returns a compact context string suitable for injection into AI agent payloads.
 * Keeps it short to avoid bloating token usage.
 */
export function getContextBriefForAI(): {
  refreshedAt: number;
  topThemes: string[];
  recentHeadlines: Array<{ title: string; source: string }>;
} | null {
  if (cachedBrief.generatedAt === 0) return null;

  return {
    refreshedAt: cachedBrief.generatedAt,
    topThemes: cachedBrief.topThemes,
    recentHeadlines: cachedBrief.headlines
      .slice(0, 15)
      .map(h => ({ title: h.title, source: h.source })),
  };
}

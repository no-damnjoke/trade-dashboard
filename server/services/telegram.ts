export interface Headline {
  id: string;
  text: string;
  timestamp: number;
  source: string;
}

// Primary: Finnhub market news (free, reliable)
// Secondary: Telegram public channel scraping (if channel supports web preview)

const FINNHUB_KEY = process.env.FINNHUB_KEY || '';

export async function fetchHeadlines(): Promise<Headline[]> {
  const results: Headline[] = [];

  // Try Finnhub market news
  const finnhubHeadlines = await fetchFinnhubNews();
  results.push(...finnhubHeadlines);

  // Try Telegram channel scraping (configurable)
  const tgChannel = process.env.TG_CHANNEL;
  if (tgChannel) {
    const tgHeadlines = await fetchTelegramChannel(tgChannel);
    results.push(...tgHeadlines);
  }

  // Sort by timestamp descending
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results.slice(0, 60);
}

async function fetchFinnhubNews(): Promise<Headline[]> {
  if (!FINNHUB_KEY) {
    // Return curated mock headlines for demo
    return getDemoHeadlines();
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    return data.slice(0, 40).map((item: any, i: number) => ({
      id: `fh-${item.id || i}`,
      text: item.headline || item.summary || '',
      timestamp: (item.datetime || 0) * 1000,
      source: item.source || 'Finnhub',
    }));
  } catch {
    return [];
  }
}

async function fetchTelegramChannel(channel: string): Promise<Headline[]> {
  try {
    const url = `https://t.me/s/${channel}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!res.ok) return [];

    const html = await res.text();
    return parseTelegramMessages(html);
  } catch {
    return [];
  }
}

function parseTelegramMessages(html: string): Headline[] {
  const headlines: Headline[] = [];
  const messageRegex = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  const timeRegex = /datetime="([^"]+)"/g;

  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timeRegex.exec(html)) !== null) {
    times.push(timeMatch[1]);
  }

  let msgMatch;
  let idx = 0;
  while ((msgMatch = messageRegex.exec(html)) !== null) {
    const rawText = msgMatch[1]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (rawText.length > 5) {
      headlines.push({
        id: `tg-${idx}-${Date.now()}`,
        text: rawText,
        timestamp: times[idx] ? new Date(times[idx]).getTime() : Date.now(),
        source: 'Telegram',
      });
    }
    idx++;
  }

  return headlines.reverse().slice(0, 30);
}

function getDemoHeadlines(): Headline[] {
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
    { text: 'GERMAN FACTORY ORDERS FALL 2.1% M/M IN JANUARY VS -0.5% EXPECTED', mins: 30 },
    { text: 'CHINA CAIXIN SERVICES PMI 51.4 VS 50.8 EXPECTED', mins: 35 },
    { text: 'GOLD HITS NEW ALL-TIME HIGH ABOVE $2,950/OZ', mins: 38 },
    { text: 'USDJPY BREAKS BELOW 149.00, LOWEST SINCE DECEMBER', mins: 42 },
    { text: 'US ADP EMPLOYMENT CHANGE 77K VS 140K EXPECTED', mins: 48 },
    { text: 'EUROZONE GDP Q4 FINAL 0.0% Q/Q VS 0.0% PRELIMINARY', mins: 55 },
    { text: 'SNB\'S JORDAN: PREPARED TO INTERVENE IN FX MARKET IF NECESSARY', mins: 60 },
    { text: 'RBA HOLDS CASH RATE AT 4.10% AS EXPECTED, HAWKISH TONE', mins: 65 },
    { text: 'EURUSD TESTS 1.0900 RESISTANCE, HIGHEST SINCE NOVEMBER', mins: 72 },
    { text: 'US ISM SERVICES PMI 52.6 VS 53.0 EXPECTED', mins: 78 },
    { text: 'CANADA EMPLOYMENT CHANGE +76.0K VS +25.0K EXPECTED', mins: 85 },
    { text: 'UK HALIFAX HOUSE PRICES +0.7% M/M VS +0.2% EXPECTED', mins: 90 },
    { text: 'JAPAN HOUSEHOLD SPENDING -4.3% Y/Y VS -1.8% EXPECTED', mins: 95 },
    { text: 'SWISS CPI 0.3% M/M VS 0.4% EXPECTED, EASING PRESSURE ON SNB', mins: 100 },
    { text: 'NZD RALLIES AS RBNZ SIGNALS SLOWER PACE OF EASING', mins: 108 },
    { text: 'NORGES BANK KEEPS POLICY RATE AT 4.50%, SIGNALS CUT IN MARCH', mins: 115 },
    { text: 'RIKSBANK HOLDS RATES UNCHANGED AT 2.25%, IN LINE WITH EXPECTATIONS', mins: 120 },
  ];

  return headlines.map((h, i) => ({
    id: `demo-${i}`,
    text: h.text,
    timestamp: now - h.mins * 60_000,
    source: 'Demo',
  }));
}

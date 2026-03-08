import { HEATMAP_INSTRUMENTS, getInstrument } from './instruments.js';
import { getTradingViewQuotes } from './tradingview.js';

export interface HeatmapEntry {
  currency: string;
  pair: string;
  sourceSymbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface HeatmapStrengthSummary {
  strengthening: string[];
  weakening: string[];
  breadth: number;
  dominantDirection: 'usd_strong' | 'usd_weak' | 'mixed';
}

let cachedHeatmapEntries: HeatmapEntry[] = [];
let heatmapLastUpdated = 0;

export async function refreshHeatmapCache(): Promise<void> {
  cachedHeatmapEntries = await fetchHeatmapData();
  heatmapLastUpdated = Date.now();
}

export function getCachedHeatmapData(): { entries: HeatmapEntry[]; lastUpdated: number } {
  return { entries: cachedHeatmapEntries, lastUpdated: heatmapLastUpdated };
}

export function getHeatmapStrengthSummary(): HeatmapStrengthSummary {
  const strengthening = cachedHeatmapEntries.filter(e => e.changePercent > 0.05).map(e => e.currency);
  const weakening = cachedHeatmapEntries.filter(e => e.changePercent < -0.05).map(e => e.currency);
  const dominantDirection: HeatmapStrengthSummary['dominantDirection'] =
    strengthening.length >= 6 ? 'usd_weak' :
    weakening.length >= 6 ? 'usd_strong' : 'mixed';
  return {
    strengthening,
    weakening,
    breadth: Math.max(strengthening.length, weakening.length),
    dominantDirection,
  };
}

export async function fetchHeatmapData(): Promise<HeatmapEntry[]> {
  const symbols = HEATMAP_INSTRUMENTS
    .map(entry => getInstrument(entry.id)?.tvSymbol)
    .filter((value): value is string => !!value);

  const quotes = await getTradingViewQuotes(symbols);
  const quoteMap = new Map(quotes.map(quote => [quote.symbol, quote]));

  return HEATMAP_INSTRUMENTS.map(entry => {
    const instrument = getInstrument(entry.id);
    const quote = instrument ? quoteMap.get(instrument.tvSymbol) : undefined;
    const price = quote?.price || 0;
    const prevClose = quote?.prevClose || price;
    const rawChange = price - prevClose;
    const rawPct = typeof quote?.changePercent === 'number'
      ? quote.changePercent
      : (prevClose ? (rawChange / prevClose) * 100 : 0);
    const changePercent = entry.invert ? -rawPct : rawPct;

    return {
      currency: entry.currency,
      pair: instrument?.id || entry.id,
      sourceSymbol: instrument?.tvSymbol || entry.id,
      price,
      change: rawChange,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  });
}

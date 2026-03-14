import { getAIProviderStatus, invokeAIAgent } from './aiProvider.js';
import { getAllConfigs } from './countryIndicators/index.js';
import type { CountryConfig, IndicatorMapping } from './countryIndicators/types.js';
import { getPolicyRate } from './dataProviders/centralBankRates.js';
import { getMacroReading } from './dataProviders/macroData.js';
import {
  fetchTradingViewIndicator,
  fetchYieldSpread,
} from './dataProviders/tradingViewBridge.js';
import type { RefreshTier } from './dataProviders/types.js';
import type {
  CountryAIInsight,
  CountryIndicator,
  CountryMapNode,
  CountryRefreshState,
  CountryResearchPacket,
  MarketFundamentalsPayload,
  RateStance,
} from '../../shared/marketFundamentals.js';

// ── Country map positions ────────────────────────────────────────────

const POSITIONS: Record<string, { x: number; y: number }> = {
  USD: { x: 15, y: 34 },
  CAD: { x: 14, y: 22 },
  EUR: { x: 46, y: 30 },
  GBP: { x: 43, y: 24 },
  CHF: { x: 48, y: 34 },
  NOK: { x: 46, y: 17 },
  SEK: { x: 50, y: 18 },
  JPY: { x: 82, y: 30 },
  AUD: { x: 82, y: 69 },
  NZD: { x: 88, y: 76 },
};

// ── Module state ─────────────────────────────────────────────────────

let cachedProfiles: Record<string, CountryResearchPacket> = {};
let cachedPayload: MarketFundamentalsPayload | null = null;
let lastRefreshError: string | undefined;
let lastSuccessfulRefresh = 0;

// ── Country nodes ────────────────────────────────────────────────────

function buildCountryNodes(): CountryMapNode[] {
  return getAllConfigs().map(cfg => {
    const rate = getPolicyRate(cfg.code);
    const rateStance: RateStance = rate?.stance ?? 'hold';
    const pos = POSITIONS[cfg.code] ?? { x: 50, y: 50 };
    return {
      code: cfg.code,
      name: cfg.name,
      currency: cfg.currency,
      region: cfg.region,
      depth: 'primary' as const,
      rateStance,
      position: pos,
    };
  });
}

// ── Build indicators for a single country ────────────────────────────

async function resolveIndicator(mapping: IndicatorMapping): Promise<CountryIndicator> {
  // Policy rate
  if (mapping.policyRateKey) {
    const rate = getPolicyRate(mapping.policyRateKey);
    if (rate) {
      return {
        id: mapping.id,
        label: mapping.label,
        category: mapping.category,
        value: rate.rate,
        direction: 'flat',
        signal: `${rate.stance} — last changed ${rate.lastChanged}`,
        frequency: mapping.frequency,
        lastUpdate: rate.lastChanged,
        sourceLabel: rate.source,
        isPrimary: mapping.isPrimary,
      };
    }
    return emptyIndicator(mapping, 'No policy rate data');
  }

  // Macro reading
  if (mapping.macroReadingKey) {
    const reading = getMacroReading(mapping.macroReadingKey);
    if (reading) {
      let direction: 'up' | 'down' | 'flat' = 'flat';
      if (reading.previousNumeric !== undefined) {
        if (reading.numericValue > reading.previousNumeric) direction = 'up';
        else if (reading.numericValue < reading.previousNumeric) direction = 'down';
      }
      return {
        id: mapping.id,
        label: mapping.label,
        category: mapping.category,
        value: reading.value,
        previousValue: reading.previousValue,
        direction,
        signal: direction === 'flat'
          ? 'Unchanged'
          : `${direction === 'up' ? 'Rose' : 'Fell'} from ${reading.previousValue ?? 'n/a'}`,
        frequency: mapping.frequency,
        lastUpdate: reading.releaseDate,
        sourceLabel: reading.source,
        isPrimary: mapping.isPrimary,
      };
    }
    return emptyIndicator(mapping, 'No macro data');
  }

  // TradingView live price
  if (mapping.tvSymbol) {
    const result = await fetchTradingViewIndicator(mapping.tvSymbol, mapping.label);
    if (result.ok && result.formatted !== undefined) {
      let direction: 'up' | 'down' | 'flat' = 'flat';
      if (result.value !== undefined && result.previousValue !== undefined) {
        if (result.value > result.previousValue) direction = 'up';
        else if (result.value < result.previousValue) direction = 'down';
      }
      const prevFormatted = result.previousValue !== undefined
        ? String(result.previousValue)
        : undefined;
      return {
        id: mapping.id,
        label: mapping.label,
        category: mapping.category,
        value: result.formatted,
        previousValue: prevFormatted,
        direction,
        signal: result.stale ? 'Stale quote' : (direction === 'flat' ? 'Unchanged' : `Moved ${direction}`),
        frequency: mapping.frequency,
        lastUpdate: result.date ?? new Date().toISOString(),
        sourceLabel: result.source ?? 'TradingView',
        isPrimary: mapping.isPrimary,
      };
    }
    return emptyIndicator(mapping, result.error ?? 'No TradingView data');
  }

  // Computed spread
  if (mapping.computedSpread) {
    const result = await fetchYieldSpread(
      mapping.computedSpread.symbol1,
      mapping.computedSpread.symbol2,
      mapping.label,
    );
    if (result.ok && result.formatted !== undefined) {
      let direction: 'up' | 'down' | 'flat' = 'flat';
      if (result.value !== undefined && result.previousValue !== undefined) {
        if (result.value > result.previousValue) direction = 'up';
        else if (result.value < result.previousValue) direction = 'down';
      }
      return {
        id: mapping.id,
        label: mapping.label,
        category: mapping.category,
        value: result.formatted,
        previousValue: result.previousValue !== undefined
          ? `${result.previousValue >= 0 ? '+' : ''}${(result.previousValue * 100).toFixed(1)} bps`
          : undefined,
        direction,
        signal: direction === 'flat' ? 'Stable' : `Spread ${direction === 'up' ? 'widened' : 'narrowed'}`,
        frequency: mapping.frequency,
        lastUpdate: result.date ?? new Date().toISOString(),
        sourceLabel: result.source ?? 'TradingView',
        isPrimary: mapping.isPrimary,
      };
    }
    return emptyIndicator(mapping, result.error ?? 'No spread data');
  }

  return emptyIndicator(mapping, 'No data source configured');
}

function emptyIndicator(mapping: IndicatorMapping, signal: string): CountryIndicator {
  return {
    id: mapping.id,
    label: mapping.label,
    category: mapping.category,
    value: '—',
    direction: 'flat',
    signal,
    frequency: mapping.frequency,
    lastUpdate: new Date().toISOString(),
    sourceLabel: '—',
    isPrimary: mapping.isPrimary,
  };
}

// ── Build a full live profile ────────────────────────────────────────

async function buildLiveProfile(cfg: CountryConfig): Promise<CountryResearchPacket> {
  const indicators = await Promise.all(cfg.indicators.map(resolveIndicator));

  const rate = getPolicyRate(cfg.code);
  const centralBank = rate?.centralBank ?? cfg.centralBank;
  const policyRate = rate?.rate ?? '—';
  const rateStance: RateStance = rate?.stance ?? 'hold';
  const nextKeyEvent = rate?.nextMeeting;

  // Most recent indicator update timestamp
  const timestamps = indicators
    .map(i => new Date(i.lastUpdate).getTime())
    .filter(t => !isNaN(t));
  const lastDataUpdate = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

  // Generate a one-liner summary from policy rate + top indicators
  const topSignals = indicators
    .filter(i => i.isPrimary && i.direction !== 'flat')
    .slice(0, 2)
    .map(i => `${i.label} ${i.direction}`)
    .join(', ');
  const summary = `${centralBank} at ${policyRate} (${rateStance}).${topSignals ? ` ${topSignals}.` : ''}`;

  const insight = deterministicInsight({
    centralBank,
    policyRate,
    rateStance,
    indicators,
    keyThemes: cfg.keyAnchors,
    structuralForces: cfg.structuralForces,
    dependencies: cfg.dependencies,
  });

  return {
    code: cfg.code,
    name: cfg.name,
    currency: cfg.currency,
    region: cfg.region,
    depth: 'primary',
    centralBank,
    policyRate,
    rateStance,
    nextKeyEvent,
    lastDataUpdate,
    summary,
    keyAnchors: cfg.keyAnchors,
    indicators,
    keyThemes: cfg.keyAnchors,
    structuralForces: cfg.structuralForces,
    dependencies: cfg.dependencies,
    charts: [],
    sources: cfg.sources,
    insight,
  };
}

// ── Deterministic insight ────────────────────────────────────────────

interface InsightInput {
  centralBank: string;
  policyRate: string;
  rateStance: RateStance;
  indicators: CountryIndicator[];
  keyThemes: string[];
  structuralForces: string[];
  dependencies: Array<{ countryCode: string; relationship: string; whyNow: string }>;
}

function deterministicInsight(input: InsightInput): CountryAIInsight {
  const { centralBank, policyRate, rateStance, indicators, keyThemes, structuralForces, dependencies } = input;

  // Top 2 signals from indicators that moved
  const moved = indicators.filter(i => i.direction !== 'flat');
  const topSignals = moved.slice(0, 2).map(i => `${i.label}: ${i.value} (${i.direction})`);
  const focusSuffix = topSignals.length > 0 ? ` Key focus: ${topSignals.join('; ')}.` : '';

  const summaryText = `The ${centralBank} holds at ${policyRate} (${rateStance}).${focusSuffix}`;

  const whatChanged = moved.slice(0, 4).map(i =>
    `${i.label} ${i.direction === 'up' ? 'rose' : 'fell'} to ${i.value}${i.previousValue ? ` from ${i.previousValue}` : ''}`
  );
  if (whatChanged.length === 0) {
    whatChanged.push('No significant indicator moves since last update');
  }

  const gameTheory = dependencies.slice(0, 4).map(d => `${d.countryCode}: ${d.whyNow}`);

  const tradingImplications = keyThemes.slice(0, 3).map(t => `Trade the country through ${t.toLowerCase()}.`);

  const missingCount = indicators.filter(i => i.value === '—').length;
  const blindSpots: string[] = [];
  if (missingCount > 0) {
    blindSpots.push(`${missingCount} indicator(s) have no live data — signals may be incomplete.`);
  }
  blindSpots.push('Charts and time-series data are not yet attached to this profile.');

  return {
    method: 'deterministic',
    generatedAt: Date.now(),
    summary: summaryText,
    activeDrivers: keyThemes.slice(0, 4),
    whatChanged,
    gameTheory,
    tradingImplications,
    blindSpots,
  };
}

// ── AI insight ───────────────────────────────────────────────────────

async function buildInsight(profile: CountryResearchPacket): Promise<CountryAIInsight> {
  const fallback = profile.insight;
  const aiStatus = getAIProviderStatus();

  if (!aiStatus.enabled) return fallback;

  const indicatorSummaries = profile.indicators
    .filter(i => i.isPrimary)
    .map(i => ({
      label: i.label,
      value: i.value,
      previousValue: i.previousValue,
      direction: i.direction,
      category: i.category,
    }));

  const result = await invokeAIAgent<{
    summary?: string;
    activeDrivers?: string[];
    whatChanged?: string[];
    gameTheory?: string[];
    tradingImplications?: string[];
    blindSpots?: string[];
  }>({
    agent: 'country-fundamentals',
    timeoutMs: 45_000,
    maxRetries: 0,
    maxTokens: 2500,
    systemPrompt: [
      'You are a macro strategist writing a **live conditions brief** for FX traders.',
      'Use only the supplied indicator values and context.',
      'Return JSON only.',
      'Be concise, specific, and practical for FX trading.',
      'Do not invent numbers, dates, or claims not present in the data.',
      'Treat game theory as dependency, leverage, and vulnerability analysis.',
    ].join(' '),
    userPayload: {
      country: profile.name,
      currency: profile.currency,
      centralBank: profile.centralBank,
      policyRate: profile.policyRate,
      rateStance: profile.rateStance,
      nextKeyEvent: profile.nextKeyEvent,
      indicators: indicatorSummaries,
      keyThemes: profile.keyThemes,
      structuralForces: profile.structuralForces,
      dependencies: profile.dependencies,
      sources: profile.sources.map(s => ({
        title: s.title,
        publisher: s.publisher,
        kind: s.kind,
        publishedAt: s.publishedAt,
        whyItMatters: s.whyItMatters,
        extracts: s.extracts,
      })),
      outputSchema: {
        summary: 'string',
        activeDrivers: ['string'],
        whatChanged: ['string'],
        gameTheory: ['string'],
        tradingImplications: ['string'],
        blindSpots: ['string'],
      },
    },
  });

  if (!result.ok || !result.data?.summary) return fallback;

  return {
    method: 'ai',
    generatedAt: Date.now(),
    model: aiStatus.countryFundamentalsModel,
    summary: result.data.summary,
    activeDrivers: cleanList(result.data.activeDrivers, fallback.activeDrivers),
    whatChanged: cleanList(result.data.whatChanged, fallback.whatChanged),
    gameTheory: cleanList(result.data.gameTheory, fallback.gameTheory),
    tradingImplications: cleanList(result.data.tradingImplications, fallback.tradingImplications),
    blindSpots: cleanList(result.data.blindSpots, fallback.blindSpots),
  };
}

function cleanList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  return list.length > 0 ? list : fallback;
}

// ── Payload builder ──────────────────────────────────────────────────

function buildPayload(
  profiles: Record<string, CountryResearchPacket>,
  state: CountryRefreshState = 'fresh',
  lastRefresh = lastSuccessfulRefresh,
): MarketFundamentalsPayload {
  const now = Date.now();
  return {
    defaultCountryCode: 'USD',
    countries: buildCountryNodes(),
    profiles,
    refresh: {
      state,
      generatedAt: now,
      lastSuccessfulRefresh: lastRefresh,
      nextScheduledRefresh: now + 5 * 60_000,
      note: lastRefreshError,
    },
  };
}

// ── Refresh functions ────────────────────────────────────────────────

export async function refreshMarketData(tier?: RefreshTier | 'all'): Promise<void> {
  try {
    lastRefreshError = undefined;
    const configs = getAllConfigs();

    await Promise.all(configs.map(async cfg => {
      // Filter indicators to the requested tier (or all)
      const relevantMappings = tier && tier !== 'all'
        ? cfg.indicators.filter(m => m.tier === tier)
        : cfg.indicators;

      if (relevantMappings.length === 0 && tier && tier !== 'all') {
        // No indicators on this tier for this country — skip rebuild
        return;
      }

      // Rebuild the full profile (resolveIndicator uses caching internally,
      // so non-targeted tiers will be served from cache)
      const profile = await buildLiveProfile(cfg);

      // Preserve existing AI insight if we already have one
      const existing = cachedProfiles[cfg.code];
      if (existing?.insight.method === 'ai') {
        profile.insight = existing.insight;
      }

      cachedProfiles[cfg.code] = profile;
    }));

    lastSuccessfulRefresh = Date.now();
    cachedPayload = buildPayload(cachedProfiles, 'fresh');
  } catch (error) {
    lastRefreshError = error instanceof Error ? error.message : 'unknown refresh failure';
    cachedPayload = buildPayload(cachedProfiles, 'degraded');
  }
}

export async function refreshAllInsights(): Promise<void> {
  const codes = Object.keys(cachedProfiles);
  await Promise.all(codes.map(async code => {
    const profile = cachedProfiles[code];
    if (!profile) return;
    cachedProfiles[code] = {
      ...profile,
      insight: await buildInsight(profile),
    };
  }));
  cachedPayload = buildPayload(cachedProfiles, 'fresh');
}

export async function refreshMarketFundamentalsCache(): Promise<void> {
  await refreshMarketData('all');
  await refreshAllInsights();
}

// ── Public getters ───────────────────────────────────────────────────

export function getMarketFundamentals(): MarketFundamentalsPayload {
  if (!cachedPayload) {
    // Not yet initialized — return empty payload
    return buildPayload({}, 'stale', 0);
  }

  const ageMs = Date.now() - cachedPayload.refresh.lastSuccessfulRefresh;
  if (ageMs > 36 * 60 * 60 * 1000 && cachedPayload.refresh.state === 'fresh') {
    return buildPayload(cachedProfiles, 'stale');
  }

  return cachedPayload;
}

export function getMarketFundamentalsSummary() {
  const payload = getMarketFundamentals();
  return {
    state: payload.refresh.state,
    lastSuccessfulRefresh: payload.refresh.lastSuccessfulRefresh,
  };
}

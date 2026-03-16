import { buildOpportunityWhaleCandidates, evaluateOpportunities, type OpportunitySnapshot } from './aiAgents.js';
import { searchMacroContext } from './braveSearch.js';
import { getCachedHeadlinesBundle } from './headlines.js';
import { getCachedHeatmapData, getHeatmapStrengthSummary } from './heatmap.js';
import { getInstrument } from './instruments.js';
import { getWhaleSnapshot } from './polymarket.js';
import { getTechnicalSetups } from './setups.js';
import { getRegimeSnapshot } from './velocityMonitor.js';
import { getContextBriefForAI } from './contextBrief.js';
import { recordCycle, updateLevelTests, buildSessionContext } from './opportunityMemory.js';
import { loadYesterdayDigest } from './dailyDigest.js';
import { logActivity } from './activityLog.js';

export interface OpportunityConflict {
  instrument: string;
  description: string;
  sources: string[];
  recommendation: 'watch' | 'fade' | 'wait';
}

export interface MarketOpportunity {
  id: string;
  instrument: string;
  displayName: string;
  directionBias: 'long' | 'short' | 'neutral';
  setupType: 'macro_continuation' | 'event_reprice' | 'breakout_with_confirmation' | 'failed_break' | 'cross_asset_divergence';
  trigger: string;
  confirmationSignals: string[];
  invalidation: string;
  urgency: 'high' | 'medium' | 'low';
  staleAfter: number;
  score: number;
  tvSymbol?: string;
  commentary?: string;
  supportingFactors?: string[];
  sourceMix?: string[];
  confidence?: number;
  classificationMethod?: 'ai';
  fallbackReason?: string;
  theme?: string;
  isSynthetic?: boolean;
  conflictFlag?: string;
  keyLevels?: {
    support: string[];
    resistance: string[];
  };
}

let cachedOpportunities: MarketOpportunity[] = [];
let cachedNarrative = '';
let cachedThemes: string[] = [];
let cachedConflicts: OpportunityConflict[] = [];
let lastRefresh = 0;
let lastAITriggeredAt = 0;
const OPPORTUNITY_REFRESH_TTL_MS = 60_000;
const OPPORTUNITY_AI_CACHE_TTL_MS = 10 * 60_000;
const OPPORTUNITY_AI_STEADY_INTERVAL_MS = 10 * 60_000;
const OPPORTUNITY_AI_REACTIVE_INTERVAL_MS = 3 * 60_000;
let lastAISignature = '';
let lastReactiveSignature = '';

function getActiveCachedAIOpportunities() {
  const now = Date.now();
  return cachedOpportunities.filter(opportunity => opportunity.classificationMethod === 'ai' && opportunity.staleAfter > now);
}

function getMeaningfulHeadlineCandidates() {
  return getCachedHeadlinesBundle().headlines
    .filter(headline =>
      headline.importance !== 'low' &&
      headline.actionability !== 'ignore' &&
      (headline.classificationMethod === 'ai' || (headline.confidence ?? 0) >= 40),
    )
    .slice(0, 8);
}

function getMeaningfulFXSetupCandidates() {
  return getTechnicalSetups()
    .filter(setup =>
      !setup.fallbackReason &&
      setup.confidence >= 45 &&
      setup.quality !== 'skip',
    )
    .slice(0, 6);
}

function getMeaningfulWhaleCandidates() {
  return getWhaleSnapshot()
    .filter(whale =>
      !!whale.side &&
      !!whale.estimatedSizeUsd &&
      (whale.estimatedSizeUsd ?? 0) >= 10_000,
    )
    .slice(0, 5);
}

async function buildOpportunitySnapshot(
  headlinesBundle: ReturnType<typeof getCachedHeadlinesBundle>,
  regime: ReturnType<typeof getRegimeSnapshot>,
): Promise<OpportunitySnapshot> {
  const headlines = getMeaningfulHeadlineCandidates();
  const fxSetups = getMeaningfulFXSetupCandidates();
  const whales = getMeaningfulWhaleCandidates();
  const heatmapData = getCachedHeatmapData();
  const heatmapSummary = getHeatmapStrengthSummary();

  // Search live web using prior cycle's themes (if any)
  const webResults = cachedThemes.length > 0
    ? await searchMacroContext(cachedThemes, 3)
    : [];
  const candidates = [
    ...headlines.map(headline => ({
      id: `headline-${headline.id}`,
      instrument: headline.affectedAssets[0] || headline.marketImpact,
      title: headline.text,
      sourceType: 'headline' as const,
      direction: 'neutral' as const,
      summary: headline.whyItMatters,
      supportingFactors: [
        `importance ${headline.importance}`,
        `confidence ${headline.confidence ?? 0}`,
      ],
      invalidation: 'Cancel if follow-through fails after the headline cluster cools',
      baselineScore: headline.confidence ?? 50,
      staleAfter: headline.timestamp + 30 * 60_000,
    })),
    ...fxSetups.map(setup => ({
      id: `fx-setup-${setup.id}`,
      instrument: setup.pair,
      title: setup.pair,
      sourceType: 'fx_setup' as const,
      direction: setup.direction,
      summary: setup.reasoning || setup.supportingFactors[0] || setup.type,
      supportingFactors: setup.supportingFactors,
      invalidation: setup.invalidation,
      baselineScore: setup.confidence,
      staleAfter: setup.staleAfter,
    })),
    ...buildOpportunityWhaleCandidates(whales),
  ];

  return {
    schemaVersion: 'opportunity-ranker.v2',
    generatedAt: Date.now(),
    freshness: {
      macroSignalsUpdatedAt: regime.updatedAt,
      headlinesUpdatedAt: headlinesBundle.lastUpdated,
      fxSetupsUpdatedAt: Date.now(),
      heatmapUpdatedAt: heatmapData.lastUpdated,
    },
    confidenceInputs: {
      macroSignals: 0,
      headlines: headlines.length,
      fxSetups: fxSetups.length,
      whaleMarkets: whales.length,
      heatmapCurrencies: heatmapData.entries.length,
    },
    provenance: {
      macro: 'deterministic',
      headlines: 'ai',
      fxSetups: 'ai',
      whales: 'polymarket',
      heatmap: 'tradingview',
    },
    regime: {
      usdBias: regime.usdBias,
      usdBreadth: regime.usdBreadth,
      leadPair: regime.topShock?.pair ?? null,
    },
    heatmap: {
      entries: heatmapData.entries.map(e => ({
        currency: e.currency,
        pair: e.pair,
        changePercent: e.changePercent,
      })),
      ...heatmapSummary,
    },
    candidates,
    contextBrief: getContextBriefForAI() ?? undefined,
    sessionContext: buildSessionContext(),
    priorDayContext: loadYesterdayDigest(),
    webSearch: webResults.length > 0
      ? webResults.map(r => ({ title: r.title, description: r.description, age: r.age }))
      : undefined,
  } as OpportunitySnapshot;
}

function shouldUseOpportunityAI(snapshot: OpportunitySnapshot) {
  return snapshot.candidates.length >= 1;
}

function buildAISignature(snapshot: OpportunitySnapshot) {
  // Full signature — used for steady-state cache invalidation.
  // Tracks all candidate IDs so the 10-min cycle re-evaluates when inputs change.
  return JSON.stringify({
    regime: snapshot.regime.usdBias,
    candidateIds: snapshot.candidates.slice(0, 12).map(c => c.id).sort(),
    heatmapDirection: snapshot.heatmap.dominantDirection,
  });
}

function buildReactiveSignature(snapshot: OpportunitySnapshot) {
  // Narrow signature — only changes that justify a reactive 3-min AI call.
  // Critical headlines, regime flips, heatmap direction flips, new FX setups/whales.
  // Medium/high headlines and score changes do NOT trigger reactive calls.
  const criticalHeadlineIds = snapshot.candidates
    .filter(c => c.sourceType === 'headline' && c.supportingFactors.some(f => f.includes('critical')))
    .map(c => c.id)
    .sort();
  const nonHeadlineIds = snapshot.candidates
    .filter(c => c.sourceType !== 'headline')
    .map(c => c.id)
    .sort();
  return JSON.stringify({
    regime: snapshot.regime.usdBias,
    heatmapDirection: snapshot.heatmap.dominantDirection,
    criticalHeadlineIds,
    nonHeadlineIds,
  });
}

function trimCommentary(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 217).trim()}...`;
}

function isWeakOpportunityTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  return normalized.length < 6 || [
    'divergence',
    'breakout',
    'continuation',
    'reversal',
    'momentum',
    'event reprice',
    'macro continuation',
    'cross asset divergence',
    'opportunity',
    'trade',
  ].includes(normalized);
}

function directionWord(direction: MarketOpportunity['directionBias'] | 'neutral') {
  if (direction === 'long') return 'Bullish';
  if (direction === 'short') return 'Bearish';
  return 'Watch';
}

function buildOpportunityTitle(
  title: string,
  instrument: string,
  direction: MarketOpportunity['directionBias'] | 'neutral',
  theme?: string,
) {
  const cleanedTitle = title.trim();
  if (cleanedTitle && !isWeakOpportunityTitle(cleanedTitle)) return cleanedTitle;

  const readableInstrument = getInstrument(instrument)?.displayName || instrument;
  const readableTheme = theme?.trim();
  if (readableTheme) {
    return `${readableInstrument} ${readableTheme}`;
  }

  return `${readableInstrument} ${directionWord(direction)} Setup`;
}

function buildOpportunityDetail(
  commentary: string,
  candidateSummary: string | undefined,
  fallbackTrigger: string,
) {
  const primary = trimCommentary(commentary);
  if (primary) return primary;

  const summary = candidateSummary?.trim();
  if (summary) return summary;

  return fallbackTrigger;
}

function clearAIInsights() {
  cachedNarrative = '';
  cachedThemes = [];
  cachedConflicts = [];
}

export async function refreshOpportunityBoard(): Promise<void> {
  updateLevelTests();
  const headlinesBundle = getCachedHeadlinesBundle();
  const regime = getRegimeSnapshot();
  const snapshot = await buildOpportunitySnapshot(headlinesBundle, regime);
  const aiSignature = buildAISignature(snapshot);

  if (!shouldUseOpportunityAI(snapshot)) {
    cachedOpportunities = [];
    clearAIInsights();
    lastRefresh = Date.now();
    return;
  }

  const reactiveSignature = buildReactiveSignature(snapshot);
  const reactiveChanged = reactiveSignature !== lastReactiveSignature;
  const timeSinceLastAI = lastAITriggeredAt > 0 ? Date.now() - lastAITriggeredAt : Infinity;

  // Two-tier gating:
  // - Reactive (3min floor): only for critical headlines, new setups/whales, regime/direction flips
  // - Steady (10min): regular re-evaluation when anything changed or cache is stale
  if (reactiveChanged) {
    if (timeSinceLastAI < OPPORTUNITY_AI_REACTIVE_INTERVAL_MS) {
      return;
    }
  } else {
    // Skip if inputs haven't changed and cache is fresh
    if (aiSignature === lastAISignature && cachedOpportunities.length > 0 && Date.now() - lastRefresh < OPPORTUNITY_AI_CACHE_TTL_MS) {
      return;
    }
    if (timeSinceLastAI < OPPORTUNITY_AI_STEADY_INTERVAL_MS) {
      return;
    }
  }

  lastAITriggeredAt = Date.now();
  const result = await evaluateOpportunities(snapshot);
  const minConfidence = Number(process.env.AI_OPPORTUNITY_MIN_CONFIDENCE || 50);

  if (!result.ok || !result.data) {
    const activeAIOpportunities = getActiveCachedAIOpportunities();
    cachedOpportunities = activeAIOpportunities.length > 0 ? activeAIOpportunities : [];
    if (activeAIOpportunities.length === 0) clearAIInsights();
    lastAISignature = aiSignature;
    lastReactiveSignature = reactiveSignature;
    lastRefresh = Date.now();
    return;
  }

  const { narrative, themes, opportunities: aiResults, conflicts } = result.data;
  cachedNarrative = typeof narrative === 'string' ? narrative.replace(/\s+/g, ' ').trim() : '';
  cachedThemes = Array.isArray(themes) ? themes.filter((t): t is string => typeof t === 'string') : [];
  cachedConflicts = Array.isArray(conflicts)
    ? conflicts.filter(c =>
        typeof c.instrument === 'string' &&
        typeof c.description === 'string' &&
        Array.isArray(c.sources) &&
        ['watch', 'fade', 'wait'].includes(c.recommendation),
      )
    : [];

  const candidateMap = new Map(snapshot.candidates.map(candidate => [candidate.id, candidate]));
  const aiOpportunities: MarketOpportunity[] = (aiResults || [])
    .filter(item => {
      if (item.confidence < minConfidence) {
        console.log(`[Opportunities] Dropped ${item.candidateId}: confidence ${item.confidence} < ${minConfidence}`);
        return false;
      }
      return true;
    })
    .flatMap(item => {
      const isSynthetic = typeof item.candidateId === 'string' && item.candidateId.startsWith('synth-');
      const candidate = candidateMap.get(item.candidateId);

      if (!candidate && !isSynthetic) {
        console.log(`[Opportunities] Dropped ${item.candidateId}: no matching candidate (available: ${[...candidateMap.keys()].slice(0, 5).join(', ')}...)`);
        return [];
      }
      if (isSynthetic && !getInstrument(item.instrument)) return [];
      if (isSynthetic && (item.confidence < 70 || item.urgency === 'low')) return [];

      const setupType: MarketOpportunity['setupType'] = isSynthetic
        ? 'cross_asset_divergence'
        : candidate!.sourceType === 'fx_setup'
          ? 'breakout_with_confirmation'
          : candidate!.sourceType === 'headline'
            ? 'event_reprice'
            : 'cross_asset_divergence';

      return [{
        id: item.candidateId,
        instrument: item.instrument,
        displayName: buildOpportunityTitle(item.title, item.instrument, item.direction, typeof item.theme === 'string' ? item.theme : undefined),
        directionBias: item.direction,
        setupType,
        trigger: isSynthetic ? buildOpportunityDetail(item.commentary, undefined, item.instrument) : (candidate!.summary || item.commentary),
        confirmationSignals: isSynthetic
          ? item.supportingFactors.slice(0, 4)
          : candidate!.supportingFactors.slice(0, 4),
        invalidation: item.invalidation,
        urgency: item.urgency,
        staleAfter: item.staleAfter,
        score: item.score,
        commentary: buildOpportunityDetail(item.commentary, candidate?.summary, isSynthetic ? item.instrument : candidate!.summary || item.instrument),
        supportingFactors: item.supportingFactors,
        sourceMix: item.sourceMix,
        confidence: item.confidence,
        classificationMethod: 'ai' as const,
        tvSymbol: getInstrument(item.instrument)?.tvSymbol,
        theme: typeof item.theme === 'string' ? item.theme : undefined,
        isSynthetic: isSynthetic || undefined,
        conflictFlag: typeof item.conflictFlag === 'string' ? item.conflictFlag : undefined,
        keyLevels: item.keyLevels,
      }];
    })
    .slice(0, 12);

  if (aiOpportunities.length > 0) {
    cachedOpportunities = aiOpportunities;
    recordCycle(
      cachedNarrative,
      cachedThemes,
      aiOpportunities.map(opp => ({
        instrument: opp.instrument,
        direction: opp.directionBias,
        confidence: opp.confidence ?? 0,
        invalidation: opp.invalidation,
        keyLevels: opp.keyLevels,
      })),
    );
    logActivity({
      timestamp: Date.now(),
      type: 'opportunity:cycle',
      agent: 'opportunity-ranker',
      ok: true,
      meta: {
        narrative: cachedNarrative,
        themes: cachedThemes,
        opportunityCount: aiOpportunities.length,
        opportunities: aiOpportunities.map(o => ({
          id: o.id,
          instrument: o.instrument,
          direction: o.directionBias,
          score: o.score,
          confidence: o.confidence,
          urgency: o.urgency,
          theme: o.theme,
          keyLevels: o.keyLevels,
        })),
        conflictCount: cachedConflicts.length,
        candidateCount: snapshot.candidates.length,
        reactiveTriggered: reactiveChanged,
      },
    });
  } else {
    const activeAIOpportunities = getActiveCachedAIOpportunities();
    cachedOpportunities = activeAIOpportunities.length > 0 ? activeAIOpportunities : [];
    if (activeAIOpportunities.length === 0) clearAIInsights();
  }
  lastAISignature = aiSignature;
  lastReactiveSignature = reactiveSignature;
  lastRefresh = Date.now();
}

export function getMarketOpportunities(): MarketOpportunity[] {
  return cachedOpportunities.slice(0, 12);
}

export function getOpportunityNarrative(): string {
  return cachedNarrative;
}

export function getOpportunityThemes(): string[] {
  return cachedThemes;
}

export function getOpportunityConflicts(): OpportunityConflict[] {
  return cachedConflicts;
}

import { buildOpportunityWhaleCandidates, evaluateOpportunities, type OpportunitySnapshot } from './aiAgents.js';
import { getCachedHeadlinesBundle } from './headlines.js';
import { getCachedHeatmapData, getHeatmapStrengthSummary } from './heatmap.js';
import { getInstrument } from './instruments.js';
import { getWhaleSnapshot } from './polymarket.js';
import { getTechnicalSetups } from './setups.js';
import { getRegimeSnapshot, getActiveSignals, type VelocitySignal } from './velocityMonitor.js';
import { getContextBriefForAI } from './contextBrief.js';

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
  classificationMethod?: 'deterministic' | 'ai';
  fallbackReason?: string;
  theme?: string;
  isSynthetic?: boolean;
  conflictFlag?: string;
}

const ASSET_SCORE_WEIGHTS: Record<VelocitySignal['assetClass'], { z: number; acceleration: number; move: number }> = {
  fx: { z: 22, acceleration: 18, move: 5 },
  crypto: { z: 24, acceleration: 14, move: 9 },
  rate: { z: 26, acceleration: 20, move: 2 },
  index: { z: 20, acceleration: 12, move: 8 },
  commodity: { z: 21, acceleration: 12, move: 7 },
};

let cachedOpportunities: MarketOpportunity[] = [];
let cachedNarrative = '';
let cachedThemes: string[] = [];
let cachedConflicts: OpportunityConflict[] = [];
let lastRefresh = 0;
let lastAITriggeredAt = 0;
const OPPORTUNITY_REFRESH_TTL_MS = 30_000;
const OPPORTUNITY_AI_CACHE_TTL_MS = 5 * 60_000;
const OPPORTUNITY_AI_MIN_INTERVAL_MS = 5 * 60_000;
let lastAISignature = '';

function scoreSignal(signal: VelocitySignal): number {
  const weights = ASSET_SCORE_WEIGHTS[signal.assetClass];
  return (
    signal.zScore * weights.z +
    Math.abs(signal.acceleration) * weights.acceleration +
    signal.moveBps / weights.move
  );
}

function urgencyFromScore(score: number): MarketOpportunity['urgency'] {
  if (score >= 90) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function setupTypeFromSignal(signal: VelocitySignal, hasHeadline: boolean): MarketOpportunity['setupType'] {
  if (hasHeadline) return 'event_reprice';
  if (Math.abs(signal.acceleration) > 0.05) return 'breakout_with_confirmation';
  if (Math.abs(signal.acceleration) < 0.01) return 'failed_break';
  return 'macro_continuation';
}

export function getDeterministicMarketOpportunities(
  headlinesBundle?: ReturnType<typeof getCachedHeadlinesBundle>,
  regimeSnapshot?: ReturnType<typeof getRegimeSnapshot>,
): MarketOpportunity[] {
  const now = Date.now();
  const headlines = (headlinesBundle ?? getCachedHeadlinesBundle()).headlines.filter(headline => headline.actionability !== 'ignore');
  const regime = regimeSnapshot ?? getRegimeSnapshot();
  const signals = getActiveSignals()
    .filter(signal => signal.actionable)
    .sort((left, right) => scoreSignal(right) - scoreSignal(left));

  const opportunities: MarketOpportunity[] = [];

  for (const signal of signals.slice(0, 8)) {
    const alignedHeadline = headlines.find(headline =>
      headline.affectedAssets.includes(signal.pair)
    );

    const instrument = getInstrument(signal.pair);
    const score =
      scoreSignal(signal) +
      (alignedHeadline ? 20 : 0) +
      (signal.assetClass === 'fx' && regime.usdBias !== 'mixed' ? 8 : 0);

    opportunities.push({
      id: `opp-${signal.pair}-${signal.timestamp}`,
      instrument: signal.pair,
      displayName: signal.displayName,
      directionBias: signal.direction === 'up' ? 'long' : 'short',
      setupType: setupTypeFromSignal(signal, !!alignedHeadline),
      trigger: alignedHeadline?.text || `${signal.displayName} impulse with ${signal.zScore.toFixed(1)} z-score`,
      confirmationSignals: [
        `z ${signal.zScore.toFixed(1)}`,
        `acc ${signal.acceleration > 0 ? '+' : ''}${signal.acceleration.toFixed(3)}`,
        `move ${signal.moveBps.toFixed(1)}${signal.moveUnit}`,
        ...(signal.assetClass === 'fx' && regime.usdBias !== 'mixed' ? [`USD regime ${regime.usdBias}`] : []),
      ].slice(0, 4),
      invalidation: `Cancel if ${signal.displayName} loses momentum and retraces 50% of the move`,
      urgency: urgencyFromScore(score),
      staleAfter: now + 20 * 60_000,
      score: Math.round(score),
      tvSymbol: instrument?.tvSymbol,
      classificationMethod: 'deterministic',
    });
  }

  if (regime.usdBias !== 'mixed') {
    opportunities.push({
      id: `opp-usd-regime-${regime.updatedAt}`,
      instrument: 'DXY',
      displayName: 'USD Regime',
      directionBias: regime.usdBias === 'stronger' ? 'long' : 'short',
      setupType: 'cross_asset_divergence',
      trigger: `USD breadth ${regime.usdBreadth} with ${regime.usdBias} regime`,
      confirmationSignals: [
        regime.topShock ? `lead ${regime.topShock.displayName}` : 'no lead pair',
        regime.cryptoImpulse ? `crypto ${regime.cryptoImpulse.displayName}` : 'crypto muted',
      ],
      invalidation: 'Cancel if breadth returns to neutral',
      urgency: regime.usdBreadth >= 2 ? 'high' : 'medium',
      staleAfter: now + 25 * 60_000,
      score: 55 + regime.usdBreadth * 10,
      tvSymbol: 'TVC:DXY',
      classificationMethod: 'deterministic',
    });
  }

  const seen = new Set<string>();
  return opportunities
    .filter(opportunity => {
      if (seen.has(opportunity.id)) return false;
      seen.add(opportunity.id);
      return true;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
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

function buildOpportunitySnapshot(
  deterministicOpportunities: MarketOpportunity[],
  headlinesBundle: ReturnType<typeof getCachedHeadlinesBundle>,
  regime: ReturnType<typeof getRegimeSnapshot>,
): OpportunitySnapshot {
  const headlines = getMeaningfulHeadlineCandidates();
  const fxSetups = getMeaningfulFXSetupCandidates();
  const whales = getMeaningfulWhaleCandidates();
  const heatmapData = getCachedHeatmapData();
  const heatmapSummary = getHeatmapStrengthSummary();
  const candidates = [
    ...deterministicOpportunities
      .filter(opportunity => opportunity.score >= 40 || opportunity.urgency !== 'low')
      .slice(0, 10)
      .map(opportunity => ({
      id: opportunity.id,
      instrument: opportunity.instrument,
      title: opportunity.displayName,
      sourceType: 'macro' as const,
      direction: opportunity.directionBias,
      summary: opportunity.trigger,
      supportingFactors: opportunity.confirmationSignals,
      invalidation: opportunity.invalidation,
      baselineScore: opportunity.score,
      staleAfter: opportunity.staleAfter,
      })),
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
      macroSignals: deterministicOpportunities.length,
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
  } as OpportunitySnapshot;
}

function shouldUseOpportunityAI(_deterministic: MarketOpportunity[], snapshot: OpportunitySnapshot) {
  return snapshot.candidates.length >= 3;
}

function buildAISignature(snapshot: OpportunitySnapshot) {
  return JSON.stringify({
    regime: snapshot.regime,
    heatmapDirection: snapshot.heatmap.dominantDirection,
    heatmapBreadth: snapshot.heatmap.breadth,
    candidates: snapshot.candidates.slice(0, 12).map(candidate => ({
      id: candidate.id,
      sourceType: candidate.sourceType,
      baselineScore: candidate.baselineScore,
      instrument: candidate.instrument,
    })),
  });
}

function trimCommentary(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 217).trim()}...`;
}

function clearAIInsights() {
  cachedNarrative = '';
  cachedThemes = [];
  cachedConflicts = [];
}

export async function refreshOpportunityBoard(): Promise<void> {
  const headlinesBundle = getCachedHeadlinesBundle();
  const regime = getRegimeSnapshot();
  const deterministic = getDeterministicMarketOpportunities(headlinesBundle, regime);
  const snapshot = buildOpportunitySnapshot(deterministic, headlinesBundle, regime);
  const aiSignature = buildAISignature(snapshot);

  if (!shouldUseOpportunityAI(deterministic, snapshot)) {
    cachedOpportunities = deterministic;
    clearAIInsights();
    lastRefresh = Date.now();
    return;
  }

  if (cachedOpportunities.length > 0 && aiSignature === lastAISignature && Date.now() - lastRefresh < OPPORTUNITY_AI_CACHE_TTL_MS) {
    return;
  }

  if (lastAITriggeredAt > 0 && Date.now() - lastAITriggeredAt < OPPORTUNITY_AI_MIN_INTERVAL_MS) {
    if (cachedOpportunities.length === 0) {
      cachedOpportunities = deterministic;
      lastRefresh = Date.now();
    }
    return;
  }

  lastAITriggeredAt = Date.now();
  const result = await evaluateOpportunities(snapshot);
  const minConfidence = Number(process.env.AI_OPPORTUNITY_MIN_CONFIDENCE || 60);

  if (!result.ok || !result.data) {
    cachedOpportunities = deterministic.map(opportunity => ({
      ...opportunity,
      fallbackReason: result.error || 'opportunity ai unavailable',
    }));
    clearAIInsights();
    lastAISignature = aiSignature;
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
    .filter(item => item.confidence >= minConfidence)
    .flatMap(item => {
      const isSynthetic = typeof item.candidateId === 'string' && item.candidateId.startsWith('synth-');
      const candidate = candidateMap.get(item.candidateId);

      if (!candidate && !isSynthetic) return [];
      if (isSynthetic && !getInstrument(item.instrument)) return [];

      const setupType: MarketOpportunity['setupType'] = isSynthetic
        ? 'cross_asset_divergence'
        : candidate!.sourceType === 'fx_setup'
          ? 'breakout_with_confirmation'
          : candidate!.sourceType === 'headline'
            ? 'event_reprice'
            : candidate!.sourceType === 'macro'
              ? 'macro_continuation'
              : 'cross_asset_divergence';

      return [{
        id: item.candidateId,
        instrument: item.instrument,
        displayName: item.title,
        directionBias: item.direction,
        setupType,
        trigger: isSynthetic ? item.commentary : (candidate!.summary || item.commentary),
        confirmationSignals: isSynthetic
          ? item.supportingFactors.slice(0, 4)
          : candidate!.supportingFactors.slice(0, 4),
        invalidation: item.invalidation,
        urgency: item.urgency,
        staleAfter: item.staleAfter,
        score: item.score,
        commentary: trimCommentary(item.commentary),
        supportingFactors: item.supportingFactors,
        sourceMix: item.sourceMix,
        confidence: item.confidence,
        classificationMethod: 'ai' as const,
        tvSymbol: getInstrument(item.instrument)?.tvSymbol,
        theme: typeof item.theme === 'string' ? item.theme : undefined,
        isSynthetic: isSynthetic || undefined,
        conflictFlag: typeof item.conflictFlag === 'string' ? item.conflictFlag : undefined,
      }];
    })
    .slice(0, 12);

  cachedOpportunities = aiOpportunities.length > 0
    ? aiOpportunities
    : deterministic.map(opportunity => ({
        ...opportunity,
        fallbackReason: 'opportunity ai returned no qualified opportunities',
      }));
  lastAISignature = aiSignature;
  lastRefresh = Date.now();
}

export function getMarketOpportunities(): MarketOpportunity[] {
  if (Date.now() - lastRefresh > OPPORTUNITY_REFRESH_TTL_MS && cachedOpportunities.length === 0) {
    cachedOpportunities = getDeterministicMarketOpportunities();
    lastRefresh = Date.now();
  }
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

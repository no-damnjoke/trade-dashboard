import { invokeAIAgent } from './aiProvider.js';
import { getInstrument, G10_FX_INSTRUMENT_IDS, MARKET_INSTRUMENTS } from './instruments.js';
import type { Headline } from './headlines.js';
import type { TechnicalSetup } from './fxSetupEngine.js';
import type { MarketOpportunity } from './opportunities.js';
import type { VelocitySignal } from './velocityMonitor.js';
import type { PredictionMarket } from './polymarket.js';

export interface AIHeadlineResult {
  importance: Headline['importance'];
  actionability: Headline['actionability'];
  marketImpact: Headline['marketImpact'];
  affectedAssets: string[];
  thesisChange: boolean;
  whyItMatters: string;
  alertRecommended: boolean;
  confidence: number;
  classificationMethod: 'ai';
}

export interface AIFXSetup {
  pair: string;
  bias: 'long' | 'short' | 'neutral';
  setupType: string;
  timeframeAlignment: string;
  entryZone: string;
  invalidation: string;
  targets: string[];
  confidence: number;
  quality: 'A' | 'B' | 'C' | 'skip';
  reasoning: string;
  skip: boolean;
  skipReason: string;
  classificationMethod: 'ai';
  sourceTimeframes: string;
}

export interface AIOpportunityResult {
  candidateId: string;
  title: string;
  instrument: string;
  direction: 'long' | 'short' | 'neutral';
  score: number;
  urgency: 'high' | 'medium' | 'low';
  commentary: string;
  supportingFactors: string[];
  invalidation: string;
  staleAfter: number;
  sourceMix: string[];
  confidence: number;
  classificationMethod: 'ai';
  theme?: string;
  isSynthetic?: boolean;
  conflictFlag?: string;
}

export interface AIOpportunityResponse {
  narrative: string;
  themes: string[];
  opportunities: AIOpportunityResult[];
  conflicts: Array<{
    instrument: string;
    description: string;
    sources: string[];
    recommendation: 'watch' | 'fade' | 'wait';
  }>;
}

export interface HeadlineImpactSnapshot {
  schemaVersion: 'headline-impact.v1';
  generatedAt: number;
  freshness: { headlineAgeMs: number; marketStateAgeMs: number };
  confidenceInputs: { relatedHeadlineCount: number; signalCount: number; regimeBias: string };
  provenance: { source: string; provider: string };
  headline: { id: string; text: string; timestamp: number; deterministic: Omit<Headline, 'id' | 'text' | 'timestamp' | 'source' | 'provider' | 'dedupeKey'> };
  relatedHeadlines: Array<{ text: string; importance: string; timestamp: number }>;
  activeSignals: Array<Pick<VelocitySignal, 'pair' | 'displayName' | 'assetClass' | 'zScore' | 'direction'>>;
  regime: { usdBias: string; usdBreadth: number; leadPair: string | null };
  affectedQuotes: Array<{ instrument: string; displayName: string; currentPrice: number }>;
}

export interface FXSetupSnapshot {
  schemaVersion: 'fx-setup.v1';
  generatedAt: number;
  freshness: { quotesUpdatedAt: number; candleWindowMinutes: number };
  confidenceInputs: { pairCount: number; headlineCount: number; signalCount: number };
  provenance: { source: 'tradingview'; timeframes: ['60', '15', '5'] };
  ontology: string;
  regime: { usdBias: string; usdBreadth: number; leadPair: string | null };
  headlines: Array<{ id: string; text: string; importance: string; affectedAssets: string[]; timestamp: number }>;
  pairs: Array<{
    id: string;
    displayName: string;
    tvSymbol: string;
    currentPrice: number | null;
    latestSignal: Pick<VelocitySignal, 'zScore' | 'direction' | 'acceleration' | 'moveBps' | 'moveUnit'> | null;
    timeframes: Record<'60' | '15' | '5', { candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>; indicators: Record<string, number | string | null> }>;
  }>;
}

export interface OpportunitySnapshot {
  schemaVersion: 'opportunity-ranker.v2';
  generatedAt: number;
  freshness: { macroSignalsUpdatedAt: number; headlinesUpdatedAt: number; fxSetupsUpdatedAt: number; heatmapUpdatedAt: number };
  confidenceInputs: { macroSignals: number; headlines: number; fxSetups: number; whaleMarkets: number; heatmapCurrencies: number };
  provenance: { macro: 'deterministic'; headlines: 'ai'; fxSetups: 'ai'; whales: 'polymarket'; heatmap: 'tradingview' };
  regime: { usdBias: string; usdBreadth: number; leadPair: string | null };
  heatmap: {
    entries: Array<{ currency: string; pair: string; changePercent: number }>;
    strengthening: string[];
    weakening: string[];
    breadth: number;
    dominantDirection: 'usd_strong' | 'usd_weak' | 'mixed';
  };
  candidates: Array<{
    id: string;
    instrument: string;
    title: string;
    sourceType: 'macro' | 'headline' | 'fx_setup' | 'whale';
    direction: 'long' | 'short' | 'neutral';
    summary: string;
    supportingFactors: string[];
    invalidation: string;
    baselineScore: number;
    staleAfter: number;
  }>;
}

const ICT_ONTOLOGY = `
Smart Money Concepts / ICT operating definitions:
- BOS: break of structure means a decisive close beyond the prior confirmed swing high or swing low on the reference timeframe.
- CHoCH: change of character means a break against the prior directional structure after an established trend leg.
- Liquidity sweep: a short-lived breach of an obvious prior high/low followed by rejection back inside structure.
- Displacement: an impulsive move with large body candles and limited overlap, usually leaving imbalance behind.
- Fair value gap: a three-candle imbalance where candle 2 expands and candle 1 high is below candle 3 low for bullish gaps, inverse for bearish.
- Order block: the last opposing candle before displacement that led to a valid structure break.
- Premium/discount: relative location inside the current dealing range; upper half is premium, lower half is discount.
- Session bias: evaluate Asia, London, and New York context separately and prefer setups aligned with active session participation.
- Kill zones: prioritize London open and New York overlap behavior when deciding execution quality.
- Invalidation: every setup must define the price condition that proves the thesis wrong, not a vague narrative failure.
- Skip rule: if structure is unclear or confluence is weak, return skip rather than force a setup.
`.trim();

function isHeadlineImportance(value: unknown): value is Headline['importance'] {
  return typeof value === 'string' && ['critical', 'high', 'medium', 'low'].includes(value);
}

function isHeadlineActionability(value: unknown): value is Headline['actionability'] {
  return typeof value === 'string' && ['actionable', 'watch', 'ignore'].includes(value);
}

function isMarketImpact(value: unknown): value is Headline['marketImpact'] {
  return typeof value === 'string' && ['broad', 'fx', 'rates', 'crypto', 'asia', 'commodity', 'mixed'].includes(value);
}

function isConfidence(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validAffectedAssets(assets: unknown) {
  return Array.isArray(assets) && assets.every(asset => typeof asset === 'string' && !!getInstrument(asset));
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  if (value >= 0 && value <= 100) return Math.round(value);
  return null;
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const truncated = normalized.slice(0, maxLength);
  const boundary = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('; '),
    truncated.lastIndexOf(', '),
  );
  if (boundary >= Math.floor(maxLength * 0.55)) {
    return `${truncated.slice(0, boundary + 1).trim()}...`;
  }
  return `${truncated.trim()}...`;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(normalizeText(left).split(' ').filter(token => token.length > 3));
  const rightTokens = new Set(normalizeText(right).split(' ').filter(token => token.length > 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap++;
  }
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function isEscalationContinuation(headline: string, relatedHeadlines: HeadlineImpactSnapshot['relatedHeadlines']) {
  if (relatedHeadlines.length === 0) return false;
  const normalizedHeadline = normalizeText(headline);
  const continuationTerms = [
    'fresh strikes',
    'new strikes',
    'new wave',
    'carrying out',
    'continued strikes',
    'retaliation',
    'bombing',
    'missile launches',
  ];

  return relatedHeadlines.some(related => {
    const overlap = tokenOverlap(normalizedHeadline, related.text);
    return overlap >= 0.35 || continuationTerms.some(term => normalizedHeadline.includes(term) && normalizeText(related.text).includes(term));
  });
}

function hasRegimeShiftCue(headline: string) {
  const normalized = normalizeText(headline);
  const cues = [
    'ceasefire',
    'truce',
    'rate hike',
    'rate cut',
    'intervention',
    'strait of hormuz',
    'nuclear',
    'qatar',
    'bahrain',
    'saudi',
    'united arab emirates',
    'oil tanker',
    'sanctions',
  ];
  return cues.some(cue => normalized.includes(cue));
}

function resolveThesisChange(snapshot: HeadlineImpactSnapshot, raw: Record<string, unknown>, fallback = false) {
  const normalizedHeadline = normalizeText(snapshot.headline.text);
  if (snapshot.headline.deterministic.importance === 'low' || snapshot.headline.deterministic.actionability === 'ignore') {
    return false;
  }

  const weakUpdateCues = [
    'partially resumed operations',
    'resume flights',
    'apologized',
    'will stop bombing neighbors',
    'no more attacks',
    'no missile launches',
  ];
  if (weakUpdateCues.some(cue => normalizedHeadline.includes(cue))) {
    return false;
  }

  const explicit = typeof raw.thesisChange === 'boolean'
    ? raw.thesisChange
    : typeof raw.thesisChange === 'string'
      ? /^(true|yes)$/i.test(raw.thesisChange.trim())
      : fallback;

  if (!explicit) return false;
  if (snapshot.relatedHeadlines.length === 0) return true;
  if (hasRegimeShiftCue(snapshot.headline.text)) return true;
  if (isEscalationContinuation(snapshot.headline.text, snapshot.relatedHeadlines)) return false;
  return explicit;
}

function normalizeHeadlineResult(
  snapshot: HeadlineImpactSnapshot,
  value: unknown,
  fallback: Pick<AIHeadlineResult, 'importance' | 'actionability' | 'marketImpact'> & { affectedAssets: string[]; thesisChange?: boolean; whyItMatters: string; alertRecommended?: boolean },
): AIHeadlineResult | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const importanceRaw = typeof raw.importance === 'string' ? raw.importance.toLowerCase() : raw.importance;
  const actionabilityRaw = typeof raw.actionability === 'string' ? raw.actionability.toLowerCase() : raw.actionability;
  const marketImpactRaw = typeof raw.marketImpact === 'string' ? raw.marketImpact.toLowerCase() : raw.marketImpact;
  const affectedAssets = Array.isArray(raw.affectedAssets)
    ? raw.affectedAssets.filter((asset): asset is string => typeof asset === 'string' && !!getInstrument(asset))
    : fallback.affectedAssets;
  const confidence = normalizeConfidence(raw.confidence);
  const importance = isHeadlineImportance(importanceRaw) ? importanceRaw : fallback.importance;
  const actionability = isHeadlineActionability(actionabilityRaw) ? actionabilityRaw : fallback.actionability;
  const marketImpact = (() => {
    if (marketImpactRaw === 'neutral') return 'mixed';
    if (marketImpactRaw === 'risk-off' || marketImpactRaw === 'risk_on' || marketImpactRaw === 'risk-on') return 'broad';
    if (marketImpactRaw === 'equities' || marketImpactRaw === 'stocks') return 'broad';
    if (marketImpactRaw === 'geopolitics' || marketImpactRaw === 'geopolitical') return 'mixed';
    return isMarketImpact(marketImpactRaw) ? marketImpactRaw : fallback.marketImpact;
  })();
  const thesisChange = resolveThesisChange(snapshot, raw, fallback.thesisChange ?? false);
  const whyItMatters = typeof raw.whyItMatters === 'string' && raw.whyItMatters.trim()
    ? raw.whyItMatters.trim()
    : fallback.whyItMatters;
  const alertRecommended = typeof raw.alertRecommended === 'boolean'
    ? raw.alertRecommended
    : (fallback.alertRecommended ?? actionability === 'actionable');

  if (
    typeof thesisChange !== 'boolean' ||
    !whyItMatters ||
    confidence === null
  ) {
    return null;
  }

  return {
    importance,
    actionability,
    marketImpact,
    affectedAssets,
    thesisChange,
    whyItMatters: compactText(whyItMatters, 220),
    alertRecommended,
    confidence,
    classificationMethod: 'ai',
  };
}

export async function evaluateHeadlineImpact(snapshot: HeadlineImpactSnapshot) {
  const systemPrompt = [
    'You are the Headline Impact Agent for a macro trading dashboard.',
    'Decide whether the headline changes the market story now, given the supplied regime, active signals, and related headline cluster.',
    'Your job is comparative, not absolute: judge novelty versus the current context, not whether the text sounds dramatic by itself.',
    'You may receive a contextBrief with recent macro headlines from global news (WSJ, CNBC, Reuters, FT, etc.) — use it to judge whether this headline is genuinely new or just a continuation of known stories. The contextBrief is background; the headline being classified is the live input.',
    '',
    'IMPORTANCE LEVELS — be strict:',
    '- critical: Only for genuinely market-moving events — surprise rate decisions, major data misses/beats, new geopolitical escalations (new theater, new country, ceasefire). Max 1-2 per day.',
    '- high: Material new information that active traders need to see — first report of a policy shift, unexpected data, significant positioning change.',
    '- medium: Relevant context but not immediately actionable — scheduled data in line with expectations, routine policy commentary.',
    '- low: Noise — repeated updates on known stories, vague sourced reports, follow-up coverage of already-priced events.',
    '',
    'COMMON MISTAKES TO AVOID:',
    '- Repeated war/strike headlines in an active conflict are LOW unless they open a new theater or chokepoint.',
    '- A policymaker repeating known stance is LOW or MEDIUM, not critical.',
    '- Dramatic wording alone does not make something critical.',
    '- NEVER claim something is "first report" or "first time" unless you are certain from the supplied data. Check the contextBrief and relatedHeadlines — if similar events are already covered, this is a continuation.',
    '- Keep whyItMatters to YOUR OWN analysis only. Do not repeat or echo the deterministic tags from the payload.',
    '',
    'thesisChange: true ONLY if the headline materially changes or invalidates the prevailing market narrative.',
    'whyItMatters: One short sentence, under 15 words. No background, no scene-setting.',
    'confidence: 0-100, how sure you are about your classification.',
    '',
    'Return strict JSON only.',
    'Required keys: importance, actionability, marketImpact, affectedAssets, thesisChange, whyItMatters, alertRecommended, confidence, classificationMethod.',
    'classificationMethod must be "ai".',
  ].join('\n');

  const result = await invokeAIAgent<AIHeadlineResult>({
    agent: 'headline-impact',
    systemPrompt,
    userPayload: snapshot,
  });

  if (!result.ok || !result.data) {
    return { ok: false as const, error: result.error || 'headline ai failed' };
  }

  const data = normalizeHeadlineResult(snapshot, result.data, {
    importance: snapshot.headline.deterministic.importance,
    actionability: snapshot.headline.deterministic.actionability,
    marketImpact: snapshot.headline.deterministic.marketImpact,
    affectedAssets: snapshot.headline.deterministic.affectedAssets,
    thesisChange: false,
    whyItMatters: snapshot.headline.deterministic.whyItMatters,
    alertRecommended: snapshot.headline.deterministic.actionability === 'actionable',
  });
  if (!data || !validAffectedAssets(data.affectedAssets)) {
    return { ok: false as const, error: 'headline ai validation failed' };
  }

  return { ok: true as const, data };
}

export function buildFXSetupOntology() {
  return ICT_ONTOLOGY;
}

function isAIFXSetup(value: unknown): value is AIFXSetup {
  if (!value || typeof value !== 'object') return false;
  const setup = value as AIFXSetup;
  return (
    typeof setup.pair === 'string' &&
    G10_FX_INSTRUMENT_IDS.includes(setup.pair as (typeof G10_FX_INSTRUMENT_IDS)[number]) &&
    ['long', 'short', 'neutral'].includes(setup.bias) &&
    typeof setup.setupType === 'string' &&
    typeof setup.timeframeAlignment === 'string' &&
    typeof setup.entryZone === 'string' &&
    typeof setup.invalidation === 'string' &&
    Array.isArray(setup.targets) &&
    setup.targets.every(target => typeof target === 'string') &&
    isConfidence(setup.confidence) &&
    ['A', 'B', 'C', 'skip'].includes(setup.quality) &&
    typeof setup.reasoning === 'string' &&
    typeof setup.skip === 'boolean' &&
    typeof setup.skipReason === 'string' &&
    setup.classificationMethod === 'ai' &&
    setup.sourceTimeframes === '1H / 15M / 5M'
  );
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Math.abs(value) >= 100) return value.toFixed(2);
  if (Math.abs(value) >= 10) return value.toFixed(3);
  return value.toFixed(5);
}

function formatRange(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [low, high] = value;
  if (typeof low !== 'number' || typeof high !== 'number') return null;
  return `${formatNumber(low)} - ${formatNumber(high)}`;
}

function formatRangeObject(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const low = raw.low;
  const high = raw.high;
  if (typeof low !== 'number' || typeof high !== 'number') return null;
  return `${formatNumber(low)} - ${formatNumber(high)}`;
}

function normalizeFXQuality(rawQuality: unknown): AIFXSetup['quality'] {
  if (typeof rawQuality !== 'string') return 'skip';
  const quality = rawQuality.toLowerCase().trim();
  if (quality === 'a' || quality === 'high') return 'A';
  if (quality === 'b' || quality === 'medium') return 'B';
  if (quality === 'c' || quality === 'low') return 'C';
  if (quality === 'skip') return 'skip';
  return 'skip';
}

function deriveFXConfidence(raw: Record<string, unknown>, quality: AIFXSetup['quality']) {
  const explicit = normalizeConfidence(raw.confidence);
  if (explicit !== null) return explicit;
  if (quality === 'A') return 78;
  if (quality === 'B') return 66;
  if (quality === 'C') return 54;
  return 0;
}

function formatTimeframeAlignment(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const labels = ['H1', 'M15', 'M5']
    .map(key => {
      const bias = raw[key];
      return typeof bias === 'string' ? `${key} ${bias.toLowerCase()}` : null;
    })
    .filter((item): item is string => !!item);
  return labels.length > 0 ? labels.join(', ') : null;
}

function formatEntryZone(raw: Record<string, unknown>) {
  if (typeof raw.entryZone === 'string') return raw.entryZone;
  if (typeof raw.entry === 'string') return raw.entry;
  const entrySource = raw.entryZone && typeof raw.entryZone === 'object'
    ? raw.entryZone
    : raw.entry;
  if (!entrySource || typeof entrySource !== 'object') return 'n/a';
  const entryRecord = entrySource as Record<string, unknown>;
  const zone = formatRange(entryRecord.zone)
    ?? formatRangeObject(entryRecord.zone)
    ?? formatRange(entryRecord.prices)
    ?? formatRangeObject(entryRecord.prices);
  if (zone) return zone;
  if (typeof entryRecord.level === 'number') return formatNumber(entryRecord.level);
  return typeof entryRecord.type === 'string' ? entryRecord.type : 'n/a';
}

function formatInvalidation(raw: Record<string, unknown>) {
  if (typeof raw.invalidation === 'string') return raw.invalidation;
  const invalidation = raw.invalidation;
  if (!invalidation || typeof invalidation !== 'object') return 'n/a';
  const invalidationRecord = invalidation as Record<string, unknown>;
  const type = typeof invalidationRecord.type === 'string' ? invalidationRecord.type.replace(/_/g, ' ') : 'price invalidation';
  const level = typeof invalidationRecord.level === 'number' ? formatNumber(invalidationRecord.level) : null;
  return level ? `${type} ${level}` : type;
}

function formatTargets(raw: Record<string, unknown>) {
  if (Array.isArray(raw.targets)) {
    return raw.targets.filter((target): target is string => typeof target === 'string');
  }
  const target = raw.target;
  if (!target || typeof target !== 'object') return [];
  const targetRecord = target as Record<string, unknown>;
  if (typeof targetRecord.level === 'number') {
    return [formatNumber(targetRecord.level)];
  }
  if (Array.isArray(targetRecord.levels)) {
    return targetRecord.levels
      .filter((level): level is number => typeof level === 'number')
      .map(level => formatNumber(level));
  }
  return [];
}

function normalizeFXSetup(value: unknown): AIFXSetup | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const quality = normalizeFXQuality(raw.quality);
  const confidence = deriveFXConfidence(raw, quality);
  const rawBias = typeof raw.bias === 'string'
    ? raw.bias.toLowerCase()
    : typeof raw.direction === 'string'
      ? raw.direction.toLowerCase()
      : raw.bias;
  const pair = typeof raw.pair === 'string' ? raw.pair.toUpperCase() : raw.pair;
  const skip = typeof raw.skip === 'boolean' ? raw.skip : quality === 'skip';
  const sourceTimeframes = typeof raw.sourceTimeframes === 'string'
    ? raw.sourceTimeframes.toUpperCase().replace(/\s+/g, ' ').trim()
    : raw.sourceTimeframes;
  const setupType = typeof raw.setupType === 'string'
    ? raw.setupType
    : typeof raw.archetype === 'string'
      ? raw.archetype
      : typeof raw.pattern === 'string'
        ? raw.pattern
      : 'unknown';
  const timeframeAlignment = typeof raw.timeframeAlignment === 'string'
    ? raw.timeframeAlignment
    : formatTimeframeAlignment(raw.timeframeAlignment) ?? formatTimeframeAlignment(raw.timeframeBias) ?? 'mixed';

  const normalized: AIFXSetup = {
    pair: typeof pair === 'string' ? pair : '',
    bias: rawBias === 'long' || rawBias === 'short' || rawBias === 'neutral' ? rawBias : 'neutral',
    setupType,
    timeframeAlignment,
    entryZone: formatEntryZone(raw),
    invalidation: formatInvalidation(raw),
    targets: formatTargets(raw),
    confidence,
    quality,
    reasoning: typeof raw.reasoning === 'string'
      ? compactText(raw.reasoning, 180)
      : typeof raw.reason === 'string'
        ? compactText(raw.reason, 180)
        : '',
    skip,
    skipReason: typeof raw.skipReason === 'string' ? raw.skipReason : (skip ? 'structure unclear' : ''),
    classificationMethod: 'ai',
    sourceTimeframes: sourceTimeframes === '1H / 15M / 5M' ? sourceTimeframes : '1H / 15M / 5M',
  };

  return isAIFXSetup(normalized) ? normalized : null;
}

export async function evaluateFXSetups(snapshot: FXSetupSnapshot) {
  const systemPrompt = [
    'You are the G10 FX Setup Agent for a macro trading dashboard.',
    'Use only the supplied structured data and the supplied ICT/SMC ontology.',
    'Evaluate all provided G10 majors and crosses using 1H / 15M / 5M structure.',
    'This is an intraday pattern-classification task, not macro narration.',
    'Prioritize market structure, liquidity behavior, displacement, imbalance, session alignment, and invalidation clarity.',
    'Do not mistake ordinary momentum or macro volatility for ICT/SMC structure unless the supplied candles actually support it.',
    'When a pattern is clear and clean, do not overuse skip.',
    'Prefer skip over weak confluence. A clean no-trade decision is better than a forced setup.',
    'Keep reasoning to one short sentence, ideally under 24 words.',
    'No article-style commentary, no educational explanation, no macro recap.',
    'Return at most 6 setups total.',
    'Return strict JSON with a single key "setups" whose value is an array of setup objects.',
    'Every object must use pair ids exactly as provided.',
    'If structure is unclear, return a setup with quality "skip" and skip=true rather than inventing a trade.',
    'Only use these setup archetypes unless skip is required: liquidity_sweep_reversal, displacement_continuation, fair_value_gap_retest, order_block_reaction, range_expansion_breakout, session_liquidity_reversal.',
  ].join(' ');

  const result = await invokeAIAgent<{ setups: AIFXSetup[] }>({
    agent: 'fx-setup',
    systemPrompt,
    userPayload: snapshot,
    timeoutMs: 20_000,
    maxTokens: 1000,
  });

  if (!result.ok || !result.data || !Array.isArray(result.data.setups)) {
    return {
      ok: false as const,
      error: result.error || 'fx setup ai failed',
      raw: result.data ?? null,
      normalized: [],
    };
  }

  const setups = result.data.setups.map(normalizeFXSetup).filter((setup): setup is AIFXSetup => !!setup);
  if (setups.length === 0) {
    return {
      ok: false as const,
      error: 'fx setup ai validation failed',
      raw: result.data,
      normalized: setups,
    };
  }

  return {
    ok: true as const,
    data: setups,
    raw: result.data,
    normalized: setups,
  };
}

function isAIOpportunityResult(value: unknown, candidateIds: Set<string>): value is AIOpportunityResult {
  if (!value || typeof value !== 'object') return false;
  const opportunity = value as AIOpportunityResult;
  const validId = typeof opportunity.candidateId === 'string' &&
    (candidateIds.has(opportunity.candidateId) || opportunity.candidateId.startsWith('synth-'));
  return (
    validId &&
    typeof opportunity.title === 'string' &&
    typeof opportunity.instrument === 'string' &&
    ['long', 'short', 'neutral'].includes(opportunity.direction) &&
    typeof opportunity.score === 'number' &&
    ['high', 'medium', 'low'].includes(opportunity.urgency) &&
    typeof opportunity.commentary === 'string' &&
    Array.isArray(opportunity.supportingFactors) &&
    opportunity.supportingFactors.every(factor => typeof factor === 'string') &&
    typeof opportunity.invalidation === 'string' &&
    typeof opportunity.staleAfter === 'number' &&
    Array.isArray(opportunity.sourceMix) &&
    opportunity.sourceMix.every(item => typeof item === 'string') &&
    isConfidence(opportunity.confidence) &&
    opportunity.classificationMethod === 'ai'
  );
}

function normalizeOpportunityResult(value: unknown, candidateIds: Set<string>): AIOpportunityResult | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const direction = typeof raw.direction === 'string' ? raw.direction.toLowerCase() : raw.direction;
  const urgency = typeof raw.urgency === 'string' ? raw.urgency.toLowerCase() : raw.urgency;
  const confidence = normalizeConfidence(raw.confidence);

  const normalized: AIOpportunityResult = {
    candidateId: typeof raw.candidateId === 'string' ? raw.candidateId : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    instrument: typeof raw.instrument === 'string' ? raw.instrument : '',
    direction: direction === 'long' || direction === 'short' || direction === 'neutral' ? direction : 'neutral',
    score: typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : 0,
    urgency: urgency === 'high' || urgency === 'medium' || urgency === 'low' ? urgency : 'low',
    commentary: typeof raw.commentary === 'string'
      ? compactText(raw.commentary, 220)
      : typeof raw.reason === 'string'
        ? compactText(raw.reason, 220)
        : '',
    supportingFactors: Array.isArray(raw.supportingFactors)
      ? raw.supportingFactors.filter((factor): factor is string => typeof factor === 'string')
      : [],
    invalidation: typeof raw.invalidation === 'string' ? raw.invalidation : '',
    staleAfter: typeof raw.staleAfter === 'number' && Number.isFinite(raw.staleAfter) ? raw.staleAfter : Date.now() + 15 * 60_000,
    sourceMix: Array.isArray(raw.sourceMix)
      ? raw.sourceMix.filter((item): item is string => typeof item === 'string')
      : Array.isArray(raw.source_mix)
        ? raw.source_mix.filter((item): item is string => typeof item === 'string')
      : [],
    confidence: confidence ?? 0,
    classificationMethod: 'ai',
    theme: typeof raw.theme === 'string' ? raw.theme : undefined,
    isSynthetic: typeof raw.isSynthetic === 'boolean' ? raw.isSynthetic : (typeof raw.candidateId === 'string' && raw.candidateId.startsWith('synth-')) || undefined,
    conflictFlag: typeof raw.conflictFlag === 'string' ? raw.conflictFlag : undefined,
  };

  return isAIOpportunityResult(normalized, candidateIds) ? normalized : null;
}

export async function evaluateOpportunities(snapshot: OpportunitySnapshot) {
  const candidateIds = new Set(snapshot.candidates.map(candidate => candidate.id));
  const systemPrompt = [
    'You are the Opportunity Aggregation Agent for a macro trading dashboard.',
    '',
    'ROLE: Synthesize all provided market data into a cohesive trading view. You receive:',
    '- Pre-scored candidate opportunities from macro signals, headlines, FX setups, and whale activity',
    '- G10 currency heatmap data showing real-time strength/weakness vs USD',
    '- Regime context (USD bias, breadth, lead pair)',
    '- A contextBrief with recent macro headlines from global news sources (WSJ, CNBC, Reuters, FT, etc.)',
    '',
    'IMPORTANT: The contextBrief is BACKGROUND context scraped every 6 hours — use it to understand the macro narrative, but live candidates, heatmap, and regime data are more current and take priority. Do not generate opportunities purely from contextBrief headlines.',
    '',
    'YOUR TASKS:',
    '',
    '1. NARRATIVE: Write a 2-3 sentence "narrative" describing the current regime, dominant themes, and key risks. Be specific and actionable, not generic.',
    '',
    '2. THEMES: Identify 2-4 active themes from the data. Examples: "USD Weakness", "Risk-Off", "JPY Carry Unwind", "Event-Driven", "Crypto Impulse", "Rate Divergence". Return as a "themes" array.',
    '',
    '3. OPPORTUNITIES: Rank and refine the provided candidates. You MAY also synthesize up to 3 new cross-asset ideas that the candidates alone do not capture, but only if the data strongly supports them.',
    '   - For existing candidates: use the provided candidateId.',
    '   - For synthetic ideas: use candidateId format "synth-1", "synth-2", etc. Set isSynthetic=true.',
    '   - Synthetic ideas MUST use instruments from the provided heatmap or candidate data. Do not invent tickers.',
    '   - Each opportunity MUST include a "theme" field matching one of your identified themes.',
    '   - Use heatmap breadth to confirm or contradict regime signals.',
    '',
    '4. CONFLICTS: When sources disagree on an instrument or theme (e.g., bullish FX setup vs bearish headline), surface it as a conflict entry.',
    '   - Each conflict needs: instrument, description, sources array, and recommendation ("watch", "fade", or "wait").',
    '   - For instrument, use a readable label like "USD Regime", "DXY", or the pair name. Do not use camelCase or internal field names.',
    '   - Also set conflictFlag on the relevant opportunity object with a short description.',
    '',
    'Keep commentary concise: at most 2 short sentences, ideally under 35 words total.',
    'No article-style commentary, no macro recap, no repeated background context.',
    '',
    'Return strict JSON: { "narrative": "...", "themes": ["..."], "opportunities": [...], "conflicts": [...] }',
    '',
    'Reward confluence, regime alignment, fresh catalysts, clear invalidation, heatmap breadth confirmation, and high-confidence setups.',
  ].join('\n');

  const result = await invokeAIAgent<AIOpportunityResponse>({
    agent: 'opportunity-ranker',
    systemPrompt,
    userPayload: snapshot,
    timeoutMs: 45_000,
    maxTokens: 3000,
  });

  if (!result.ok || !result.data || !Array.isArray(result.data.opportunities)) {
    return { ok: false as const, error: result.error || 'opportunity ai failed' };
  }

  const opportunities = result.data.opportunities
    .map(item => normalizeOpportunityResult(item, candidateIds))
    .filter((item): item is AIOpportunityResult => !!item);
  if (opportunities.length === 0) {
    return { ok: false as const, error: 'opportunity ai validation failed' };
  }

  return {
    ok: true as const,
    data: {
      narrative: typeof result.data.narrative === 'string' ? result.data.narrative : '',
      themes: Array.isArray(result.data.themes) ? result.data.themes.filter((t): t is string => typeof t === 'string') : [],
      opportunities,
      conflicts: Array.isArray(result.data.conflicts) ? result.data.conflicts : [],
    },
  };
}

export function buildOpportunityWhaleCandidates(whales: PredictionMarket[]) {
  return whales
    .filter(whale => whale.side && whale.estimatedSizeUsd)
    .slice(0, 3)
    .map(whale => ({
      id: `whale-${whale.id}`,
      instrument: whale.slug,
      title: whale.question,
      sourceType: 'whale' as const,
      direction: 'neutral' as const,
      summary: `${whale.side} ${whale.yesPct}% | vol $${Math.round(whale.volume24h).toLocaleString()}`,
      supportingFactors: [
        whale.delta24h != null ? `24h shift ${whale.delta24h > 0 ? '+' : ''}${whale.delta24h.toFixed(1)}pp` : 'tracking',
        `liquidity $${Math.round(whale.liquidity).toLocaleString()}`,
      ],
      invalidation: 'Cancel if Polymarket probability reverses sharply',
      baselineScore: 55 + Math.min(35, Math.round((whale.estimatedSizeUsd || 0) / Math.max(whale.liquidity || 1, 1))),
      staleAfter: Date.now() + 30 * 60_000,
    }));
}

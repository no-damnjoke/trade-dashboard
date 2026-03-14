import { buildFXSetupOntology, evaluateFXSetups, type AIFXSetup, type FXSetupSnapshot } from './aiAgents.js';
import { getCachedHeadlinesBundle } from './headlines.js';
import { getG10FXInstruments, getInstrument, G10_FX_INSTRUMENT_IDS } from './instruments.js';
import { getMockSymbols, isMockMarketDataEnabled } from './mockMarketData.js';
import { getTradingViewCandles, type Candle } from './tradingviewCandles.js';
import { getLatestQuotes, getRegimeSnapshot, getActiveSignals, type VelocitySignal } from './velocityMonitor.js';

export interface TechnicalSetup {
  id: string;
  type: 'event_continuation' | 'range_break_accel' | 'failed_break_reversal' | 'usd_regime_impulse' | string;
  pair: string;
  direction: 'long' | 'short';
  confidence: number;
  invalidation: string;
  supportingFactors: string[];
  staleAfter: number;
  entryZone?: string;
  targets?: string[];
  timeframeAlignment?: string;
  quality?: 'A' | 'B' | 'C' | 'skip';
  reasoning?: string;
  sourceTimeframes?: string;
  classificationMethod?: 'deterministic' | 'ai';
  fallbackReason?: string;
}

export interface FXSetupPairSnapshot {
  id: string;
  displayName: string;
  tvSymbol: string;
  currentPrice: number | null;
  hasActiveSignal: boolean;
  latestSignal: VelocitySignal | null;
}

export interface FXSetupContext {
  timestamp: number;
  session: 'open' | 'closed';
  regime: ReturnType<typeof getRegimeSnapshot>;
  pairs: FXSetupPairSnapshot[];
  headlines: ReturnType<typeof getCachedHeadlinesBundle>['headlines'];
  signals: VelocitySignal[];
}

const FX_SETUP_REFRESH_TTL_MS = 45_000;
const FX_SETUP_AI_MIN_INTERVAL_MS = 5 * 60_000;
const FX_SETUP_AI_CACHE_TTL_MS = 5 * 60_000;
let cachedContext: FXSetupContext = {
  timestamp: 0,
  session: 'closed',
  regime: getRegimeSnapshot(),
  pairs: [],
  headlines: [],
  signals: [],
};
let cachedSetups: TechnicalSetup[] = [];
let lastRefresh = 0;
let lastAISignature = '';
let lastAIRawResult: unknown = null;
let lastAINormalizedResult: AIFXSetup[] = [];
let lastAIError: string | null = null;
let lastAITriggeredAt = 0;

function scoreSignal(signal: VelocitySignal): number {
  return signal.zScore * 18 + Math.abs(signal.acceleration) * 12 + signal.moveBps / 4;
}

function computeEMA(candles: Candle[], length: number) {
  if (candles.length < length) return null;
  const multiplier = 2 / (length + 1);
  let ema = candles[0].close;
  for (let index = 1; index < candles.length; index++) {
    ema = candles[index].close * multiplier + ema * (1 - multiplier);
  }
  return Math.round(ema * 100000) / 100000;
}

function computeRSI(candles: Candle[], length = 14) {
  if (candles.length <= length) return null;
  let gains = 0;
  let losses = 0;
  for (let index = candles.length - length; index < candles.length; index++) {
    const delta = candles[index].close - candles[index - 1].close;
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return Math.round((100 - (100 / (1 + rs))) * 100) / 100;
}

function computeATR(candles: Candle[], length = 14) {
  if (candles.length <= length) return null;
  let total = 0;
  for (let index = candles.length - length; index < candles.length; index++) {
    const current = candles[index];
    const previous = candles[index - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    );
    total += tr;
  }
  return Math.round((total / length) * 100000) / 100000;
}

function buildContext(): FXSetupContext {
  const instruments = getG10FXInstruments();
  const quoteMap = new Map(getLatestQuotes().map(quote => [quote.instrumentId, quote]));
  const signals = getActiveSignals()
    .filter(signal => signal.assetClass === 'fx' && instruments.some(instrument => instrument.id === signal.pair))
    .sort((left, right) => scoreSignal(right) - scoreSignal(left));
  const headlines = getCachedHeadlinesBundle().headlines
    .filter(headline =>
      headline.actionability !== 'ignore' &&
      headline.affectedAssets.some(asset => instruments.some(instrument => instrument.id === asset)),
    )
    .slice(0, 12);
  const regime = getRegimeSnapshot();

  return {
    timestamp: Date.now(),
    session: signals.length > 0 || instruments.some(instrument => quoteMap.has(instrument.id)) ? 'open' : 'closed',
    regime,
    headlines,
    signals,
    pairs: instruments.map(instrument => ({
      id: instrument.id,
      displayName: instrument.displayName,
      tvSymbol: instrument.tvSymbol,
      currentPrice: quoteMap.get(instrument.id)?.price ?? null,
      hasActiveSignal: signals.some(signal => signal.pair === instrument.id),
      latestSignal: signals.find(signal => signal.pair === instrument.id) ?? null,
    })),
  };
}

function getDeterministicFXSetupsFromContext(context: FXSetupContext): TechnicalSetup[] {
  const setups: TechnicalSetup[] = [];

  for (const signal of context.signals.slice(0, 6)) {
    const factors = [
      `z-score ${signal.zScore.toFixed(1)}`,
      `acceleration ${signal.acceleration > 0 ? '+' : ''}${signal.acceleration.toFixed(3)}`,
      `move ${signal.moveBps.toFixed(1)}${signal.moveUnit}`,
    ];

    const alignedHeadline = context.headlines.find(headline => headline.affectedAssets.includes(signal.pair));
    if (alignedHeadline) {
      setups.push({
        id: `event-${signal.pair}-${signal.timestamp}`,
        type: 'event_continuation',
        pair: signal.displayName,
        direction: signal.direction === 'up' ? 'long' : 'short',
        confidence: Math.min(95, Math.round(55 + signal.zScore * 9)),
        invalidation: `Fade if ${signal.displayName} retraces half of the impulse move`,
        supportingFactors: [...factors, `headline: ${alignedHeadline.whyItMatters}`],
        staleAfter: signal.timestamp + 20 * 60_000,
        classificationMethod: 'deterministic',
      });
    }

    if (Math.abs(signal.acceleration) > 0.04 && signal.zScore >= 2.5) {
      setups.push({
        id: `break-${signal.pair}-${signal.timestamp}`,
        type: 'range_break_accel',
        pair: signal.displayName,
        direction: signal.direction === 'up' ? 'long' : 'short',
        confidence: Math.min(92, Math.round(50 + signal.zScore * 10)),
        invalidation: 'Invalidate on failed follow-through within 2 candles',
        supportingFactors: [...factors, 'impulse expansion still building'],
        staleAfter: signal.timestamp + 15 * 60_000,
        classificationMethod: 'deterministic',
      });
    }

    if (Math.abs(signal.acceleration) < 0.01 && signal.zScore >= 2.0) {
      setups.push({
        id: `reversal-${signal.pair}-${signal.timestamp}`,
        type: 'failed_break_reversal',
        pair: signal.displayName,
        direction: signal.direction === 'up' ? 'short' : 'long',
        confidence: Math.min(80, Math.round(45 + signal.zScore * 8)),
        invalidation: 'Cancel if fresh momentum resumes in original direction',
        supportingFactors: [...factors, 'momentum flattening after extension'],
        staleAfter: signal.timestamp + 10 * 60_000,
        classificationMethod: 'deterministic',
      });
    }
  }

  if (context.regime.usdBias !== 'mixed') {
    setups.push({
      id: `usd-regime-${context.regime.updatedAt}`,
      type: 'usd_regime_impulse',
      pair: 'USD basket',
      direction: context.regime.usdBias === 'stronger' ? 'long' : 'short',
      confidence: Math.min(90, 50 + context.regime.usdBreadth * 8),
      invalidation: 'Invalidate if USD breadth drops back to neutral',
      supportingFactors: [
        `usd breadth ${context.regime.usdBreadth}`,
        `regime ${context.regime.usdBias}`,
        context.regime.topShock ? `lead pair ${context.regime.topShock.displayName}` : 'no lead pair',
      ],
      staleAfter: Date.now() + 25 * 60_000,
      classificationMethod: 'deterministic',
    });
  }

  return setups
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 8);
}

function shouldUseFXSetupAI(context: FXSetupContext, deterministic: TechnicalSetup[]) {
  if (context.pairs.every(pair => pair.currentPrice == null)) return false;
  if (isMockMarketDataEnabled()) return context.pairs.some(pair => pair.currentPrice != null);
  if (context.signals.length > 0) return true;
  if (context.headlines.some(headline => headline.classificationMethod === 'ai' && headline.actionability === 'actionable')) return true;
  if (deterministic.length >= 2) return true;
  return false;
}

function buildAISignature(context: FXSetupContext) {
  const mockSymbols = isMockMarketDataEnabled() ? new Set(getMockSymbols()) : null;
  const signaturePairs = mockSymbols
    ? context.pairs.filter(pair => mockSymbols.has(pair.tvSymbol))
    : context.pairs;
  return JSON.stringify({
    regime: {
      usdBias: context.regime.usdBias,
      usdBreadth: context.regime.usdBreadth,
      leadPair: context.regime.topShock?.pair ?? null,
    },
    prices: signaturePairs.map(pair => ({
      id: pair.id,
      currentPrice: pair.currentPrice,
    })),
    signals: context.signals.slice(0, 6).map(signal => ({
      pair: signal.pair,
      z: Math.round(signal.zScore * 10) / 10,
      acceleration: Math.round(signal.acceleration * 1000) / 1000,
      direction: signal.direction,
    })),
    headlines: context.headlines.slice(0, 6).map(headline => ({
      id: headline.id,
      importance: headline.importance,
      classificationMethod: headline.classificationMethod,
    })),
  });
}

async function buildFXSetupSnapshot(context: FXSetupContext): Promise<FXSetupSnapshot> {
  const selectedPairs = isMockMarketDataEnabled()
    ? context.pairs.filter(pair => getMockSymbols().includes(pair.tvSymbol))
    : context.pairs;
  const mockMode = isMockMarketDataEnabled();
  const ranges = mockMode
    ? { '60': 36, '15': 48, '5': 72 }
    : { '60': 80, '15': 100, '5': 120 };

  const pairs = await Promise.all(selectedPairs.map(async pair => {
    const [candles60, candles15, candles5] = await Promise.all([
      getTradingViewCandles(pair.tvSymbol, '60', ranges['60']),
      getTradingViewCandles(pair.tvSymbol, '15', ranges['15']),
      getTradingViewCandles(pair.tvSymbol, '5', ranges['5']),
    ]);

    return {
      id: pair.id,
      displayName: pair.displayName,
      tvSymbol: pair.tvSymbol,
      currentPrice: pair.currentPrice,
      latestSignal: pair.latestSignal
        ? {
            zScore: pair.latestSignal.zScore,
            direction: pair.latestSignal.direction,
            acceleration: pair.latestSignal.acceleration,
            moveBps: pair.latestSignal.moveBps,
            moveUnit: pair.latestSignal.moveUnit,
          }
        : null,
      timeframes: {
        '60': {
          candles: candles60,
          indicators: {
            ema20: computeEMA(candles60, 20),
            ema50: computeEMA(candles60, 50),
            rsi14: computeRSI(candles60, 14),
            atr14: computeATR(candles60, 14),
          },
        },
        '15': {
          candles: candles15,
          indicators: {
            ema20: computeEMA(candles15, 20),
            ema50: computeEMA(candles15, 50),
            rsi14: computeRSI(candles15, 14),
            atr14: computeATR(candles15, 14),
          },
        },
        '5': {
          candles: candles5,
          indicators: {
            ema20: computeEMA(candles5, 20),
            ema50: computeEMA(candles5, 50),
            rsi14: computeRSI(candles5, 14),
            atr14: computeATR(candles5, 14),
          },
        },
      },
    };
  }));

  return {
    schemaVersion: 'fx-setup.v1',
    generatedAt: Date.now(),
    freshness: {
      quotesUpdatedAt: context.timestamp,
      candleWindowMinutes: 60 * ranges['60'],
    },
    confidenceInputs: {
      pairCount: pairs.length,
      headlineCount: context.headlines.length,
      signalCount: context.signals.length,
    },
    provenance: {
      source: 'tradingview',
      timeframes: ['60', '15', '5'],
    },
    ontology: buildFXSetupOntology(),
    regime: {
      usdBias: context.regime.usdBias,
      usdBreadth: context.regime.usdBreadth,
      leadPair: context.regime.topShock?.pair ?? null,
    },
    headlines: context.headlines.map(headline => ({
      id: headline.id,
      text: headline.text,
      importance: headline.importance,
      affectedAssets: headline.affectedAssets,
      timestamp: headline.timestamp,
    })),
    pairs,
  };
}

function toTechnicalSetup(setup: AIFXSetup): TechnicalSetup {
  const instrument = getInstrument(setup.pair);
  const displayName = instrument?.displayName || setup.pair;
  return {
    id: `ai-${setup.pair}-${Date.now()}`,
    type: setup.setupType,
    pair: displayName,
    direction: setup.bias === 'short' ? 'short' : 'long',
    confidence: setup.confidence,
    invalidation: setup.invalidation,
    supportingFactors: [setup.reasoning, `${setup.quality} quality`, setup.entryZone].filter(Boolean),
    staleAfter: Date.now() + 20 * 60_000,
    entryZone: setup.entryZone,
    targets: setup.targets,
    timeframeAlignment: setup.timeframeAlignment,
    quality: setup.quality,
    reasoning: setup.reasoning,
    sourceTimeframes: setup.sourceTimeframes,
    classificationMethod: 'ai',
  };
}

export async function refreshFXSetups(): Promise<void> {
  cachedContext = buildContext();
  const deterministic = getDeterministicFXSetupsFromContext(cachedContext);
  const aiSignature = buildAISignature(cachedContext);

  if (!shouldUseFXSetupAI(cachedContext, deterministic)) {
    cachedSetups = deterministic;
    lastRefresh = Date.now();
    return;
  }

  if (aiSignature === lastAISignature && Date.now() - lastRefresh < FX_SETUP_AI_CACHE_TTL_MS) {
    return;
  }

  if (!isMockMarketDataEnabled() && lastAITriggeredAt > 0 && Date.now() - lastAITriggeredAt < FX_SETUP_AI_MIN_INTERVAL_MS) {
    if (cachedSetups.length === 0) {
      cachedSetups = deterministic;
      lastRefresh = Date.now();
    }
    return;
  }

  try {
    lastAITriggeredAt = Date.now();
    const snapshot = await buildFXSetupSnapshot(cachedContext);
    const result = await evaluateFXSetups(snapshot);
    const minConfidence = Number(process.env.AI_FX_SETUP_MIN_CONFIDENCE || 60);
    lastAIRawResult = result.raw ?? null;
    lastAINormalizedResult = result.normalized ?? [];
    lastAIError = null;

    if (!result.ok || !result.data) {
      lastAIError = result.error || 'fx setup ai unavailable';
      cachedSetups = deterministic.map(setup => ({
        ...setup,
        fallbackReason: result.error || 'fx setup ai unavailable',
      }));
      lastAISignature = aiSignature;
      lastRefresh = Date.now();
      return;
    }

    const aiSetups = result.data
      .filter(setup => !setup.skip && setup.quality !== 'skip' && setup.confidence >= minConfidence)
      .map(toTechnicalSetup)
      .slice(0, 8);

    cachedSetups = aiSetups.length > 0
      ? aiSetups
      : deterministic.map(setup => ({
          ...setup,
          fallbackReason: 'fx setup ai returned no qualified setups',
        }));
    if (aiSetups.length === 0) {
      lastAIError = 'fx setup ai returned no qualified setups';
    }
    lastAISignature = aiSignature;
    lastRefresh = Date.now();
  } catch (error) {
    lastAIRawResult = null;
    lastAINormalizedResult = [];
    lastAIError = (error as Error).message;
    cachedSetups = deterministic.map(setup => ({
      ...setup,
      fallbackReason: (error as Error).message,
    }));
    lastRefresh = Date.now();
  }
}

export function getFXSetupContext(): FXSetupContext {
  if (cachedContext.timestamp === 0) {
    cachedContext = buildContext();
  }
  return cachedContext;
}

export function getTechnicalSetups(): TechnicalSetup[] {
  if (Date.now() - lastRefresh > FX_SETUP_REFRESH_TTL_MS && cachedSetups.length === 0) {
    cachedContext = buildContext();
    cachedSetups = getDeterministicFXSetupsFromContext(cachedContext);
  }
  return cachedSetups.slice(0, 8);
}

export function getDeterministicFXSetups(): TechnicalSetup[] {
  return getDeterministicFXSetupsFromContext(buildContext());
}

export function getFXSetupUniverse() {
  return G10_FX_INSTRUMENT_IDS.slice();
}

export function getFXSetupAIDebug() {
  return {
    lastRefresh,
    lastAITriggeredAt,
    lastAISignature,
    lastAIError,
    raw: lastAIRawResult,
    normalized: lastAINormalizedResult,
  };
}

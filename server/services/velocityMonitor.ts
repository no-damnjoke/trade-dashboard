import { addAlert } from './alertEngine.js';
import { getRealtimeInstruments, type AssetClass, type MarketInstrument } from './instruments.js';
import { isMockMarketDataEnabled } from './mockMarketData.js';
import { getTradingViewQuote } from './tradingview.js';
import { logActivity } from './activityLog.js';

export interface PricePoint {
  price: number;
  timestamp: number;
}

export interface VelocitySignal {
  pair: string;
  displayName: string;
  assetClass: AssetClass;
  currentPrice: number;
  velocity: number;
  acceleration: number;
  zScore: number;
  moveBps: number;
  moveUnit: 'pips' | 'bps';
  direction: 'up' | 'down';
  severity: 'critical' | 'high' | 'medium';
  timestamp: number;
  normalizedMove: number;
  actionable: boolean;
}

interface PairState {
  history: PricePoint[];
  velocities: number[];
  lastAlert: number;
}

interface QuoteSnapshot {
  instrumentId: string;
  price: number;
  previousClose: number;
  timestamp: number;
}

const WINDOW_SIZE = 60;
const SIGNAL_TTL = 15 * 60_000;

const pairStates = new Map<string, PairState>();
const latestQuotes = new Map<string, QuoteSnapshot>();
const activeSignals: VelocitySignal[] = [];
let lastPollTime = 0;
const QUOTE_FRESHNESS_MS = 2 * 60_000;

interface AssetCalibration {
  moveUnit: VelocitySignal['moveUnit'];
  minMoveThreshold: number;
  minSampleCount: number;
  velocityHistory: number;
  baselineAlpha: number;
  cooldownMs: number;
  gapResetMs: number;
  zMedium: number;
  zHigh: number;
  zCritical: number;
}

const ASSET_CALIBRATIONS: Record<AssetClass, AssetCalibration> = {
  fx: {
    moveUnit: 'pips',
    minMoveThreshold: 18,
    minSampleCount: 10,
    velocityHistory: 120,
    baselineAlpha: 0.08,
    cooldownMs: 5 * 60_000,
    gapResetMs: 8 * 60 * 60_000,
    zMedium: 2.0,
    zHigh: 2.5,
    zCritical: 3.0,
  },
  crypto: {
    moveUnit: 'bps',
    minMoveThreshold: 45,
    minSampleCount: 12,
    velocityHistory: 180,
    baselineAlpha: 0.06,
    cooldownMs: 4 * 60_000,
    gapResetMs: 2 * 60 * 60_000,
    zMedium: 2.2,
    zHigh: 2.8,
    zCritical: 3.4,
  },
  rate: {
    moveUnit: 'bps',
    minMoveThreshold: 2.5,
    minSampleCount: 8,
    velocityHistory: 90,
    baselineAlpha: 0.12,
    cooldownMs: 8 * 60_000,
    gapResetMs: 18 * 60 * 60_000,
    zMedium: 1.8,
    zHigh: 2.3,
    zCritical: 2.8,
  },
  index: {
    moveUnit: 'bps',
    minMoveThreshold: 35,
    minSampleCount: 8,
    velocityHistory: 90,
    baselineAlpha: 0.1,
    cooldownMs: 6 * 60_000,
    gapResetMs: 18 * 60 * 60_000,
    zMedium: 1.9,
    zHigh: 2.4,
    zCritical: 3.0,
  },
  commodity: {
    moveUnit: 'bps',
    minMoveThreshold: 30,
    minSampleCount: 8,
    velocityHistory: 100,
    baselineAlpha: 0.1,
    cooldownMs: 6 * 60_000,
    gapResetMs: 12 * 60 * 60_000,
    zMedium: 2.0,
    zHigh: 2.5,
    zCritical: 3.1,
  },
};

function isFXMarketOpen(now = new Date()): boolean {
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay();
  const etHour = (utcHour - 5 + 24) % 24;
  const etDay = utcHour < 5 ? (utcDay + 6) % 7 : utcDay;

  if (etDay === 6) return false;
  if (etDay === 0 && etHour < 17) return false;
  if (etDay === 5 && etHour >= 17) return false;

  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  if (month === 11 && date === 25) return false;
  if (month === 0 && date === 1) return false;

  return true;
}

function isInstrumentOpen(instrument: MarketInstrument): boolean {
  if (isMockMarketDataEnabled()) return true;
  if (instrument.session === '24x7') return true;
  if (instrument.session === '24x5') return isFXMarketOpen();
  return true;
}

function getOrCreateState(id: string): PairState {
  let state = pairStates.get(id);
  if (!state) {
    state = { history: [], velocities: [], lastAlert: 0 };
    pairStates.set(id, state);
  }
  return state;
}

function computeEWMA(values: number[], alpha: number): number {
  if (values.length === 0) return 0;
  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = alpha * values[i] + (1 - alpha) * ewma;
  }
  return ewma;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 1;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) || 1;
}

function getCalibration(instrument: MarketInstrument): AssetCalibration {
  const calibration = ASSET_CALIBRATIONS[instrument.assetClass];
  if (instrument.assetClass !== 'fx') return calibration;

  if (instrument.id.includes('USD') && !instrument.id.startsWith('USD')) {
    return {
      ...calibration,
      minMoveThreshold: 15,
    };
  }

  return calibration;
}

function normalizeMove(instrument: MarketInstrument, current: number, previous: number): number {
  if (instrument.assetClass === 'fx' && instrument.pipMultiplier) {
    return Math.abs(current - previous) * instrument.pipMultiplier;
  }

  if (instrument.assetClass === 'rate') {
    return Math.abs(current - previous) * 100;
  }

  const base = previous || current || 1;
  return Math.abs((current - previous) / base) * 10_000;
}

function processPrice(instrument: MarketInstrument, price: number): VelocitySignal | null {
  const now = Date.now();
  const state = getOrCreateState(instrument.id);
  const calibration = getCalibration(instrument);
  const lastTimestamp = state.history[state.history.length - 1]?.timestamp ?? 0;

  if (lastTimestamp > 0 && now - lastTimestamp > calibration.gapResetMs) {
    state.history = [];
    state.velocities = [];
  }

  state.history.push({ price, timestamp: now });

  if (state.history.length > WINDOW_SIZE) {
    state.history.shift();
  }

  if (state.history.length < 3) return null;

  const n = state.history.length;
  const p0 = state.history[n - 3];
  const p1 = state.history[n - 2];
  const p2 = state.history[n - 1];
  const dt = (p2.timestamp - p1.timestamp) / 1000;
  const dt0 = (p1.timestamp - p0.timestamp) / 1000;
  if (dt <= 0 || dt0 <= 0) return null;

  const instantMove = normalizeMove(instrument, p2.price, p1.price);
  const prevMove = normalizeMove(instrument, p1.price, p0.price);
  const velocity = instantMove / dt;
  const acceleration = (velocity - (prevMove / dt0)) / ((dt + dt0) / 2);

  state.velocities.push(Math.abs(velocity));
  if (state.velocities.length > calibration.velocityHistory) {
    state.velocities.shift();
  }

  if (state.velocities.length < calibration.minSampleCount) return null;

  const baselineValues = state.velocities.slice(0, -1);
  const baseline = computeEWMA(baselineValues, calibration.baselineAlpha);
  const stdDev = computeStdDev(baselineValues, baseline);
  const zScore = (Math.abs(velocity) - baseline) / stdDev;
  const moveBps = normalizeMove(instrument, p2.price, state.history[0].price);

  if (zScore < calibration.zMedium || moveBps < calibration.minMoveThreshold) return null;
  if (now - state.lastAlert < calibration.cooldownMs) return null;

  const severity: VelocitySignal['severity'] =
    zScore >= calibration.zCritical ? 'critical' :
    zScore >= calibration.zHigh ? 'high' :
    'medium';

  const signal: VelocitySignal = {
    pair: instrument.id,
    displayName: instrument.displayName,
    assetClass: instrument.assetClass,
    currentPrice: price,
    velocity: Math.round(velocity * 1000) / 1000,
    acceleration: Math.round(acceleration * 1000) / 1000,
    zScore: Math.round(zScore * 100) / 100,
    moveBps: Math.round(moveBps * 10) / 10,
    moveUnit: calibration.moveUnit,
    direction: p2.price >= p1.price ? 'up' : 'down',
    severity,
    timestamp: now,
    normalizedMove: Math.round(instantMove * 100) / 100,
    actionable: instrument.realtimeEligible,
  };

  state.lastAlert = now;
  activeSignals.unshift(signal);
  pruneSignals();

  logActivity({
    timestamp: now,
    type: 'velocity:signal',
    meta: {
      pair: signal.pair,
      displayName: signal.displayName,
      assetClass: signal.assetClass,
      direction: signal.direction,
      severity: signal.severity,
      zScore: signal.zScore,
      velocity: signal.velocity,
      acceleration: signal.acceleration,
      moveBps: signal.moveBps,
      moveUnit: signal.moveUnit,
    },
  });

  addAlert({
    type: 'price_shock',
    category: instrument.assetClass,
    source: instrument.signalSource,
    assetIds: [instrument.id],
    reason: `${instrument.displayName} ${signal.direction} shock with z=${signal.zScore.toFixed(1)}`,
    message: `${instrument.displayName} ${signal.direction === 'up' ? '↑' : '↓'} ${signal.moveBps.toFixed(1)}${signal.moveUnit} | z=${signal.zScore.toFixed(1)} | acc=${signal.acceleration.toFixed(3)}`,
    severity,
    pair: instrument.displayName,
    change: signal.moveBps,
    suppressed: false,
  });

  return signal;
}

function pruneSignals() {
  const cutoff = Date.now() - SIGNAL_TTL;
  for (let i = activeSignals.length - 1; i >= 0; i--) {
    if (activeSignals[i].timestamp < cutoff) {
      activeSignals.splice(i, 1);
    }
  }
}

async function fetchQuote(instrument: MarketInstrument): Promise<QuoteSnapshot | null> {
  try {
    const tvQuote = await getTradingViewQuote(instrument.tvSymbol);
    if (!tvQuote) return null;
    if (instrument.session === 'market-hours' && tvQuote.session === 'out_of_session') return null;
    if (Date.now() - tvQuote.updatedAt > QUOTE_FRESHNESS_MS) return null;

    return {
      instrumentId: instrument.id,
      price: tvQuote.price,
      previousClose: tvQuote.prevClose || tvQuote.price,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

async function pollBatch(instruments: MarketInstrument[]): Promise<void> {
  const results = await Promise.all(instruments.map(fetchQuote));
  for (let i = 0; i < instruments.length; i++) {
    const quote = results[i];
    if (quote) {
      latestQuotes.set(instruments[i].id, quote);
      processPrice(instruments[i], quote.price);
    }
  }
}

export async function pollVelocityMonitor(): Promise<void> {
  lastPollTime = Date.now();
  const open = getRealtimeInstruments().filter(isInstrumentOpen);
  const BATCH_SIZE = 8;

  for (let i = 0; i < open.length; i += BATCH_SIZE) {
    await pollBatch(open.slice(i, i + BATCH_SIZE));
  }
}

export function getActiveSignals(): VelocitySignal[] {
  pruneSignals();
  return activeSignals.slice(0, 40);
}

export function getLatestQuotes(): QuoteSnapshot[] {
  return Array.from(latestQuotes.values());
}

export function getMonitorStatus() {
  const realtime = getRealtimeInstruments();
  const fxOpen = isFXMarketOpen();
  const assetsOpen = realtime.some(instrument => isInstrumentOpen(instrument));
  return {
    assetsTracked: realtime.length,
    pairsTracked: realtime.filter(instrument => instrument.assetClass === 'fx').length,
    cryptoTracked: realtime.filter(instrument => instrument.assetClass === 'crypto').length,
    samplesCollected: Array.from(pairStates.values()).reduce((sum, state) => sum + state.history.length, 0),
    marketOpen: assetsOpen,
    fxMarketOpen: fxOpen,
    lastPollTime,
  };
}

export function getRegimeSnapshot() {
  const signals = getActiveSignals();
  const usdUp = signals.filter(signal =>
    signal.assetClass === 'fx' &&
    signal.actionable &&
    ((signal.pair.startsWith('USD') && signal.direction === 'up') ||
      (!signal.pair.startsWith('USD') && signal.direction === 'down'))
  ).length;

  const usdDown = signals.filter(signal =>
    signal.assetClass === 'fx' &&
    signal.actionable &&
    ((signal.pair.startsWith('USD') && signal.direction === 'down') ||
      (!signal.pair.startsWith('USD') && signal.direction === 'up'))
  ).length;

  const cryptoImpulse = signals
    .filter(signal => signal.assetClass === 'crypto')
    .sort((left, right) => right.zScore - left.zScore)[0];

  return {
    usdBias: usdUp > usdDown ? 'stronger' : usdDown > usdUp ? 'weaker' : 'mixed',
    usdBreadth: Math.abs(usdUp - usdDown),
    topShock: signals[0] ?? null,
    cryptoImpulse: cryptoImpulse ?? null,
    updatedAt: Date.now(),
  };
}

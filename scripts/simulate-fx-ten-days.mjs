const BASE_URL = process.env.SIM_BASE_URL || 'http://127.0.0.1:3001';
const BAR_MS = 5 * 60 * 1000;
const DAY_BARS = 24 * 12;
const TOTAL_DAYS = 10;
const CHECKPOINTS = (process.env.SIM_CHECKPOINTS || '3,6,8,10')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(value => Number.isFinite(value) && value > 0);

async function post(path, body = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

async function get(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

function aggregateCandles(candles5, barsPerCandle) {
  const out = [];
  for (let index = 0; index < candles5.length; index += barsPerCandle) {
    const chunk = candles5.slice(index, index + barsPerCandle);
    if (chunk.length < barsPerCandle) break;
    out.push({
      time: chunk[chunk.length - 1].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return out;
}

function makeCandle(previousClose, nextClose, time, volume = 100) {
  const high = Math.max(previousClose, nextClose) + Math.abs(nextClose - previousClose) * 0.35 + previousClose * 0.00008;
  const low = Math.min(previousClose, nextClose) - Math.abs(nextClose - previousClose) * 0.35 - previousClose * 0.00008;
  return {
    time,
    open: Number(previousClose.toFixed(6)),
    high: Number(high.toFixed(6)),
    low: Number(low.toFixed(6)),
    close: Number(nextClose.toFixed(6)),
    volume,
  };
}

function buildSeries(symbol, startPrice, pattern) {
  const totalBars = DAY_BARS * TOTAL_DAYS;
  const startTime = Date.now() - totalBars * BAR_MS;
  const candles5 = [];
  let price = startPrice;

  for (let index = 0; index < totalBars; index++) {
    let next = price;
    if (pattern === 'usdjpy') {
      next += Math.sin(index / 17) * 0.006;
      next += index < totalBars * 0.55 ? 0.0025 : -0.001;

      // Very obvious liquidity sweep reversal:
      // grind up into equal highs, sweep above them, then hard bearish displacement lower.
      if (index > totalBars - 120 && index < totalBars - 80) next += 0.01;
      if (index > totalBars - 80 && index < totalBars - 68) next += 0.015;
      if (index === totalBars - 67) next += 0.55;
      if (index === totalBars - 66) next += 0.22;
      if (index === totalBars - 65) next -= 0.95;
      if (index === totalBars - 64) next -= 0.52;
      if (index > totalBars - 64 && index < totalBars - 56) next -= 0.09;
      if (index > totalBars - 56 && index < totalBars - 48) next += 0.03;
      if (index > totalBars - 48 && index < totalBars - 40) next -= 0.04;
    } else if (pattern === 'eurusd') {
      next += Math.sin(index / 13) * 0.00025;
      next += index < totalBars * 0.4 ? -0.00005 : 0.00018;

      // Very obvious bullish displacement -> fair value gap -> retest -> continuation.
      if (index > totalBars - 120 && index < totalBars - 90) next -= 0.00012;
      if (index === totalBars - 54) next += 0.0042;
      if (index === totalBars - 53) next += 0.0034;
      if (index === totalBars - 52) next += 0.0026;
      if (index === totalBars - 51) next += 0.0018;
      if (index > totalBars - 46 && index < totalBars - 42) next -= 0.00075;
      if (index === totalBars - 41) next -= 0.00235;
      if (index === totalBars - 40) next -= 0.00125;
      if (index > totalBars - 40 && index < totalBars - 34) next += 0.00155;
      if (index > totalBars - 34 && index < totalBars - 28) next += 0.00085;
    }

    const candle = makeCandle(price, next, startTime + index * BAR_MS, 100 + (index % 30));
    candles5.push(candle);
    price = next;
  }

  return {
    symbol,
    prevClose: candles5[0].open,
    candles5,
    candles15: aggregateCandles(candles5, 3),
    candles60: aggregateCandles(candles5, 12),
  };
}

function sliceScenario(series, day) {
  const bars5 = day * DAY_BARS;
  const bars15 = Math.floor(bars5 / 3);
  const bars60 = Math.floor(bars5 / 12);
  return {
    symbol: series.symbol,
    prevClose: series.prevClose,
    candles: {
      '5': series.candles5.slice(0, bars5),
      '15': series.candles15.slice(0, bars15),
      '60': series.candles60.slice(0, bars60),
    },
  };
}

function summarizeFx(status) {
  const fx = status.usage?.byAgent?.['fx-setup'] || {};
  const recent = status.usage?.recent?.find(item => item.agent === 'fx-setup');
  return {
    requests: fx.requests || 0,
    success: fx.success || 0,
    failure: fx.failure || 0,
    lastLatencyMs: recent?.latencyMs || null,
    lastStatusCode: recent?.statusCode || null,
    rateLimitRemaining: fx.rateLimit?.remaining || null,
    rateLimitReset: fx.rateLimit?.reset || null,
  };
}

async function runCheckpoint(day, seriesList) {
  for (const series of seriesList) {
    await post('/api/dev/mock-market/scenario', sliceScenario(series, day));
  }

  const started = Date.now();
  await post('/api/dev/mock-market/evaluate', {});
  const elapsedMs = Date.now() - started;
  const [status, fxSetup] = await Promise.all([
    get('/api/ai-status'),
    get('/api/fx-setup'),
  ]);

  const summary = {
    day,
    evaluationMs: elapsedMs,
    usage: summarizeFx(status),
    setups: (fxSetup.setups || []).slice(0, 3).map(setup => ({
      pair: setup.pair,
      type: setup.type,
      method: setup.classificationMethod,
      confidence: setup.confidence,
      quality: setup.quality,
      reasoning: setup.reasoning,
    })),
  };

  console.log(JSON.stringify(summary));

  // Re-evaluate unchanged state to verify no extra GPT trigger.
  const beforeRequests = summary.usage.requests;
  await post('/api/dev/mock-market/evaluate', {});
  const statusAfter = await get('/api/ai-status');
  const afterRequests = summarizeFx(statusAfter).requests;
  console.log(JSON.stringify({
    day,
    unchangedRecheck: true,
    beforeRequests,
    afterRequests,
    unchangedDidTrigger: afterRequests !== beforeRequests,
  }));
}

async function main() {
  const usdjpy = buildSeries('OANDA:USDJPY', 149.2, 'usdjpy');
  const eurusd = buildSeries('OANDA:EURUSD', 1.082, 'eurusd');

  await post('/api/ai-status/reset', {});
  await post('/api/dev/mock-market/reset', {});

  console.log('Running 10-day FX simulation for USDJPY and EURUSD');
  for (const day of CHECKPOINTS) {
    await runCheckpoint(day, [usdjpy, eurusd]);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

const BASE_URL = process.env.SIM_BASE_URL || 'http://127.0.0.1:3001';
const SYMBOL = process.env.SIM_SYMBOL || 'OANDA:USDJPY';
const START_PRICE = Number(process.env.SIM_START_PRICE || 149.2);
const TICK_MS = Number(process.env.SIM_TICK_MS || 1500);

const sequence = [
  START_PRICE,
  START_PRICE,
  START_PRICE - 0.03,
  START_PRICE - 0.08,
  START_PRICE - 0.08,
  START_PRICE - 0.12,
  START_PRICE - 0.18,
  START_PRICE - 0.11,
  START_PRICE - 0.06,
  START_PRICE - 0.06,
  START_PRICE - 0.02,
];

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }

  return response.json();
}

async function get(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }
  return response.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function summarizeUsage(status) {
  const usage = status.usage || {};
  const headline = usage.byAgent?.['headline-impact'] || {};
  const fx = usage.byAgent?.['fx-setup'] || {};
  return {
    headlineRequests: headline.requests || 0,
    fxRequests: fx.requests || 0,
    fxRemaining: fx.rateLimit?.remaining || null,
    fxReset: fx.rateLimit?.reset || null,
  };
}

async function main() {
  console.log(`Resetting mock market on ${BASE_URL}`);
  await post('/api/dev/mock-market/reset', {});

  let previousPrice = null;
  for (let index = 0; index < sequence.length; index++) {
    const price = Number(sequence[index].toFixed(3));
    if (price === previousPrice) {
      console.log(`[tick ${index}] unchanged ${price} -> skipping API trigger`);
      await sleep(TICK_MS);
      continue;
    }

    previousPrice = price;
    const update = await post('/api/dev/mock-market/price', {
      symbol: SYMBOL,
      price,
      prevClose: START_PRICE,
    });
    const [aiStatus, fxSetup] = await Promise.all([
      get('/api/ai-status'),
      get('/api/fx-setup'),
    ]);

    const usage = summarizeUsage(aiStatus);
    const topSetup = fxSetup.setups?.[0]
      ? {
          pair: fxSetup.setups[0].pair,
          type: fxSetup.setups[0].type,
          method: fxSetup.setups[0].classificationMethod,
          confidence: fxSetup.setups[0].confidence,
        }
      : null;

    console.log(JSON.stringify({
      tick: index,
      changed: update.changed,
      price,
      usage,
      topSetup,
    }));

    await sleep(TICK_MS);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

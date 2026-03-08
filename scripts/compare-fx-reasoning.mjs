import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHECKPOINTS = process.env.SIM_CHECKPOINTS || '3,6,8,10';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('backend start timeout')), 15000);

    const onData = chunk => {
      const text = chunk.toString();
      buffer += text;
      if (buffer.includes('Market Monitor backend running')) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', chunk => {
      buffer += chunk.toString();
    });
    child.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`backend exited ${code}`));
    });
  });
}

async function runCase(reasoning) {
  const backend = spawn('./node_modules/.bin/tsx', ['--env-file=.env', 'server/index.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DISABLE_HEADLINE_POLLING: 'true',
      DISABLE_OPPORTUNITY_POLLING: 'true',
      DISABLE_FX_SETUP_POLLING: 'true',
      DISABLE_VELOCITY_POLLING: 'true',
      AI_FX_SETUP_REASONING_EFFORT: reasoning,
      AI_FX_SETUP_MIN_CONFIDENCE: '45',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(backend);
    const sim = spawn('node', ['./scripts/simulate-fx-ten-days.mjs'], {
      cwd: ROOT,
      env: {
        ...process.env,
        SIM_BASE_URL: BASE_URL,
        SIM_CHECKPOINTS: CHECKPOINTS,
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    const lines = [];
    sim.stdout.on('data', chunk => {
      const text = chunk.toString();
      process.stdout.write(`[${reasoning}] ${text}`);
      lines.push(...text.split('\n').filter(Boolean));
    });

    const exitCode = await new Promise(resolve => sim.on('exit', resolve));
    if (exitCode !== 0) throw new Error(`sim exited ${exitCode}`);

    const parsed = lines
      .filter(line => line.startsWith('{'))
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const checkpoints = parsed.filter(entry => !entry.unchangedRecheck);
    const unchanged = parsed.filter(entry => entry.unchangedRecheck);
    const evaluationMs = checkpoints.map(entry => entry.evaluationMs).filter(Boolean);
    const latencyMs = checkpoints.map(entry => entry.usage?.lastLatencyMs).filter(Boolean);

    return {
      reasoning,
      checkpoints: checkpoints.length,
      avgEvaluationMs: evaluationMs.length ? Math.round(evaluationMs.reduce((a, b) => a + b, 0) / evaluationMs.length) : null,
      avgModelLatencyMs: latencyMs.length ? Math.round(latencyMs.reduce((a, b) => a + b, 0) / latencyMs.length) : null,
      unchangedRetriggers: unchanged.filter(entry => entry.unchangedDidTrigger).length,
      raw: parsed,
    };
  } finally {
    backend.kill('SIGTERM');
    await sleep(1000);
  }
}

async function main() {
  const low = await runCase('low');
  const medium = await runCase('medium');
  console.log(JSON.stringify({ low, medium }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

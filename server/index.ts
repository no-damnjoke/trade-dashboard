import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { headlinesRouter } from './routes/headlines.js';
import { heatmapRouter } from './routes/heatmap.js';
import { predictionsRouter } from './routes/predictions.js';
import { alertsRouter } from './routes/alerts.js';
import { opportunitiesRouter } from './routes/opportunities.js';
import { velocityRouter } from './routes/velocity.js';
import { setupsRouter } from './routes/setups.js';
import { fxSetupRouter } from './routes/fxSetup.js';
import { aiStatusRouter } from './routes/aiStatus.js';
import { devMockMarketRouter } from './routes/devMockMarket.js';
import { marketStateRouter } from './routes/marketState.js';
import { marketFundamentalsRouter } from './routes/marketFundamentals.js';
import { refreshMarketFundamentalsCache, refreshMarketData } from './services/marketFundamentals.js';
import { pollVelocityMonitor } from './services/velocityMonitor.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DISABLE_VELOCITY_POLLING = process.env.DISABLE_VELOCITY_POLLING === 'true';
const ENABLE_DEV_ROUTES = process.env.ENABLE_DEV_ROUTES === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = process.env.HOST || (NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.use('/api/headlines', headlinesRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/velocity', velocityRouter);
app.use('/api/setups', setupsRouter);
app.use('/api/fx-setup', fxSetupRouter);
app.use('/api/ai-status', aiStatusRouter);
app.use('/api/market-state', marketStateRouter);
app.use('/api/market-fundamentals', marketFundamentalsRouter);

if (ENABLE_DEV_ROUTES || NODE_ENV !== 'production') {
  app.use('/api/dev/mock-market', devMockMarketRouter);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve built frontend in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

if (!DISABLE_VELOCITY_POLLING) {
  pollVelocityMonitor();
  setInterval(() => {
    void pollVelocityMonitor();
  }, 30_000);
}

void refreshMarketFundamentalsCache();  // full refresh on startup
setInterval(() => void refreshMarketData('fast'), 5 * 60_000);        // 5 min
setInterval(() => void refreshMarketData('medium'), 2 * 60 * 60_000); // 2 hours
setInterval(() => void refreshMarketData('slow'), 6 * 60 * 60_000);   // 6 hours

app.listen(PORT, HOST, () => {
  console.log(`[BE] Market Monitor backend running on http://${HOST}:${PORT}`);
});

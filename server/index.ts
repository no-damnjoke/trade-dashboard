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
import { pollVelocityMonitor } from './services/velocityMonitor.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DISABLE_VELOCITY_POLLING = process.env.DISABLE_VELOCITY_POLLING === 'true';

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
app.use('/api/dev/mock-market', devMockMarketRouter);
app.use('/api/market-state', marketStateRouter);

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

app.listen(PORT, () => {
  console.log(`[BE] Market Monitor backend running on http://localhost:${PORT}`);
});

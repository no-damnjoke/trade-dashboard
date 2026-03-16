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
import { refreshContextBrief, getContextBrief } from './services/contextBrief.js';
import { getAPILog, getAPIStats } from './services/apiTracker.js';
import { writeDigest } from './services/dailyDigest.js';
import { activityLogRouter } from './routes/activityLog.js';
import { pruneOldLogs } from './services/activityLog.js';

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
app.use('/api/activity-log', activityLogRouter);

if (ENABLE_DEV_ROUTES || NODE_ENV !== 'production') {
  app.use('/api/dev/mock-market', devMockMarketRouter);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/context-brief', (_req, res) => {
  res.json(getContextBrief());
});

app.get('/api/api-tracker', (_req, res) => {
  res.json({ stats: getAPIStats(), recent: getAPILog(100) });
});

// Serve built frontend in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');

// Activity log viewer (standalone mobile-friendly page)
app.get('/logs', (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'activityLog.html'));
});

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


void refreshContextBrief();
setInterval(() => void refreshContextBrief(), 6 * 60 * 60_000);

// Prune old activity logs (keep 14 days)
pruneOldLogs();
setInterval(() => pruneOldLogs(), 24 * 60 * 60_000);

// Daily digest — write at 22:00 UTC, reset session memory
const DIGEST_HOUR_UTC = 22;
function scheduleNextDigest() {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(DIGEST_HOUR_UTC, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  const delay = target.getTime() - now.getTime();
  setTimeout(() => {
    try {
      writeDigest();
    } catch (error) {
      console.error('[Digest] Failed to write daily digest:', (error as Error).message);
    }
    scheduleNextDigest();
  }, delay);
}
scheduleNextDigest();

app.listen(PORT, HOST, () => {
  console.log(`[BE] Market Monitor backend running on http://${HOST}:${PORT}`);
});

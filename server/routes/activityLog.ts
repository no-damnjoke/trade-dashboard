import { Router } from 'express';
import { getRecentActivity, loadDayLog, listLogDates, type ActivityType } from '../services/activityLog.js';

export const activityLogRouter = Router();

// GET /api/activity-log — recent in-memory entries
// ?limit=50&type=ai:result
activityLogRouter.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const type = req.query.type as ActivityType | undefined;
  res.json({ entries: getRecentActivity(limit, type) });
});

// GET /api/activity-log/day?date=2026-03-16
// Returns full day log from JSONL file
activityLogRouter.get('/day', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const type = req.query.type as ActivityType | undefined;
  let entries = loadDayLog(date);
  if (type) {
    entries = entries.filter(e => e.type === type);
  }
  res.json({ date: date || new Date().toISOString().slice(0, 10), entries });
});

// GET /api/activity-log/dates — list available log dates
activityLogRouter.get('/dates', (_req, res) => {
  res.json({ dates: listLogDates() });
});

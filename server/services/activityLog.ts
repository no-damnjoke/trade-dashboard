import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'logs');

export type ActivityType =
  | 'ai:invoke'
  | 'ai:result'
  | 'headline:classified'
  | 'opportunity:cycle'
  | 'velocity:signal'
  | 'system:error';

export interface ActivityEntry {
  timestamp: number;
  type: ActivityType;
  agent?: string;
  model?: string;
  latencyMs?: number;
  ok?: boolean;
  error?: string;
  input?: unknown;
  output?: unknown;
  meta?: Record<string, unknown>;
}

// In-memory buffer for recent entries (queryable via API)
const recentEntries: ActivityEntry[] = [];
const MAX_RECENT = 200;

function ensureLogDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function logFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(DATA_DIR, `${date}.jsonl`);
}

export function logActivity(entry: ActivityEntry): void {
  // Push to in-memory ring buffer
  recentEntries.unshift(entry);
  if (recentEntries.length > MAX_RECENT) recentEntries.pop();

  // Append to daily JSONL file (non-blocking)
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logFilePath(), line, 'utf-8');
  } catch (err) {
    console.error('[ActivityLog] write failed:', (err as Error).message);
  }
}

export function getRecentActivity(limit = 50, type?: ActivityType): ActivityEntry[] {
  const filtered = type ? recentEntries.filter(e => e.type === type) : recentEntries;
  return filtered.slice(0, limit);
}

export function loadDayLog(date?: string): ActivityEntry[] {
  const d = date || new Date().toISOString().slice(0, 10);
  const filePath = path.join(DATA_DIR, `${d}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as ActivityEntry);
  } catch {
    return [];
  }
}

export function listLogDates(): string[] {
  ensureLogDir();
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''))
    .sort()
    .reverse();
}

// Prune logs older than N days
const MAX_LOG_DAYS = 14;
export function pruneOldLogs(): void {
  ensureLogDir();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.jsonl'));
  if (files.length <= MAX_LOG_DAYS) return;

  const sorted = files.sort();
  const toDelete = sorted.slice(0, sorted.length - MAX_LOG_DAYS);
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, file));
    } catch { /* ignore */ }
  }
}

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getSessionMemory, resetSessionMemory } from './opportunityMemory.js';

interface DailyDigest {
  date: string;
  sessionHours: number;
  totalCycles: number;
  keyLevels: Array<{
    instrument: string;
    level: number;
    type: 'support' | 'resistance';
    held: boolean;
    testCount: number;
  }>;
  themes: Array<{
    name: string;
    durationMinutes: number;
    outcome: 'played_out' | 'faded' | 'ongoing';
  }>;
  narrativeSummary: string;
}

const DIGEST_DIR = join(process.cwd(), 'data', 'digests');
const MAX_DIGESTS = 5;

function ensureDir() {
  mkdirSync(DIGEST_DIR, { recursive: true });
}

export function writeDigest(): DailyDigest | null {
  const session = getSessionMemory();
  if (session.cycles.length === 0) return null;

  const now = Date.now();
  const date = new Date().toISOString().slice(0, 10);
  const sessionHours = Math.round((now - session.sessionStart) / 3_600_000 * 10) / 10;

  const digest: DailyDigest = {
    date,
    sessionHours,
    totalCycles: session.cycles.length,
    keyLevels: session.levels
      .filter(l => l.testedAt.length > 0 || !l.held)
      .map(l => ({
        instrument: l.instrument,
        level: l.level,
        type: l.type,
        held: l.held,
        testCount: l.testedAt.length,
      })),
    themes: session.themes.map(t => ({
      name: t.name,
      durationMinutes: Math.round((t.lastSeen - t.firstSeen) / 60_000),
      outcome: t.stillActive ? 'ongoing' : t.lastSeen - t.firstSeen > 30 * 60_000 ? 'played_out' : 'faded',
    })),
    narrativeSummary: session.cycles[session.cycles.length - 1]?.narrative.slice(0, 200) ?? '',
  };

  ensureDir();
  writeFileSync(join(DIGEST_DIR, `${date}.json`), JSON.stringify(digest, null, 2));
  cleanupOldDigests();
  resetSessionMemory();

  return digest;
}

let cachedYesterdayDigest: string | undefined;
let cachedYesterdayDate = '';

export function loadYesterdayDigest(): string | undefined {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (cachedYesterdayDate === yesterday) return cachedYesterdayDigest;

  ensureDir();
  const filePath = join(DIGEST_DIR, `${yesterday}.json`);

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const digest: DailyDigest = JSON.parse(raw);

    const parts: string[] = [];
    parts.push(`Yesterday (${digest.date}): ${digest.totalCycles} cycles over ${digest.sessionHours}h.`);

    const significantLevels = digest.keyLevels.filter(l => l.testCount >= 2 || !l.held).slice(0, 4);
    if (significantLevels.length > 0) {
      const levelNotes = significantLevels.map(l => {
        const status = !l.held ? 'broken' : `held (${l.testCount}x)`;
        return `${l.instrument} ${l.level} ${l.type} ${status}`;
      });
      parts.push(`Key levels: ${levelNotes.join('; ')}`);
    }

    const themes = digest.themes.filter(t => t.durationMinutes >= 20).slice(0, 4);
    if (themes.length > 0) {
      parts.push(`Themes: ${themes.map(t => `${t.name} (${t.outcome}, ${t.durationMinutes}min)`).join('; ')}`);
    }

    cachedYesterdayDigest = parts.join('\n');
    cachedYesterdayDate = yesterday;
    return cachedYesterdayDigest;
  } catch {
    cachedYesterdayDigest = undefined;
    cachedYesterdayDate = yesterday;
    return undefined;
  }
}

function cleanupOldDigests() {
  try {
    const files = readdirSync(DIGEST_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files.slice(MAX_DIGESTS)) {
      unlinkSync(join(DIGEST_DIR, file));
    }
  } catch {
    // Ignore cleanup errors
  }
}

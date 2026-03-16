import { getLatestQuotes } from './velocityMonitor.js';

interface CycleSnapshot {
  timestamp: number;
  narrative: string;
  themes: string[];
  opportunities: Array<{
    instrument: string;
    direction: string;
    confidence: number;
    invalidation: string;
    keyLevels?: { support: string[]; resistance: string[] };
  }>;
}

interface LevelTrack {
  instrument: string;
  level: number;
  type: 'support' | 'resistance';
  calledAt: number;
  testedAt: number[];
  held: boolean;
}

interface ThemeTrack {
  name: string;
  firstSeen: number;
  lastSeen: number;
  stillActive: boolean;
  peakConviction: number;
}

interface SessionMemory {
  cycles: CycleSnapshot[];
  levels: LevelTrack[];
  themes: ThemeTrack[];
  sessionStart: number;
}

const MAX_CYCLES = 6;
const LEVEL_TEST_THRESHOLD_PIPS = 15;

const memory: SessionMemory = {
  cycles: [],
  levels: [],
  themes: [],
  sessionStart: Date.now(),
};

export function recordCycle(
  narrative: string,
  themes: string[],
  opportunities: CycleSnapshot['opportunities'],
): void {
  const now = Date.now();

  if (memory.cycles.length >= MAX_CYCLES) {
    memory.cycles.shift();
  }
  memory.cycles.push({ timestamp: now, narrative, themes, opportunities });

  for (const opp of opportunities) {
    if (!opp.keyLevels) continue;
    const allLevels = [
      ...opp.keyLevels.support.map(l => ({ level: parseFloat(l), type: 'support' as const })),
      ...opp.keyLevels.resistance.map(l => ({ level: parseFloat(l), type: 'resistance' as const })),
    ].filter(l => Number.isFinite(l.level));

    for (const { level, type } of allLevels) {
      const existing = memory.levels.find(
        t => t.instrument === opp.instrument && Math.abs(t.level - level) < level * 0.0002,
      );
      if (!existing) {
        memory.levels.push({
          instrument: opp.instrument,
          level,
          type,
          calledAt: now,
          testedAt: [],
          held: true,
        });
      }
    }
  }

  for (const theme of themes) {
    const existing = memory.themes.find(t => t.name.toLowerCase() === theme.toLowerCase());
    if (existing) {
      existing.lastSeen = now;
      existing.stillActive = true;
    } else {
      memory.themes.push({
        name: theme,
        firstSeen: now,
        lastSeen: now,
        stillActive: true,
        peakConviction: 0,
      });
    }
  }

  for (const track of memory.themes) {
    if (!themes.some(t => t.toLowerCase() === track.name.toLowerCase())) {
      track.stillActive = false;
    }
  }
}

export function updateLevelTests(): void {
  const quotes = new Map(getLatestQuotes().map(q => [q.instrumentId, q.price]));
  const now = Date.now();

  for (const track of memory.levels) {
    const price = quotes.get(track.instrument);
    if (price == null) continue;

    const distance = Math.abs(price - track.level);
    const threshold = track.level * (LEVEL_TEST_THRESHOLD_PIPS / 10000);

    if (distance <= threshold) {
      if (track.testedAt.length === 0 || now - track.testedAt[track.testedAt.length - 1] > 60_000) {
        track.testedAt.push(now);
      }
    }

    if (track.type === 'support' && price < track.level - threshold) {
      track.held = false;
    } else if (track.type === 'resistance' && price > track.level + threshold) {
      track.held = false;
    }
  }
}

export function buildSessionContext(): string | undefined {
  if (memory.cycles.length === 0) return undefined;

  const lastCycle = memory.cycles[memory.cycles.length - 1];
  const elapsed = Math.round((Date.now() - lastCycle.timestamp) / 60_000);

  const parts: string[] = [];

  parts.push(`Prior cycle (${elapsed}min ago): ${lastCycle.narrative.slice(0, 120)}`);

  const recentLevels = memory.levels
    .filter(l => l.testedAt.length > 0 || !l.held)
    .slice(0, 4);
  if (recentLevels.length > 0) {
    const levelNotes = recentLevels.map(l => {
      const status = !l.held ? 'broken' : `held (tested ${l.testedAt.length}x)`;
      return `${l.instrument} ${l.level} ${l.type} ${status}`;
    });
    parts.push(`Levels: ${levelNotes.join('; ')}`);
  }

  const activeThemes = memory.themes.filter(t => t.stillActive);
  const fadedThemes = memory.themes.filter(t => !t.stillActive && Date.now() - t.lastSeen < 30 * 60_000);
  if (activeThemes.length > 0) {
    const durationStr = (t: ThemeTrack) => `${Math.round((Date.now() - t.firstSeen) / 60_000)}min`;
    parts.push(`Active themes: ${activeThemes.map(t => `${t.name} (${durationStr(t)})`).join(', ')}`);
  }
  if (fadedThemes.length > 0) {
    parts.push(`Faded themes: ${fadedThemes.map(t => t.name).join(', ')}`);
  }

  return parts.join('\n');
}

export function getSessionMemory(): SessionMemory {
  return memory;
}

export function resetSessionMemory(): void {
  memory.cycles = [];
  memory.levels = [];
  memory.themes = [];
  memory.sessionStart = Date.now();
}

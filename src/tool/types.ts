export interface PoolEntry {
  /** Unique spelling as it should be displayed. */
  text: string;
  /** Relative probability multiplier; greater than or equal to 1. */
  weight: number;
}

export interface PickRecord {
  /** Entry text at the time it was picked. */
  text: string;
  /** ISO timestamp when the pick happened. */
  pickedAt: string;
}

export interface ToolState {
  /** Raw pasted pool text (one entry per line or comma separated). */
  poolText: string;
  /** Number of winners to pick per run (1..N). */
  pickCount: number;
  /** When true picked entries are removed from the pool. */
  noRepeat: boolean;
  /** Result records, newest first. */
  results: PickRecord[];
  /** History of picks for reference, capped at MAX_HISTORY. */
  history: PickRecord[];
}

export const MAX_HISTORY = 50;

const DEFAULT_POOL = 'Alice\nBob\nCarol\nDave';

export const DEFAULT_STATE: ToolState = {
  poolText: DEFAULT_POOL,
  pickCount: 1,
  noRepeat: false,
  results: [],
  history: [],
};

/** Split raw pool text into trimmed, non-empty tokens. */
export function splitEntries(poolText: string): string[] {
  return poolText
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Extract a weight multiplier from syntax "entry x3" or "entry:3".
 * Returns the entry text (weight syntax stripped) and its weight (default 1).
 * An invalid weight (zero, negative, NaN) falls back to 1.
 */
export function parseEntry(raw: string): { text: string; weight: number } {
  const trimmed = raw.trim();
  const xMatch = /^(.*\S)\s*[xX]\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
  const colonMatch = /^(.*\S)\s*:\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
  const match = xMatch ?? colonMatch;
  if (match && match[1] && match[2]) {
    const weight = Number(match[2]);
    if (Number.isFinite(weight) && weight > 0) {
      return { text: match[1].trim(), weight };
    }
  }
  return { text: trimmed, weight: 1 };
}

export interface ParsedPool {
  /** Deduplicated entries keeping the first spelling, with weights summed. */
  entries: PoolEntry[];
  /** Texts merged as case-insensitive duplicates (keeps first spelling). */
  mergedDuplicates: string[];
}

/** Parse, apply weights and deduplicate case-insensitively (first spelling wins). */
export function parsePool(poolText: string): ParsedPool {
  const entries: PoolEntry[] = [];
  const mergedDuplicates: string[] = [];
  const byKey = new Map<string, PoolEntry>();
  for (const raw of splitEntries(poolText)) {
    const { text, weight } = parseEntry(raw);
    const key = text.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.weight += weight;
      if (existing.text !== text) mergedDuplicates.push(text);
    } else {
      const entry: PoolEntry = { text, weight };
      byKey.set(key, entry);
      entries.push(entry);
    }
  }
  return { entries, mergedDuplicates };
}

/** Validate a requested pick count against the available pool. */
export function validatePickCount(
  want: number,
  entries: PoolEntry[],
  noRepeat: boolean
): { ok: boolean; error?: string } {
  const count = Math.floor(want);
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, error: 'Pick count must be at least 1.' };
  }
  if (entries.length === 0) {
    return { ok: false, error: 'The pool is empty. Add at least one entry.' };
  }
  if (noRepeat && count > entries.length) {
    return {
      ok: false,
      error: `Cannot pick ${count} unique winners: only ${entries.length} entries remain.`,
    };
  }
  return { ok: true };
}

export interface WeightedPick {
  /** Picked entries in draw order. */
  picks: string[];
  /** Entries remaining after the draws (no-repeat removes winners). */
  remaining: PoolEntry[];
}

/** Pick an index from a weighted pool by cumulative weight. Never returns an out-of-range index. */
function pickIndex(pool: PoolEntry[], roll: number): number {
  let cumulative = 0;
  for (let j = 0; j < pool.length; j += 1) {
    const entry = pool[j];
    if (!entry) continue;
    cumulative += entry.weight;
    if (roll < cumulative) return j;
  }
  return pool.length - 1;
}

/** Deterministic weighted random draw via a supplied PRNG (defaults to Math.random). */
export function pickEntries(
  entries: PoolEntry[],
  count: number,
  noRepeat: boolean,
  random: () => number = Math.random
): WeightedPick {
  const pool = entries.map((e) => ({ ...e }));
  const picks: string[] = [];
  const draws = Math.max(1, Math.floor(count));
  for (let i = 0; i < draws; i += 1) {
    if (noRepeat && pool.length === 0) break;
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    if (total <= 0) break;
    const roll = random() * total;
    const index = pickIndex(pool, roll);
    const winner = pool[index];
    if (!winner) break;
    picks.push(winner.text);
    if (noRepeat) pool.splice(index, 1);
  }
  return { picks, remaining: noRepeat ? pool : entries.map((e) => ({ ...e })) };
}

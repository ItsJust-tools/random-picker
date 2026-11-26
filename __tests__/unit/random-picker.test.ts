import { describe, it, expect } from 'vitest';
import {
  splitEntries,
  parseEntry,
  parsePool,
  validatePickCount,
  pickEntries,
  DEFAULT_STATE,
  type PoolEntry,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  performPick,
  undoLastResult,
  resultSummary,
  roundTrips,
  withHistory,
} from '@/tool/tool-definition';
import { randomPickerTool } from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('splitEntries', () => {
  it('splits on newlines and commas and trims tokens', () => {
    expect(splitEntries('Alice\nBob,   Carol\n')).toEqual(['Alice', 'Bob', 'Carol']);
    expect(splitEntries('a , b,,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for whitespace-only input', () => {
    expect(splitEntries('')).toEqual([]);
    expect(splitEntries('   \n  \n, \t ')).toEqual([]);
  });
});

describe('parseEntry weight syntax', () => {
  it('supports "entry x3" and "entry:3"', () => {
    expect(parseEntry('Alice x3')).toEqual({ text: 'Alice', weight: 3 });
    expect(parseEntry('Alice:3')).toEqual({ text: 'Alice', weight: 3 });
    expect(parseEntry('Alice X2.5')).toEqual({ text: 'Alice', weight: 2.5 });
    expect(parseEntry('Alice:0.5')).toEqual({ text: 'Alice', weight: 0.5 });
  });

  it('defaults to weight 1 and tolerates odd spellings', () => {
    expect(parseEntry('plain')).toEqual({ text: 'plain', weight: 1 });
    expect(parseEntry('x2 alone')).toEqual({ text: 'x2 alone', weight: 1 });
    expect(parseEntry('colon:in:middle')).toEqual({ text: 'colon:in:middle', weight: 1 });
    expect(parseEntry('bad weight x0')).toEqual({ text: 'bad weight x0', weight: 1 });
    expect(parseEntry('bad weight x-2')).toEqual({ text: 'bad weight x-2', weight: 1 });
  });
});

describe('parsePool dedup', () => {
  it('merges case-insensitive duplicates and keeps the first spelling', () => {
    const pool = parsePool('apple\nAPPLE\nApple x2');
    expect(pool.entries).toHaveLength(1);
    expect(pool.entries[0]).toEqual({ text: 'apple', weight: 4 });
    expect(pool.mergedDuplicates).toHaveLength(2);
  });

  it('keeps distinct entries with combined weights', () => {
    const pool = parsePool('a x2\nb\na');
    expect(pool.entries).toHaveLength(2);
    expect(pool.entries[0]).toEqual({ text: 'a', weight: 3 });
    expect(pool.entries[1]).toEqual({ text: 'b', weight: 1 });
  });
});

describe('weighted selection distributes frequency proportionally', () => {
  it('picks heavy entries much more often within tolerance', () => {
    const entries: PoolEntry[] = [
      { text: 'light', weight: 1 },
      { text: 'heavy', weight: 9 },
    ];
    const runs = 20000;
    let heavy = 0;
    let light = 0;
    for (let i = 0; i < runs; i += 1) {
      const draw = pickEntries(entries, 1, false);
      if (draw.picks[0] === 'heavy') heavy += 1;
      else light += 1;
    }
    const heavyShare = heavy / runs;
    expect(heavyShare).toBeGreaterThan(0.85);
    expect(heavyShare).toBeLessThan(0.95);
    expect(light).toBe(runs - heavy);
  });

  it('uniform weights pick every entry over many runs', () => {
    const entries: PoolEntry[] = [
      { text: 'a', weight: 1 },
      { text: 'b', weight: 1 },
      { text: 'c', weight: 1 },
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const draw = pickEntries(entries, 1, false);
      if (draw.picks[0]) seen.add(draw.picks[0]);
    }
    expect(seen.size).toBe(3);
  });

  it('supports an injectable PRNG', () => {
    const entries: PoolEntry[] = [
      { text: 'a', weight: 1 },
      { text: 'b', weight: 1 },
    ];
    const draw = pickEntries(entries, 1, false, () => 0.999);
    expect(draw.picks[0]).toBe('b');
    const draw2 = pickEntries(entries, 1, false, () => 0);
    expect(draw2.picks[0]).toBe('a');
  });
});

describe('no-repeat mode', () => {
  it('removes picked entries from the remaining pool', () => {
    const entries: PoolEntry[] = [
      { text: 'a', weight: 1 },
      { text: 'b', weight: 1 },
    ];
    const draw = pickEntries(entries, 2, true, () => 0.25);
    expect(draw.picks).toHaveLength(2);
    expect(new Set(draw.picks).size).toBe(2);
    expect(draw.remaining).toHaveLength(0);
  });

  it('keeps the pool intact when no-repeat is off', () => {
    const entries: PoolEntry[] = [{ text: 'a', weight: 1 }];
    const draw = pickEntries(entries, 3, false, () => 0.5);
    expect(draw.picks).toEqual(['a', 'a', 'a']);
    expect(draw.remaining).toHaveLength(1);
  });

  it('rejects requesting more unique picks than entries remain', () => {
    const entries: PoolEntry[] = [
      { text: 'a', weight: 1 },
      { text: 'b', weight: 1 },
    ];
    expect(validatePickCount(3, entries, true).ok).toBe(false);
    expect(validatePickCount(3, entries, true).error).toContain('only 2 entries remain');
    expect(validatePickCount(2, entries, true).ok).toBe(true);
  });
});

describe('validation of empty pools and bad counts', () => {
  it('rejects empty and whitespace-only pools', () => {
    const check = validatePickCount(1, parsePool('   \n  ').entries, false);
    expect(check.ok).toBe(false);
    expect(check.error).toContain('empty');
  });

  it('rejects pick counts below 1', () => {
    expect(validatePickCount(0, [{ text: 'a', weight: 1 }], false).ok).toBe(false);
    expect(validatePickCount(-2, [{ text: 'a', weight: 1 }], false).ok).toBe(false);
  });
});

describe('performPick state transitions', () => {
  it('appends results and history on a valid pick', () => {
    const before = state({ poolText: 'Alice\nBob' });
    const outcome = performPick(before, () => 0.9);
    expect(outcome.ok).toBe(true);
    expect(outcome.picks).toHaveLength(1);
    expect(outcome.state?.results).toHaveLength(1);
    expect(outcome.state?.history).toHaveLength(1);
    expect(['Alice', 'Bob']).toContain(outcome.state?.results[0]?.text);
  });

  it('errors without throwing on an empty pool', () => {
    const outcome = performPick(state({ poolText: '  \n ' }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBeTruthy();
    expect(outcome.state).toBeUndefined();
  });

  it('errors when no-repeat demand exceeds the pool', () => {
    const outcome = performPick(state({ poolText: 'a\nb', pickCount: 5, noRepeat: true }));
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('unique winners');
  });

  it('fills a multi-winner batch in one timestamp', () => {
    const outcome = performPick(state({ poolText: 'a\nb\nc', pickCount: 3, noRepeat: true }));
    expect(outcome.picks).toHaveLength(3);
    const timestamps = new Set(outcome.state?.results.map((r) => r.pickedAt));
    expect(timestamps.size).toBe(1);
    expect(resultSummary(outcome.state as ToolState)).toContain(', ');
  });
});

describe('serialize/deserialize round-trip', () => {
  it('round-trips pool, weights-encoded poolText, results and flags', () => {
    const sample = state({
      poolText: 'Alice x3\nBob:2\nCarol',
      pickCount: 2,
      noRepeat: true,
      results: [{ text: 'Bob', pickedAt: '2026-11-21T10:00:00.000Z' }],
      history: [{ text: 'Bob', pickedAt: '2026-11-21T10:00:00.000Z' }],
    });
    expect(roundTrips(sample)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(sample)));
    expect(restored).toEqual({ success: true, data: sample });
  });

  it('recovers gracefully from garbage payloads', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    const repaired = deserializeState({ poolText: 42, pickCount: 'lots', results: 'nonsense' });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.poolText).toBe(DEFAULT_STATE.poolText);
      expect(repaired.data.pickCount).toBe(DEFAULT_STATE.pickCount);
      expect(repaired.data.results).toEqual([]);
    }
  });

  it('clamps record arrays to MAX_HISTORY', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      text: `e${i}`,
      pickedAt: '2026-11-21T10:00:00.000Z',
    }));
    const restored = deserializeState({ results: many, history: many });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.results.length).toBeLessThanOrEqual(50);
      expect(restored.data.history.length).toBeLessThanOrEqual(50);
    }
  });

  it('exposes the tool contract with the right id', () => {
    expect(randomPickerTool.id).toBe('random-picker');
    expect(randomPickerTool.serialize(state())).toBe(serializeState(state()));
  });
});

describe('undo and history helpers', () => {
  it('undoLastResult drops only the newest result', () => {
    const filled = state({
      results: [
        { text: 'first', pickedAt: '2026-11-21T10:00:01.000Z' },
        { text: 'second', pickedAt: '2026-11-21T10:00:02.000Z' },
      ],
    });
    const undone = undoLastResult(filled);
    expect(undone.results).toHaveLength(1);
    expect(undone.results[0]?.text).toBe('second');
    expect(undoLastResult(state())).toEqual(state());
  });

  it('withHistory appends newest first and caps at MAX_HISTORY', () => {
    let s = state();
    for (let i = 0; i < 55; i += 1) {
      s = withHistory(s, { text: `e${i}`, pickedAt: '2026-11-21T10:00:00.000Z' });
    }
    expect(s.history.length).toBe(50);
    expect(s.history[0]?.text).toBe('e54');
  });

  it('resultSummary handles empty state', () => {
    expect(resultSummary(state())).toBe('No picks yet');
  });
});

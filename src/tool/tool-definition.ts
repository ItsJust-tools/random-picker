import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  parsePool,
  validatePickCount,
  pickEntries,
  type PickRecord,
  type ToolState,
} from './types';

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    poolText: state.poolText,
    pickCount: state.pickCount,
    noRepeat: state.noRepeat,
    results: state.results,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function countOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 500) : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validRecords(value: unknown): PickRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is PickRecord =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PickRecord).text === 'string' &&
        typeof (entry as PickRecord).pickedAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected random picker state object',
    };
  }
  const v = data as Record<string, unknown>;
  const state: ToolState = {
    poolText: stringOr(v.poolText, DEFAULT_STATE.poolText),
    pickCount: countOr(v.pickCount, DEFAULT_STATE.pickCount),
    noRepeat: boolOr(v.noRepeat, DEFAULT_STATE.noRepeat),
    results: validRecords(v.results),
    history: validRecords(v.history),
  };
  return { success: true, data: state };
}

/** Append a pick record to both results and history, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, record: PickRecord): ToolState {
  return {
    ...state,
    results: [record, ...state.results].slice(0, MAX_HISTORY),
    history: [record, ...state.history].slice(0, MAX_HISTORY),
  };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export interface PickOutcome {
  ok: boolean;
  error?: string;
  state?: ToolState;
  picks?: string[];
}

/**
 * Attempt a pick against the current state. Returns an error for invalid
 * input (empty pool, count out of range) or the next state with appended records.
 */
export function performPick(state: ToolState, random: () => number = Math.random): PickOutcome {
  const { entries } = parsePool(state.poolText);
  const check = validatePickCount(state.pickCount, entries, state.noRepeat);
  if (!check.ok) return { ok: false, error: check.error };
  const draw = pickEntries(entries, state.pickCount, state.noRepeat, random);
  const now = new Date().toISOString();
  let next: ToolState = {
    ...state,
    results: state.results,
    history: state.history,
  };
  for (const text of draw.picks) {
    next = withHistory(next, { text, pickedAt: now });
  }
  next = { ...next, results: next.results.slice(0, MAX_HISTORY) };
  return { ok: true, state: next, picks: draw.picks };
}

/** Remove the newest result and restore it to the pool implicitly (recompute). */
export function undoLastResult(state: ToolState): ToolState {
  if (state.results.length === 0) return state;
  return { ...state, results: state.results.slice(1) };
}

/** Human readable summary of the latest results. */
export function resultSummary(state: ToolState): string {
  if (state.results.length === 0) return 'No picks yet';
  const latest = state.results[0];
  if (!latest) return 'No picks yet';
  const sameBatch = state.results.filter((r) => r.pickedAt === latest.pickedAt);
  return sameBatch.length > 1 ? `Winners: ${sameBatch.map((r) => r.text).join(', ')}` : latest.text;
}

export const randomPickerTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export type { PickRecord, PoolEntry, ToolState } from './types';

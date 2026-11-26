import { DEFAULT_STATE, type ToolState } from './types';

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  return resultSummaryText(state);
}

function resultSummaryText(state: ToolState): string {
  if (state.results.length === 0) return 'No picks yet';
  const latest = state.results[0];
  if (!latest) return 'No picks yet';
  const sameBatch = state.results.filter((r) => r.pickedAt === latest.pickedAt);
  return sameBatch.length > 1 ? `Winners: ${sameBatch.map((r) => r.text).join(', ')}` : latest.text;
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.poolText === 'string' && typeof v.pickCount === 'number' && DEFAULT_STATE !== undefined
  );
}

'use client';

import React from 'react';
import { parsePool, validatePickCount, type ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onPick?: () => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onPick }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const { entries, mergedDuplicates } = parsePool(state.poolText);
  const validation = validatePickCount(state.pickCount, entries, state.noRepeat);
  const latest = state.results[0];
  const latestBatch = latest ? state.results.filter((r) => r.pickedAt === latest.pickedAt) : [];

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="random-picker-canvas">
      <div data-testid="pool-inputs">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Entries (one per line or comma separated)
          <textarea
            value={state.poolText}
            onChange={(e) => update({ poolText: e.target.value })}
            data-testid="input-pool"
            rows={8}
            className={`${inputClass} font-mono`}
            placeholder={'Alice\nBob\nCarol'}
          />
        </label>
        {mergedDuplicates.length > 0 ? (
          <p
            className="mt-1 text-xs text-amber-600 dark:text-amber-400"
            data-testid="duplicate-warning"
          >
            {mergedDuplicates.length} duplicate{mergedDuplicates.length === 1 ? '' : 's'} merged
            (first spelling kept)
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-4" data-testid="pick-controls">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Winners to pick
          <input
            type="number"
            min={1}
            max={100}
            value={state.pickCount}
            onChange={(e) => update({ pickCount: Number(e.target.value) || 1 })}
            data-testid="input-pick-count"
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={state.noRepeat}
            onChange={(e) => update({ noRepeat: e.target.checked })}
            data-testid="input-no-repeat"
          />
          No-repeat mode
        </label>
        <button
          type="button"
          onClick={onPick}
          disabled={!validation.ok}
          data-testid="btn-pick"
          className="rounded-md bg-violet-500 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Pick {state.pickCount > 1 ? `${state.pickCount} winners` : 'a winner'}
        </button>
      </div>

      {!validation.ok && validation.error ? (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
          data-testid="validation-error"
        >
          {validation.error}
        </p>
      ) : null}

      <div aria-live="polite" data-testid="winner-region">
        {latest ? (
          <div
            className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950"
            data-testid="result-card"
          >
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
              {latestBatch.length > 1 ? 'Winners' : 'Winner'}
            </p>
            <p
              className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100"
              data-testid="result-main"
            >
              {latestBatch.map((r) => r.text).join(', ')}
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            data-testid="result-card"
          >
            Pick a winner to see the result here.
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Results history</h3>
        <ul className="space-y-1 text-xs" data-testid="results-list">
          {state.results.map((record, i) => (
            <li
              key={`${record.pickedAt}-${record.text}-${i}`}
              className="flex justify-between gap-2 text-gray-600 dark:text-gray-300"
            >
              <span className="truncate">{record.text}</span>
              <time className="text-gray-500 dark:text-gray-400" dateTime={record.pickedAt}>
                {new Date(record.pickedAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

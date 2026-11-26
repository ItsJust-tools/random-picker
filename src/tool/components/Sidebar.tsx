'use client';

import React from 'react';
import { parsePool, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  const { entries, mergedDuplicates } = parsePool(state.poolText);
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  return (
    <div
      className="p-4 space-y-6 text-sm overflow-y-auto h-full"
      data-testid="random-picker-sidebar"
    >
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Pool</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-pool-count">
          {entries.length} unique entr{entries.length === 1 ? 'y' : 'ies'} · total weight{' '}
          {Math.round(totalWeight * 100) / 100}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {entries.slice(0, 30).map((entry) => (
            <li key={entry.text} className="flex justify-between gap-2">
              <span className="truncate">{entry.text}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {entry.weight > 1 ? `×${entry.weight}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {mergedDuplicates.length > 0 ? (
        <div>
          <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Merged duplicates</h3>
          <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-duplicates">
            {mergedDuplicates.length} case-insensitive duplicate
            {mergedDuplicates.length === 1 ? '' : 's'} merged
          </p>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Pick history</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} pick{state.history.length === 1 ? '' : 's'} recorded
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {state.history.slice(0, 10).map((record) => (
            <li key={`${record.pickedAt}-${record.text}`} className="flex justify-between gap-2">
              <span className="truncate">{record.text}</span>
              <time className="text-gray-500 dark:text-gray-400" dateTime={record.pickedAt}>
                {new Date(record.pickedAt).toLocaleTimeString()}
              </time>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>Enter</kbd> — pick winner(s)
          </li>
          <li>
            <kbd>Y</kbd> — copy results
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Weights</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Append <code>entry x3</code> or <code>entry:3</code> to a line to make that entry three
          times more likely to be picked.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the pool, weights and results;
          open it anywhere to restore the exact state.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Privacy</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Everything runs locally in your browser — no lists ever leave this device.
        </p>
      </div>
    </div>
  );
};

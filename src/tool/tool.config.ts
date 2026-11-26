import type { ToolConfig } from '@itsjust/core';

const toolConfig: ToolConfig = {
  id: 'random-picker',
  name: 'Random Picker',
  description:
    'Spin up one or more random winners/choices from a pasted list, with per-entry weights, no-repeat mode, and copyable results.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'] as ToolConfig['exportFormats'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    brand: 'Random Picker',
    icon: '🎲',
  },
};

export default toolConfig;

export type ToolConfigType = typeof toolConfig;

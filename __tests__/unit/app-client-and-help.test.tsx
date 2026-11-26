import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockHandleExport = vi.fn();
const mockImport = vi.fn();
const mockToolbarActions = { canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn() };

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare}>
      trigger-share
    </button>
  ),
  useTool: () => ({
    state: {
      data: {
        poolText: 'Alice\nBob\nCarol',
        pickCount: 1,
        noRepeat: false,
        results: [],
        history: [],
      },
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: mockHandleExport,
    importFromFile: mockImport,
    isImporting: false,
    toolbarActions: mockToolbarActions,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'random-picker',
    name: 'Random Picker',
    version: '1.0.0',
    features: { sidebar: true },
    theme: { brand: 'Random Picker' },
  },
  templateBaseVersion: '1.1.0',
  Canvas: ({ onPick }: { onPick?: () => void }) => (
    <button type="button" data-testid="btn-pick" onClick={onPick}>
      mock-pick
    </button>
  ),
  Toolbar: () => <div>toolbar</div>,
  Sidebar: () => <div>sidebar</div>,
  summaryText: () => 'summary',
}));

vi.mock('@/tool/tool-definition', () => ({
  randomPickerTool: {
    serialize: (state: unknown) => JSON.stringify(state),
    deserialize: () => ({
      success: true,
      data: {
        poolText: 'Alice\nBob\nCarol',
        pickCount: 1,
        noRepeat: false,
        results: [],
        history: [],
      },
    }),
  },
  performPick: vi.fn(() => ({
    ok: true,
    picks: ['Alice'],
    state: {
      poolText: 'Alice\nBob\nCarol',
      pickCount: 1,
      noRepeat: false,
      results: [{ text: 'Alice', pickedAt: '2026-11-21T10:00:00.000Z' }],
      history: [{ text: 'Alice', pickedAt: '2026-11-21T10:00:00.000Z' }],
    },
  })),
}));

describe('app client and help page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/?state=e30%3D');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('handles share flow in tool client', async () => {
    render(<ToolClient />);

    expect(screen.getByText('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('trigger-share'));

    expect(mockToast).toHaveBeenCalled();
  });

  it('performs a pick through the shuffle animation', () => {
    render(<ToolClient />);
    fireEvent.click(screen.getByTestId('btn-pick'));
    // Shuffle animation runs on fake timers; advance past it
    vi.advanceTimersByTime(2000);
    expect(mockSetData).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalled();
  });
});

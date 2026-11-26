'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { toolConfig, templateBaseVersion, Canvas, Toolbar, Sidebar, summaryText } from '@/tool';
import { performPick, randomPickerTool } from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(randomPickerTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );

  const title = toolConfig.name;
  const state = tool.state.data;

  const handleCopyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n${summaryText(state)}`);
      showToast('Result copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy result';
      showToast(message, 'error');
    }
  }, [showToast, state, title]);

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = randomPickerTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const shuffleInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startShuffle = useCallback((pool: string[], onDone?: (text: string) => void) => {
    if (pool.length === 0) return;
    setShuffling(true);
    let ticks = 0;
    shuffleInterval.current = setInterval(() => {
      ticks += 1;
      setShuffleIndex(ticks % pool.length);
      if (ticks >= 12) {
        if (shuffleInterval.current) clearInterval(shuffleInterval.current);
        shuffleInterval.current = null;
        setShuffling(false);
        onDone?.(pool[ticks % pool.length] ?? '');
      }
    }, 60);
  }, []);

  useEffect(
    () => () => {
      if (shuffleInterval.current) clearInterval(shuffleInterval.current);
    },
    []
  );

  const doPick = useCallback(() => {
    const outcome = performPick(state);
    if (!outcome.ok || !outcome.state) {
      if (outcome.error) showToast(outcome.error, 'error');
      return;
    }
    const picks = outcome.picks ?? [];
    setToolData(() => outcome.state as ToolState);
    setAnnouncement(picks.length > 1 ? `Winners: ${picks.join(', ')}` : `Winner: ${picks[0]}`);
    showToast(
      picks.length > 1 ? `Picked ${picks.length} winners` : `Winner: ${picks[0]}`,
      'success'
    );
  }, [setToolData, showToast, state]);

  const handlePick = useCallback(() => {
    const pool = state.poolText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (shuffling) return;
    startShuffle(pool, () => doPick());
  }, [doPick, shuffling, startShuffle, state.poolText]);

  // Listen for custom pick event from keyboard shortcut in Canvas-level handler is not
  // wired; Enter handled globally below when the canvas has focus.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'TEXTAREA') return;
        event.preventDefault();
        handlePick();
      }
      if (event.key === 'y' || event.key === 'Y') {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        void handleCopyResult();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePick, handleCopyResult, state]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = randomPickerTool.serialize(state);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, state, title]);

  const toolbarContent = (
    <>
      <Toolbar
        state={state}
        onChange={(next) => setToolData(() => next)}
        onClear={() => setToolData((prev) => ({ ...prev, results: [], history: [] }))}
        onCopy={() => void handleCopyResult()}
      />
      <ImportExport
        formats={tool.supportedFormats}
        onExport={tool.handleExport}
        onImport={tool.importFromFile}
        isImporting={tool.isImporting}
        onShare={handleShare}
        isSharing={isSharing}
      />
    </>
  );

  const sidebarContent = <Sidebar state={state} onChange={(next) => setToolData(() => next)} />;

  const canvasContent = (
    <div ref={canvasRef}>
      <Canvas state={state} onChange={(next) => setToolData(() => next)} onPick={handlePick} />
      {shuffling ? (
        <div
          className="p-4 text-center text-sm text-gray-500 dark:text-gray-400"
          data-testid="shuffle-overlay"
        >
          Shuffling
          {state.poolText
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)[shuffleIndex]
            ? ` — ${
                state.poolText
                  .split(/[\n,]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)[shuffleIndex]
              }`
            : ''}
          …
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite" data-testid="live-region">
        {announcement}
      </span>
    </div>
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-mode">{state.pickCount} pick(s)</span>
      <span className="status-slot status-slot-summary">{summaryText(state)}</span>
      <span className="status-slot status-slot-history">{state.history.length} picks</span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{
              children?: ReactNode;
            }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}

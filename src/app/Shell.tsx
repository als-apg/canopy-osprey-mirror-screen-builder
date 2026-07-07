import { Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction, Theme } from '@carbon/react';
import { useState, useCallback, useEffect } from 'react';
import { Code, Play, Light, Asleep, ChevronLeft, ChevronRight } from '@carbon/icons-react';
import { useEditorStore } from '../editor/model/EditorStore';
import { PVServiceProvider } from '../services/pv/PVContext';
import { Toolbar } from '../editor/toolbar/Toolbar';
import { WidgetPalette } from '../editor/palette/WidgetPalette';
import { ComponentTree } from '../editor/tree/ComponentTree';
import { PropertyInspector } from '../editor/inspector/PropertyInspector';
import { Canvas } from '../editor/canvas/Canvas';
import { LivePreview } from '../editor/live/LivePreview';
import { CodeEditor } from '../editor/code/CodeEditor';
import { ImportReportModal } from '../editor/import/ImportReportModal';
import './Shell.scss';

export function Shell() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const filePath = useEditorStore((s) => s.filePath);
  const panels = useEditorStore((s) => s.panels);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const setEditorTheme = useEditorStore((s) => s.setEditorTheme);
  const screen = useEditorStore((s) => s.screen);
  const updateScreenMeta = useEditorStore((s) => s.updateScreenMeta);

  const isDark = editorTheme === 'g90' || editorTheme === 'g100';
  const toggleTheme = () => setEditorTheme(isDark ? 'g10' : 'g90');

  // ── Palette drag ghost ──────────────────────────────────────────────────
  const paletteDrag = useEditorStore((s) => s.paletteDrag);
  const endPaletteDrag = useEditorStore((s) => s.endPaletteDrag);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!paletteDrag) return;
    const handleMove = (e: MouseEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
    };
    const handleUp = () => {
      endPaletteDrag();
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [paletteDrag, endPaletteDrag]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  const screenTitle = screen.meta.title;
  const fileName = filePath ? filePath.split(/[/\\]/).pop() : null;
  const tabLabel = `${screenTitle}${isDirty ? ' *' : ''}`;

  const handleTitleDoubleClick = useCallback(() => {
    setTitleDraft(screenTitle);
    setIsEditingTitle(true);
  }, [screenTitle]);

  const handleTitleCommit = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== screenTitle) {
      updateScreenMeta({ title: trimmed });
    }
    setIsEditingTitle(false);
  }, [titleDraft, screenTitle, updateScreenMeta]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleTitleCommit();
      if (e.key === 'Escape') setIsEditingTitle(false);
    },
    [handleTitleCommit]
  );

  const isLiveOpen = panels.livePreviewOpen;
  const isSideBySide = isLiveOpen && panels.livePreviewMode === 'side-by-side';
  const isToggleMode = isLiveOpen && panels.livePreviewMode === 'toggle';
  const showCanvas = !isToggleMode || mode === 'edit';
  const showLive = isLiveOpen && (!isToggleMode || mode === 'live');

  return (
    <Theme theme={editorTheme}>
      <PVServiceProvider>
        <div className="shell">
          <Header aria-label="Canopy Screen Builder">
            <HeaderName prefix="Canopy">Screen Builder</HeaderName>
            <HeaderGlobalBar>
              <HeaderGlobalAction
                aria-label="Toggle Theme"
                onClick={toggleTheme}
                tooltipAlignment="end"
              >
                {isDark ? <Light size={20} /> : <Asleep size={20} />}
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label="Toggle code preview (read-only TSX export)"
                isActive={panels.codeEditorOpen}
                onClick={() => togglePanel('codeEditorOpen')}
                tooltipAlignment="end"
              >
                <Code size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label="Toggle Live Preview"
                isActive={isLiveOpen}
                onClick={() => {
                  togglePanel('livePreviewOpen');
                  if (!isLiveOpen) setMode('edit');
                }}
                tooltipAlignment="end"
              >
                <Play size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
          </Header>

          <Toolbar />

          <div className="shell__body">
            {/* Left sidebar: palette + tree */}
            {(panels.paletteOpen || panels.treeOpen) && showCanvas && (
              <aside
                className={`shell__sidebar shell__sidebar--left ${leftSidebarCollapsed ? 'shell__sidebar--collapsed' : ''}`}
              >
                {!leftSidebarCollapsed && panels.paletteOpen && <WidgetPalette />}
                {!leftSidebarCollapsed && panels.treeOpen && <ComponentTree />}
                <button
                  type="button"
                  className="shell__sidebar-toggle"
                  onClick={() => setLeftSidebarCollapsed((c) => !c)}
                  aria-label={
                    leftSidebarCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'
                  }
                  title={leftSidebarCollapsed ? 'Expand' : 'Collapse'}
                >
                  {leftSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </aside>
            )}

            {/* Canvas + Code Editor vertical split */}
            {showCanvas && (
              <main
                className={`shell__canvas-area ${isSideBySide ? 'shell__canvas-area--split' : ''}`}
              >
                <div
                  className={`shell__canvas-top ${panels.codeEditorOpen ? 'shell__canvas-top--split' : ''}`}
                >
                  <div className="shell__canvas-title">
                    {isEditingTitle ? (
                      <input
                        className="shell__title-input"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={() => setTimeout(handleTitleCommit, 100)}
                        onKeyDown={handleTitleKeyDown}
                        ref={(el) => {
                          if (el) {
                            // Defer focus so the double-click mouseup doesn't steal it
                            requestAnimationFrame(() => {
                              el.focus();
                              el.select();
                            });
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="shell__title-text"
                        onDoubleClick={handleTitleDoubleClick}
                        title="Double-click to rename"
                      >
                        {tabLabel}
                      </span>
                    )}
                    {fileName && <span className="shell__file-path">{fileName}</span>}
                  </div>
                  <Canvas />
                </div>
                {panels.codeEditorOpen && (
                  <div className="shell__code-panel">
                    <CodeEditor />
                  </div>
                )}
              </main>
            )}

            {/* Live Preview */}
            {showLive && (
              <div className={`shell__live-area ${isSideBySide ? 'shell__live-area--split' : ''}`}>
                <div className="shell__canvas-title">
                  Live Preview
                  {isToggleMode && (
                    <button className="shell__mode-switch" onClick={() => setMode('edit')}>
                      Back to Editor
                    </button>
                  )}
                </div>
                <LivePreview />
              </div>
            )}

            {/* Right sidebar: inspector */}
            {panels.inspectorOpen && showCanvas && (
              <aside
                className={`shell__sidebar shell__sidebar--right ${rightSidebarCollapsed ? 'shell__sidebar--collapsed' : ''}`}
              >
                {!rightSidebarCollapsed && <PropertyInspector />}
                <button
                  type="button"
                  className="shell__sidebar-toggle shell__sidebar-toggle--start"
                  onClick={() => setRightSidebarCollapsed((c) => !c)}
                  aria-label={
                    rightSidebarCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'
                  }
                  title={rightSidebarCollapsed ? 'Expand' : 'Collapse'}
                >
                  {rightSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
              </aside>
            )}
          </div>

          {/* Drag ghost overlay — floats at cursor while dragging from palette */}
          {paletteDrag && (
            <div className="shell__drag-ghost" style={{ left: ghostPos.x, top: ghostPos.y }}>
              {paletteDrag.type}
            </div>
          )}

          {/* Import diagnostics for the last .screen.json / legacy import */}
          <ImportReportModal />
        </div>
      </PVServiceProvider>
    </Theme>
  );
}

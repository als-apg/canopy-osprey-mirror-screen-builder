import { useRef, useCallback, useState, useEffect } from 'react';
import { Theme } from '@carbon/react';
import { useEditorStore } from '../model/EditorStore';
import { widgetRegistry } from '../../widgets/registry/WidgetRegistry';
import { WidgetOverlay } from './WidgetOverlay';
import { SelectionMarquee } from './SelectionMarquee';
import './Canvas.scss';

export function Canvas() {
  const screen = useEditorStore((s) => s.screen);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);
  const mode = useEditorStore((s) => s.mode);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const selectWidgets = useEditorStore((s) => s.selectWidgets);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const moveWidgets = useEditorStore((s) => s.moveWidgets);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setHovered = useEditorStore((s) => s.setHovered);
  const addWidget = useEditorStore((s) => s.addWidget);
  const paletteDrag = useEditorStore((s) => s.paletteDrag);
  const endPaletteDrag = useEditorStore((s) => s.endPaletteDrag);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });

  // ── Zoom ──────────────────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(viewport.zoom + delta);
      }
    },
    [viewport.zoom, setZoom]
  );

  // ── Pan (space + drag or middle click) ────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsPanning(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ── Canvas to screen coordinate transform ─────────────────────────────────

  // Offset for the canvas-viewport CSS position (top/left padding)
  const VIEWPORT_OFFSET = 40;

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - VIEWPORT_OFFSET - viewport.panX) / viewport.zoom,
        y: (clientY - rect.top - VIEWPORT_OFFSET - viewport.panY) / viewport.zoom,
      };
    },
    [viewport]
  );

  // ── Mouse handling ──────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't start selection/marquee while dragging from palette
      if (paletteDrag) return;

      if (e.button === 1 || isPanning) {
        // Middle click or space: start panning
        setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
        setIsDragging(false);
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        const target = (e.target as HTMLElement).closest('[data-widget-id]');
        if (target) {
          const id = target.getAttribute('data-widget-id')!;
          if (e.shiftKey) {
            selectWidgets([id], true);
          } else if (!selection.selectedIds.includes(id)) {
            selectWidgets([id]);
          }
          // Start drag move — snapshot for undo
          pushUndo();
          setIsDragging(true);
          setDragStart(screenToCanvas(e.clientX, e.clientY));
        } else {
          // Start marquee selection
          clearSelection();
          const pos = screenToCanvas(e.clientX, e.clientY);
          setMarqueeStart(pos);
          setMarquee({ x: pos.x, y: pos.y, w: 0, h: 0 });
        }
      }
    },
    [
      isPanning,
      viewport,
      selection.selectedIds,
      selectWidgets,
      clearSelection,
      screenToCanvas,
      paletteDrag,
      pushUndo,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Panning
      if (e.buttons === 4 || (isPanning && e.buttons === 1)) {
        setPan(e.clientX - panStart.x, e.clientY - panStart.y);
        return;
      }

      // Widget drag
      if (isDragging && e.buttons === 1 && selection.selectedIds.length > 0) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          moveWidgets(selection.selectedIds, dx, dy);
          setDragStart(pos);
        }
        return;
      }

      // Marquee
      if (marquee && e.buttons === 1) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setMarquee({
          x: Math.min(marqueeStart.x, pos.x),
          y: Math.min(marqueeStart.y, pos.y),
          w: Math.abs(pos.x - marqueeStart.x),
          h: Math.abs(pos.y - marqueeStart.y),
        });
      }
    },
    [
      isPanning,
      isDragging,
      panStart,
      dragStart,
      marquee,
      marqueeStart,
      selection.selectedIds,
      setPan,
      moveWidgets,
      screenToCanvas,
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Palette drop — place widget at cursor position
      if (paletteDrag) {
        const def = widgetRegistry.get(paletteDrag.type);
        if (def) {
          const pos = screenToCanvas(e.clientX, e.clientY);
          addWidget(
            paletteDrag.type,
            {
              x: Math.round(pos.x - def.defaultLayout.width / 2),
              y: Math.round(pos.y - def.defaultLayout.height / 2),
              width: def.defaultLayout.width,
              height: def.defaultLayout.height,
            },
            def.defaultProps
          );
        }
        endPaletteDrag();
        return;
      }

      if (marquee && marquee.w > 5 && marquee.h > 5) {
        const ids = Object.values(screen.widgets)
          .filter((w) => {
            const wx = w.layout.x;
            const wy = w.layout.y;
            const wr = w.layout.x + w.layout.width;
            const wb = w.layout.y + w.layout.height;
            return (
              wx < marquee.x + marquee.w &&
              wr > marquee.x &&
              wy < marquee.y + marquee.h &&
              wb > marquee.y
            );
          })
          .map((w) => w.id);
        if (ids.length > 0) selectWidgets(ids);
      }
      setIsDragging(false);
      setMarquee(null);
    },
    [paletteDrag, marquee, screen.widgets, selectWidgets, screenToCanvas, addWidget, endPaletteDrag]
  );

  // ── Grid rendering ────────────────────────────────────────────────────────

  const gridSize = screen.meta.gridSize;
  const showGrid = screen.meta.showGrid;

  // ── Sort widgets by z-index ───────────────────────────────────────────────

  const sortedWidgets = screen.rootWidgetIds
    .map((id) => screen.widgets[id])
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${isPanning ? 'canvas-container--panning' : ''} ${paletteDrag ? 'canvas-container--dropping' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Zoom / pan indicator */}
      <div className="canvas-container__info">{Math.round(viewport.zoom * 100)}%</div>

      <div
        className="canvas-viewport"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Screen background — pinned to screen's own theme, not editor theme */}
        <Theme theme={screen.meta.theme ?? 'g90'}>
          <div
            className="canvas-screen"
            style={{
              width: screen.meta.width,
              height: screen.meta.height,
              backgroundColor: screen.meta.backgroundColor,
            }}
          >
            {/* Grid */}
            {showGrid && (
              <svg className="canvas-grid" width={screen.meta.width} height={screen.meta.height}>
                <defs>
                  <pattern
                    id="grid-dots"
                    width={gridSize}
                    height={gridSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <circle
                      cx={gridSize / 2}
                      cy={gridSize / 2}
                      r={0.8}
                      fill="rgba(255,255,255,0.15)"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-dots)" />
              </svg>
            )}

            {/* Widgets */}
            {sortedWidgets.map((widget) => {
              const def = widgetRegistry.get(widget.type);
              if (!def || !widget.visible) return null;
              const Component = def.component;
              const isSelected = selection.selectedIds.includes(widget.id);

              return (
                <WidgetOverlay
                  key={widget.id}
                  widget={widget}
                  isSelected={isSelected}
                  isHovered={selection.hoveredId === widget.id}
                  onHover={() => setHovered(widget.id)}
                  onHoverEnd={() => setHovered(null)}
                >
                  <Component
                    id={widget.id}
                    type={widget.type}
                    layout={widget.layout}
                    props={widget.props}
                    isSelected={isSelected}
                    isEditing={mode === 'edit'}
                  />
                </WidgetOverlay>
              );
            })}

            {/* Marquee */}
            {marquee && <SelectionMarquee rect={marquee} />}
          </div>
        </Theme>
      </div>
    </div>
  );
}

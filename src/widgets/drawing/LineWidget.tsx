import { useState, useCallback, useRef, useMemo } from 'react';
import { useEditorStore } from '../../editor/model/EditorStore';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';
import './LineWidget.scss';

interface Point {
  x: number;
  y: number;
}

/**
 * Interactive Line widget with:
 * - Draggable start/end points
 * - Bend/vertex points (double-click line to add, right-click vertex to remove)
 * - Arrow heads on either end
 * - Configurable color, width, style
 */
export function LineWidget({ id, layout, props, isSelected, isEditing }: WidgetRendererProps) {
  const lineColor = (props.lineColor as string) ?? '#6f6f6f';
  const lineWidth = (props.lineWidth as number) ?? 2;
  const lineStyle = (props.lineStyle as string) ?? 'solid';
  const arrowStart = (props.arrowStart as boolean) ?? false;
  const arrowEnd = (props.arrowEnd as boolean) ?? true;
  const arrowSize = (props.arrowSize as number) ?? 10;

  // Points are stored relative to widget layout (0,0 = top-left of widget bounds)
  // Default: line from top-left to bottom-right
  const rawPoints = props.points as Point[] | undefined;
  const points: Point[] = useMemo(() => {
    if (rawPoints && rawPoints.length >= 2) return rawPoints;
    return [
      { x: 0, y: 0 },
      { x: layout.width, y: layout.height },
    ];
  }, [rawPoints, layout.width, layout.height]);

  const pushUndo = useEditorStore((s) => s.pushUndo);
  const updateWidgetProps = useEditorStore((s) => s.updateWidgetProps);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [localPoints, setLocalPoints] = useState<Point[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Commit points to store
  const commitPoints = useCallback(
    (pts: Point[]) => {
      updateWidgetProps(id, { points: pts });
      setLocalPoints(null);
    },
    [id, updateWidgetProps]
  );

  const displayPoints = localPoints ?? points;

  // Build SVG path
  const pathD = useMemo(() => {
    if (displayPoints.length < 2) return '';
    const [first, ...rest] = displayPoints;
    return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
  }, [displayPoints]);

  // Dash array for line style
  const dashArray = useMemo(() => {
    switch (lineStyle) {
      case 'dashed':
        return `${lineWidth * 4} ${lineWidth * 3}`;
      case 'dotted':
        return `${lineWidth} ${lineWidth * 2}`;
      default:
        return 'none';
    }
  }, [lineStyle, lineWidth]);

  // Arrow marker IDs (unique per widget to avoid SVG ID conflicts)
  const startMarkerId = `arrow-start-${id}`;
  const endMarkerId = `arrow-end-${id}`;

  // ── Vertex dragging ─────────────────────────────────────────────────────

  const getSVGPoint = useCallback((e: React.MouseEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handlePointMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      if (!isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      pushUndo();
      setDragIndex(index);
      setLocalPoints([...displayPoints]);
    },
    [isEditing, displayPoints, pushUndo]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragIndex === null || !localPoints) return;
      const pt = getSVGPoint(e);
      const updated = [...localPoints];
      updated[dragIndex] = pt;
      setLocalPoints(updated);
    },
    [dragIndex, localPoints, getSVGPoint]
  );

  const handleMouseUp = useCallback(() => {
    if (dragIndex !== null && localPoints) {
      commitPoints(localPoints);
    }
    setDragIndex(null);
  }, [dragIndex, localPoints, commitPoints]);

  // ── Double-click to add vertex ────────────────────────────────────────

  const handleLineDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditing) return;
      e.stopPropagation();
      const pt = getSVGPoint(e);

      // Find which segment was clicked and insert a point there
      const pts = [...displayPoints];
      let bestIdx = 1;
      let bestDist = Infinity;

      for (let i = 0; i < pts.length - 1; i++) {
        const dist = pointToSegmentDist(pt, pts[i], pts[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i + 1;
        }
      }

      pts.splice(bestIdx, 0, pt);
      pushUndo();
      commitPoints(pts);
    },
    [isEditing, displayPoints, getSVGPoint, pushUndo, commitPoints]
  );

  // ── Right-click to remove vertex ──────────────────────────────────────

  const handlePointRightClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      if (!isEditing) return;
      e.preventDefault();
      e.stopPropagation();
      // Don't allow removing start or end points
      if (index === 0 || index === displayPoints.length - 1) return;
      if (displayPoints.length <= 2) return;
      const pts = [...displayPoints];
      pts.splice(index, 1);
      pushUndo();
      commitPoints(pts);
    },
    [isEditing, displayPoints, pushUndo, commitPoints]
  );

  return (
    <svg
      ref={svgRef}
      className={`line-widget ${isSelected ? 'line-widget--selected' : ''}`}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      style={{ overflow: 'visible' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <defs>
        {/* Start arrow marker */}
        {arrowStart && (
          <marker
            id={startMarkerId}
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth={arrowSize / 2}
            markerHeight={arrowSize / 2}
            orient="auto-start-reverse"
          >
            <path d="M 10 0 L 0 5 L 10 10 Z" fill={lineColor} />
          </marker>
        )}
        {/* End arrow marker */}
        {arrowEnd && (
          <marker
            id={endMarkerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth={arrowSize / 2}
            markerHeight={arrowSize / 2}
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={lineColor} />
          </marker>
        )}
      </defs>

      {/* Invisible fat hit area for clicking/double-clicking the line */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(lineWidth + 10, 14)}
        onDoubleClick={handleLineDoubleClick}
        style={{ cursor: isEditing ? 'crosshair' : 'default' }}
      />

      {/* Visible line */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerStart={arrowStart ? `url(#${startMarkerId})` : undefined}
        markerEnd={arrowEnd ? `url(#${endMarkerId})` : undefined}
        style={{ pointerEvents: 'none' }}
      />

      {/* Vertex control points (visible when selected in edit mode) */}
      {isEditing &&
        isSelected &&
        displayPoints.map((pt, i) => (
          <g key={i}>
            {/* Invisible larger hit target */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={8}
              fill="transparent"
              style={{ cursor: 'move' }}
              onMouseDown={(e) => handlePointMouseDown(e, i)}
              onContextMenu={(e) => handlePointRightClick(e, i)}
            />
            {/* Visible control point */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={i === 0 || i === displayPoints.length - 1 ? '#0f62fe' : '#78a9ff'}
              stroke="#fff"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        ))}
    </svg>
  );
}

// ── Geometry helpers ──────────────────────────────────────────────────────

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

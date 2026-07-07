import { useMemo } from 'react';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';

// 0° = east (3 o'clock); positive angles sweep counterclockwise as viewed by the user.
function polarPoint(cx: number, cy: number, rx: number, ry: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + rx * Math.cos(rad),
    y: cy - ry * Math.sin(rad),
  };
}

export function ArcWidget({ layout, props, isSelected }: WidgetRendererProps) {
  const lineColor = (props.lineColor as string) ?? '#6f6f6f';
  const lineWidth = (props.lineWidth as number) ?? 1;
  const startAngle = (props.startAngle as number) ?? 0;
  const rawSpan = (props.spanAngle as number) ?? 90;
  const fill = (props.fill as boolean) ?? false;
  const fillColor = (props.fillColor as string) ?? '#393939';

  const w = layout.width;
  const h = layout.height;
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(0, w / 2 - lineWidth / 2);
  const ry = Math.max(0, h / 2 - lineWidth / 2);

  const span = Math.max(-360, Math.min(360, rawSpan));
  const isFullCircle = Math.abs(span) >= 360;

  const arcPath = useMemo(() => {
    if (rx === 0 || ry === 0) return '';

    if (isFullCircle) {
      // SVG arc command can't represent a full 360° in one segment; split into two halves.
      const p0 = polarPoint(cx, cy, rx, ry, startAngle);
      const p1 = polarPoint(cx, cy, rx, ry, startAngle + 180);
      const sweep = span > 0 ? 1 : 0;
      return (
        `M ${p0.x} ${p0.y} ` +
        `A ${rx} ${ry} 0 0 ${sweep} ${p1.x} ${p1.y} ` +
        `A ${rx} ${ry} 0 0 ${sweep} ${p0.x} ${p0.y} Z`
      );
    }

    const start = polarPoint(cx, cy, rx, ry, startAngle);
    const end = polarPoint(cx, cy, rx, ry, startAngle + span);
    const largeArc = Math.abs(span) > 180 ? 1 : 0;
    // SVG sweep-flag is in Y-down coords; flipping to user-facing CCW means sweep=1 for positive span.
    const sweep = span > 0 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${rx} ${ry} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
  }, [cx, cy, rx, ry, startAngle, span, isFullCircle]);

  const fillPath = useMemo(() => {
    if (rx === 0 || ry === 0) return '';

    if (isFullCircle) {
      // Same closed two-half-arc path as the stroke: the filled region is the whole ellipse.
      const p0 = polarPoint(cx, cy, rx, ry, startAngle);
      const p1 = polarPoint(cx, cy, rx, ry, startAngle + 180);
      const sweep = span > 0 ? 1 : 0;
      return (
        `M ${p0.x} ${p0.y} ` +
        `A ${rx} ${ry} 0 0 ${sweep} ${p1.x} ${p1.y} ` +
        `A ${rx} ${ry} 0 0 ${sweep} ${p0.x} ${p0.y} Z`
      );
    }

    const start = polarPoint(cx, cy, rx, ry, startAngle);
    const end = polarPoint(cx, cy, rx, ry, startAngle + span);
    const largeArc = Math.abs(span) > 180 ? 1 : 0;
    const sweep = span > 0 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${rx} ${ry} 0 ${largeArc} ${sweep} ${end.x} ${end.y} Z`;
  }, [cx, cy, rx, ry, startAngle, span, isFullCircle]);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: 'visible', outline: isSelected ? '2px solid #0f62fe' : 'none' }}
    >
      {fill && fillPath && <path d={fillPath} fill={fillColor} stroke="none" />}
      {arcPath && (
        <path
          d={arcPath}
          fill="none"
          stroke={lineColor}
          strokeWidth={lineWidth}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

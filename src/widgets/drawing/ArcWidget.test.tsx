import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';
import { ArcWidget } from './ArcWidget';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Reference implementation of the ORIGINAL (pre-fill) ArcWidget stroke-path
// algorithm, duplicated here on purpose. Expectations are derived from this
// standalone copy of the legacy math (not from importing the component's
// internals), so these tests pin today's exact rendered output rather than
// re-deriving it from the same code path that produces it.
// ---------------------------------------------------------------------------

// 0° = east (3 o'clock); positive angles sweep counterclockwise as viewed by the user.
function legacyPolarPoint(cx: number, cy: number, rx: number, ry: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + rx * Math.cos(rad),
    y: cy - ry * Math.sin(rad),
  };
}

function legacyArcPath(
  w: number,
  h: number,
  lineWidth: number,
  startAngle: number,
  spanAngle: number
): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(0, w / 2 - lineWidth / 2);
  const ry = Math.max(0, h / 2 - lineWidth / 2);

  const span = Math.max(-360, Math.min(360, spanAngle));
  const isFullCircle = Math.abs(span) >= 360;

  if (rx === 0 || ry === 0) return '';

  if (isFullCircle) {
    const p0 = legacyPolarPoint(cx, cy, rx, ry, startAngle);
    const p1 = legacyPolarPoint(cx, cy, rx, ry, startAngle + 180);
    const sweep = span > 0 ? 1 : 0;
    return (
      `M ${p0.x} ${p0.y} ` +
      `A ${rx} ${ry} 0 0 ${sweep} ${p1.x} ${p1.y} ` +
      `A ${rx} ${ry} 0 0 ${sweep} ${p0.x} ${p0.y} Z`
    );
  }

  const start = legacyPolarPoint(cx, cy, rx, ry, startAngle);
  const end = legacyPolarPoint(cx, cy, rx, ry, startAngle + span);
  const largeArc = Math.abs(span) > 180 ? 1 : 0;
  const sweep = span > 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${rx} ${ry} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

// Reference implementation of the NEW fill (pie-wedge) path, built with the
// identical formulas the stroke path uses.
function expectedWedgePath(
  w: number,
  h: number,
  lineWidth: number,
  startAngle: number,
  spanAngle: number
): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(0, w / 2 - lineWidth / 2);
  const ry = Math.max(0, h / 2 - lineWidth / 2);

  const span = Math.max(-360, Math.min(360, spanAngle));
  const isFullCircle = Math.abs(span) >= 360;

  if (rx === 0 || ry === 0) return '';

  if (isFullCircle) {
    const p0 = legacyPolarPoint(cx, cy, rx, ry, startAngle);
    const p1 = legacyPolarPoint(cx, cy, rx, ry, startAngle + 180);
    const sweep = span > 0 ? 1 : 0;
    return (
      `M ${p0.x} ${p0.y} ` +
      `A ${rx} ${ry} 0 0 ${sweep} ${p1.x} ${p1.y} ` +
      `A ${rx} ${ry} 0 0 ${sweep} ${p0.x} ${p0.y} Z`
    );
  }

  const start = legacyPolarPoint(cx, cy, rx, ry, startAngle);
  const end = legacyPolarPoint(cx, cy, rx, ry, startAngle + span);
  const largeArc = Math.abs(span) > 180 ? 1 : 0;
  const sweep = span > 0 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${rx} ${ry} 0 ${largeArc} ${sweep} ${end.x} ${end.y} Z`;
}

function renderArc(
  props: WidgetRendererProps['props'],
  layout = { x: 0, y: 0, width: 80, height: 80 }
) {
  return render(
    <ArcWidget
      id="a1"
      type="Arc"
      layout={layout}
      props={props}
      isSelected={false}
      isEditing={false}
    />
  );
}

describe('ArcWidget', () => {
  it('renders the default arc (no fill key) as a single unfilled stroke path', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: 90,
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(1);

    const path = paths[0];
    expect(path.getAttribute('d')).toBe(legacyArcPath(80, 80, 2, 0, 90));
    expect(path.getAttribute('fill')).toBe('none');
    expect(path.getAttribute('stroke')).toBe('#6f6f6f');
    expect(path.getAttribute('stroke-width')).toBe('2');
    expect(path.getAttribute('stroke-linecap')).toBe('round');
  });

  it('renders a single unfilled stroke path when fill is explicitly false', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: 90,
      fill: false,
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(1);
    expect(paths[0].getAttribute('d')).toBe(legacyArcPath(80, 80, 2, 0, 90));
  });

  it('renders a wedge fill beneath an unchanged stroke path when fill is true', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: 90,
      fill: true,
      fillColor: '#fa4d56',
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);

    const expectedWedge = expectedWedgePath(80, 80, 2, 0, 90);
    expect(expectedWedge.startsWith('M 40 40 L ')).toBe(true);
    expect(expectedWedge.endsWith(' Z')).toBe(true);

    const [fillEl, strokeEl] = paths;
    expect(fillEl.getAttribute('d')).toBe(expectedWedge);
    expect(fillEl.getAttribute('fill')).toBe('#fa4d56');
    expect(fillEl.getAttribute('stroke')).toBe('none');

    expect(strokeEl.getAttribute('d')).toBe(legacyArcPath(80, 80, 2, 0, 90));
    expect(strokeEl.getAttribute('fill')).toBe('none');
    expect(strokeEl.getAttribute('stroke')).toBe('#6f6f6f');
  });

  it('defaults the wedge fill color to #393939 when fillColor is not supplied', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: 90,
      fill: true,
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    expect(paths[0].getAttribute('fill')).toBe('#393939');
  });

  it('fills the whole ellipse for a full circle (spanAngle 360), matching the closed stroke path', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: 360,
      fill: true,
      fillColor: '#fa4d56',
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);

    const expectedClosed = legacyArcPath(80, 80, 2, 0, 360);
    expect(expectedWedgePath(80, 80, 2, 0, 360)).toBe(expectedClosed);

    expect(paths[0].getAttribute('d')).toBe(expectedClosed);
    expect(paths[1].getAttribute('d')).toBe(expectedClosed);
  });

  it('uses sweep 0 for a negative span and matches the negative-span wedge formula', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: -90,
      fill: true,
      fillColor: '#fa4d56',
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);

    expect(paths[0].getAttribute('d')).toBe(expectedWedgePath(80, 80, 2, 0, -90));
    // Confirm this expectation string actually encodes sweep=0.
    expect(expectedWedgePath(80, 80, 2, 0, -90)).toContain(' 0 0 ');

    expect(paths[1].getAttribute('d')).toBe(legacyArcPath(80, 80, 2, 0, -90));
  });

  it('sets the large-arc flag for spanAngle 270 and matches the wedge formula', () => {
    const { container } = renderArc({
      lineColor: '#6f6f6f',
      lineWidth: 2,
      startAngle: 0,
      spanAngle: 270,
      fill: true,
      fillColor: '#fa4d56',
    });

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);

    const expectedWedge = expectedWedgePath(80, 80, 2, 0, 270);
    expect(expectedWedge).toContain(' 1 1 ');
    expect(paths[0].getAttribute('d')).toBe(expectedWedge);
    expect(paths[1].getAttribute('d')).toBe(legacyArcPath(80, 80, 2, 0, 270));
  });

  it('renders no paths for a zero-size layout without throwing', () => {
    const { container } = renderArc(
      {
        lineColor: '#6f6f6f',
        lineWidth: 2,
        startAngle: 0,
        spanAngle: 90,
        fill: true,
        fillColor: '#fa4d56',
      },
      { x: 0, y: 0, width: 0, height: 0 }
    );

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(0);
  });
});

import { usePV } from '../../hooks/usePV';
import { alarmBorderStyle } from '../../theme/alarm';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';
import { formatMeterReadout, meterAngle, meterFraction, polarPoint } from './meterMath';

/** Fraction of the scale marked with a tick (0%, 25%, 50%, 75%, 100%). */
const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

/** Opacity applied to the needle/readout when the PV is disconnected. */
const DISCONNECTED_OPACITY = 0.35;

/** PVMeter — dependency-free SVG semicircular gauge bound to a live PV. */
export function PVMeterWidget({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const alarmBorder = alarmBorderStyle(
    pv.severity,
    (props.alarmSensitiveBorder as boolean) ?? true
  );

  const min = (props.minValue as number) ?? 0;
  const max = (props.maxValue as number) ?? 100;
  const showValue = (props.showValueLabel as boolean) ?? true;
  const label = props.label as string | undefined;
  const units = (props.units as string) || pv.units || '';

  const fraction = pv.connected ? meterFraction(pv.value, min, max) : 0;
  const needleOpacity = pv.connected ? 1 : DISCONNECTED_OPACITY;

  const w = layout.width;
  const h = layout.height;
  const cx = w / 2;
  // Reserve space at the bottom for the readout/label text (when shown) so the
  // semicircle doesn't collide with it — two rows when both are visible.
  const reserved = showValue && label ? 36 : showValue || label ? 24 : 4;
  const cy = Math.max(0, h - reserved);
  const r = Math.max(0, Math.min(w / 2 - 4, cy - 4));

  const scaleStart = polarPoint(cx, cy, r, 180);
  const scaleEnd = polarPoint(cx, cy, r, 0);
  const scalePath = `M ${scaleStart.x} ${scaleStart.y} A ${r} ${r} 0 0 1 ${scaleEnd.x} ${scaleEnd.y}`;

  const needleTip = polarPoint(cx, cy, r * 0.82, meterAngle(fraction));

  const readout = pv.connected ? formatMeterReadout(pv.value, pv.precision, units) : '---';

  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        boxSizing: 'border-box',
        outline: isSelected ? '2px solid #0f62fe' : 'none',
        ...alarmBorder,
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        <path d={scalePath} stroke="#525252" strokeWidth={2} fill="none" />
        {TICK_FRACTIONS.map((tickFraction) => {
          const angle = meterAngle(tickFraction);
          const outer = polarPoint(cx, cy, r, angle);
          const inner = polarPoint(cx, cy, r * 0.88, angle);
          return (
            <line
              key={tickFraction}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="#8d8d8d"
              strokeWidth={1}
            />
          );
        })}
        <line
          data-testid="pv-meter-needle"
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#f4f4f4"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={needleOpacity}
        />
        <circle cx={cx} cy={cy} r={3} fill="#8d8d8d" />
        {showValue && (
          <text
            data-testid="pv-meter-value"
            x={cx}
            y={cy + 14}
            fill="#f4f4f4"
            fontSize={12}
            textAnchor="middle"
          >
            {readout}
          </text>
        )}
        {label && (
          <text
            x={cx}
            y={cy + (showValue ? 26 : 14)}
            fill="#c6c6c6"
            fontSize={10}
            textAnchor="middle"
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}

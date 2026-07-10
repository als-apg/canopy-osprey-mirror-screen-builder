/**
 * Pure math helpers for the PVMeter widget: mapping a PV value onto a
 * semicircular gauge scale and formatting its readout. Kept dependency-free
 * and side-effect-free so they're trivially unit-testable and reusable by
 * both the SVG renderer and its tests.
 */

/**
 * Maps a PV value onto the meter's needle position, expressed as a fraction
 * in [0, 1] of the way from `min` to `max`. Non-finite values (NaN, ±Infinity,
 * non-numbers) and degenerate/reversed ranges (`max <= min`) resolve to 0
 * rather than throwing or producing NaN. In-range values are linearly
 * interpolated and out-of-range values are clamped to the nearest end.
 */
export function meterFraction(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (max <= min) return 0;
  const fraction = (value - min) / (max - min);
  return Math.max(0, Math.min(1, fraction));
}

/**
 * Converts a needle fraction in [0, 1] to an angle in degrees using the
 * repo's polarPoint convention (0° = east/3-o'clock, sweeping counterclockwise
 * as viewed). The meter's scale runs from west (min, 180°) through north
 * (mid, 90°) to east (max, 0°): `angle = 180 - fraction * 180`.
 */
export function meterAngle(fraction: number): number {
  return 180 - fraction * 180;
}

/**
 * Same polar-to-cartesian convention as ArcWidget's polarPoint: 0° = east,
 * positive angles sweep counterclockwise as viewed (`y = cy - r*sin(rad)`).
 */
export function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/**
 * Formats a PV value for the meter's numeric readout. Finite numbers are
 * fixed to `precision` decimal places (precision is clamped into [0, 20],
 * defaulting to 0 when it's non-finite or negative, matching the domain of
 * `Number.prototype.toFixed`) with `units` appended via a leading space when
 * non-empty. Non-numeric values fall back to `String(value)` unchanged, with
 * no units suffix — there's no numeric quantity for the unit to qualify.
 */
export function formatMeterReadout(value: unknown, precision: number, units: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

  const safePrecision =
    Number.isFinite(precision) && precision >= 0 ? Math.min(20, Math.floor(precision)) : 0;
  const base = value.toFixed(safePrecision);

  return units ? `${base} ${units}` : base;
}

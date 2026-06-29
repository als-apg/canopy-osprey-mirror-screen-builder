import { describe, it, expect } from 'vitest';
import { computeFitFontSize, MIN_FONT_SIZE } from './useFitText';

const fit = (over: Partial<Parameters<typeof computeFitFontSize>[0]>) =>
  computeFitFontSize({
    current: 14,
    scrollWidth: 100,
    scrollHeight: 20,
    clientWidth: 100,
    clientHeight: 20,
    ...over,
  });

describe('computeFitFontSize', () => {
  it('returns the same size when content already fits', () => {
    expect(fit({ scrollWidth: 80, clientWidth: 100 })).toBe(14);
  });

  it('shrinks when content overflows horizontally', () => {
    const next = fit({ current: 14, scrollWidth: 200, clientWidth: 100 });
    expect(next).toBeLessThan(14);
    expect(next).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });

  it('shrinks when content overflows vertically', () => {
    const next = fit({ current: 14, scrollHeight: 60, clientHeight: 20 });
    expect(next).toBeLessThan(14);
  });

  it('scales to the worst-fitting axis', () => {
    // Width needs ~0.5x, height needs ~0.25x -> height (0.25) wins. Use min:1
    // so the worst-axis result is observable below the default 8px floor.
    const next = fit({
      current: 40,
      scrollWidth: 200,
      clientWidth: 100,
      scrollHeight: 160,
      clientHeight: 20,
      min: 1,
    });
    // Height ratio 0.125 dominates the width ratio 0.5.
    expect(next).toBeLessThanOrEqual(Math.floor(40 * 0.125 * 0.92) + 1);
    expect(next).toBeGreaterThanOrEqual(1);
  });

  it('never returns below the floor', () => {
    expect(fit({ current: 9, scrollWidth: 9999, clientWidth: 10 })).toBe(MIN_FONT_SIZE);
  });

  it('returns the floor unchanged when already at the floor', () => {
    expect(fit({ current: MIN_FONT_SIZE, scrollWidth: 9999, clientWidth: 10 })).toBe(MIN_FONT_SIZE);
  });

  it('respects a custom minimum', () => {
    expect(fit({ current: 11, scrollWidth: 9999, clientWidth: 10, min: 11 })).toBe(11);
  });

  it('makes progress (shrinks at least 1px) even on tiny overflow', () => {
    const next = fit({ current: 14, scrollWidth: 101, clientWidth: 100 });
    expect(next).toBeLessThanOrEqual(13);
  });

  it('does not shrink when box has zero size (not yet laid out)', () => {
    expect(fit({ current: 14, clientWidth: 0, clientHeight: 0 })).toBe(14);
  });
});

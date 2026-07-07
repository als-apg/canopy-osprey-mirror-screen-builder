import { describe, it, expect } from 'vitest';
import { formatMeterReadout, meterAngle, meterFraction } from './meterMath';

describe('meterFraction', () => {
  it('returns 0.5 for a mid-scale value', () => {
    expect(meterFraction(50, 0, 100)).toBe(0.5);
  });

  it('clamps values below min to 0', () => {
    expect(meterFraction(-20, 0, 100)).toBe(0);
  });

  it('clamps values above max to 1', () => {
    expect(meterFraction(150, 0, 100)).toBe(1);
  });

  it('returns 0 exactly at min', () => {
    expect(meterFraction(0, 0, 100)).toBe(0);
  });

  it('returns 1 exactly at max', () => {
    expect(meterFraction(100, 0, 100)).toBe(1);
  });

  it('returns 0 for a degenerate range (max === min)', () => {
    expect(meterFraction(50, 10, 10)).toBe(0);
  });

  it('returns 0 for a reversed range (max < min)', () => {
    expect(meterFraction(50, 100, 0)).toBe(0);
  });

  it('returns 0 for a non-numeric string value', () => {
    expect(meterFraction('abc', 0, 100)).toBe(0);
  });

  it('returns 0 for an undefined value', () => {
    expect(meterFraction(undefined, 0, 100)).toBe(0);
  });

  it('returns 0 for a NaN value', () => {
    expect(meterFraction(NaN, 0, 100)).toBe(0);
  });

  it('returns 0 for an Infinity value', () => {
    expect(meterFraction(Infinity, 0, 100)).toBe(0);
  });

  it('handles negative min ranges', () => {
    expect(meterFraction(0, -50, 50)).toBe(0.5);
  });
});

describe('meterAngle', () => {
  it('maps fraction 0 to 180 degrees (west/min)', () => {
    expect(meterAngle(0)).toBe(180);
  });

  it('maps fraction 0.5 to 90 degrees (north/mid)', () => {
    expect(meterAngle(0.5)).toBe(90);
  });

  it('maps fraction 1 to 0 degrees (east/max)', () => {
    expect(meterAngle(1)).toBe(0);
  });
});

describe('formatMeterReadout', () => {
  it('respects the requested precision', () => {
    expect(formatMeterReadout(12.345, 1, '')).toBe('12.3');
  });

  it('appends units with a leading space', () => {
    expect(formatMeterReadout(12.345, 1, 'mA')).toBe('12.3 mA');
  });

  it('has no trailing space when units is empty', () => {
    expect(formatMeterReadout(12.345, 1, '')).not.toMatch(/\s$/);
  });

  it('falls back to String(value) for non-number values, with no units suffix', () => {
    expect(formatMeterReadout('N/A', 1, 'mA')).toBe('N/A');
  });
});

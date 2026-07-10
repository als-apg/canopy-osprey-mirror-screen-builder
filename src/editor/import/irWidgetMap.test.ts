import { describe, it, expect } from 'vitest';
import type { WidgetNode } from '@canopy/screen-ir';
import { mapWidget } from './irWidgetMap';

function node(type: string, props: WidgetNode['props']): WidgetNode {
  return { id: 'w1', type, props, geometry: { x: 0, y: 0, width: 160, height: 100 } };
}

describe('mapWidget pv-meter', () => {
  it('maps the full IR contract onto SB prop names', () => {
    const r = mapWidget(
      node('pv-meter', {
        pv: 'CAV:TEMP',
        min: -10,
        max: 250,
        label: 'Cavity',
        showValue: false,
        units: 'C',
      })
    );
    expect(r.sbType).toBe('PVMeter');
    expect(r.unknown).toBeUndefined();
    expect(r.props.pvName).toBe('CAV:TEMP');
    expect(r.props.minValue).toBe(-10);
    expect(r.props.maxValue).toBe(250);
    expect(r.props.label).toBe('Cavity');
    expect(r.props.showValueLabel).toBe(false);
    expect(r.props.units).toBe('C');
    // Renamed IR keys must not linger under their old names.
    expect(r.props.pv).toBeUndefined();
    expect(r.props.min).toBeUndefined();
    expect(r.props.max).toBeUndefined();
    expect(r.props.showValue).toBeUndefined();
  });

  it('maps a minimal node (pv only) without inventing defaults', () => {
    const r = mapWidget(node('pv-meter', { pv: 'X:VAL' }));
    expect(r.sbType).toBe('PVMeter');
    expect(r.props.pvName).toBe('X:VAL');
    // Defaults (min 0 / max 100 / showValue true) live in the widget
    // registration, not the import mapping.
    expect('minValue' in r.props).toBe(false);
    expect('maxValue' in r.props).toBe(false);
    expect('showValueLabel' in r.props).toBe(false);
    expect('units' in r.props).toBe(false);
  });
});

describe('mapWidget pv-radio-group', () => {
  it('maps pv, orientation and alarmSensitive onto SB prop names', () => {
    const r = mapWidget(
      node('pv-radio-group', { pv: 'X:STATE', orientation: 'horizontal', alarmSensitive: true })
    );
    expect(r.sbType).toBe('PVRadioGroup');
    expect(r.unknown).toBeUndefined();
    expect(r.props.pvName).toBe('X:STATE');
    expect(r.props.orientation).toBe('horizontal');
    expect(r.props.alarmSensitiveBorder).toBe(true);
    expect(r.props.pv).toBeUndefined();
  });

  it('maps a minimal node (pv only), leaving orientation to the registered default', () => {
    const r = mapWidget(node('pv-radio-group', { pv: 'X:STATE' }));
    expect(r.sbType).toBe('PVRadioGroup');
    expect(r.props.pvName).toBe('X:STATE');
    expect('orientation' in r.props).toBe(false);
    expect('alarmSensitiveBorder' in r.props).toBe(false);
  });
});

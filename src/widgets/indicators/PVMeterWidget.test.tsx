import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PVServiceContext } from '../../services/pv/pvServiceContext';
import type { PVService, PVData } from '../../services/pv/PVService';
import { AlarmSeverity } from '../../types/widget';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';
import { PVMeterWidget } from './PVMeterWidget';

afterEach(cleanup);

function makeService(snapshot: PVData | undefined): PVService {
  return {
    subscribe: (_pv, listener) => {
      if (snapshot) listener(snapshot);
      return () => {};
    },
    put: () => {},
    getSnapshot: () => snapshot,
    connect: () => {},
    disconnect: () => {},
    isConnected: true,
  };
}

function connectedPV(value: number, over?: Partial<PVData>): PVData {
  return {
    value,
    displayValue: String(value),
    severity: AlarmSeverity.NO_ALARM,
    connected: true,
    timestamp: 0,
    units: '',
    precision: 1,
    lowerLimit: 0,
    upperLimit: 100,
    ...over,
  };
}

const baseLayout = { x: 0, y: 0, width: 160, height: 100 };

function renderMeter(props: WidgetRendererProps['props'], snapshot: PVData | undefined) {
  const svc = makeService(snapshot);
  return render(
    <PVServiceContext.Provider value={svc}>
      <PVMeterWidget
        id="m1"
        type="PVMeter"
        layout={baseLayout}
        props={props}
        isSelected={false}
        isEditing={false}
      />
    </PVServiceContext.Provider>
  );
}

describe('PVMeterWidget', () => {
  it('shows the formatted value with the units prop when connected', () => {
    renderMeter(
      { pvName: 'TEST:PV', minValue: 0, maxValue: 100, units: 'A' },
      connectedPV(42, { precision: 1 })
    );
    expect(screen.getByTestId('pv-meter-value').textContent).toBe('42.0 A');
  });

  it('falls back to the PV units when no units prop is set', () => {
    renderMeter(
      { pvName: 'TEST:PV', minValue: 0, maxValue: 100 },
      connectedPV(10, { precision: 0, units: 'mA' })
    );
    expect(screen.getByTestId('pv-meter-value').textContent).toMatch(/mA$/);
  });

  it('shows --- and a dimmed needle when disconnected (no snapshot)', () => {
    renderMeter({ pvName: 'TEST:PV', minValue: 0, maxValue: 100 }, undefined);
    expect(screen.getByTestId('pv-meter-value').textContent).toBe('---');
    const needle = screen.getByTestId('pv-meter-needle');
    const opacity = Number(needle.getAttribute('opacity'));
    expect(opacity).toBeLessThan(1);
  });

  it('shows --- and a dimmed needle when no pvName is set', () => {
    renderMeter({ minValue: 0, maxValue: 100 }, undefined);
    expect(screen.getByTestId('pv-meter-value').textContent).toBe('---');
    const needle = screen.getByTestId('pv-meter-needle');
    const opacity = Number(needle.getAttribute('opacity'));
    expect(opacity).toBeLessThan(1);
  });

  it('renders no value element when showValueLabel is false', () => {
    renderMeter(
      { pvName: 'TEST:PV', minValue: 0, maxValue: 100, showValueLabel: false },
      connectedPV(42)
    );
    expect(screen.queryByTestId('pv-meter-value')).toBeNull();
  });

  it('renders the label prop text', () => {
    renderMeter(
      { pvName: 'TEST:PV', minValue: 0, maxValue: 100, label: 'Beam Current' },
      connectedPV(42)
    );
    expect(screen.getByText('Beam Current')).toBeTruthy();
  });

  it('wires needle position to value: higher value -> larger x2', () => {
    const { unmount } = renderMeter(
      { pvName: 'TEST:PV', minValue: 0, maxValue: 100 },
      connectedPV(0)
    );
    const x2Low = Number(screen.getByTestId('pv-meter-needle').getAttribute('x2'));
    unmount();

    renderMeter({ pvName: 'TEST:PV', minValue: 0, maxValue: 100 }, connectedPV(100));
    const x2High = Number(screen.getByTestId('pv-meter-needle').getAttribute('x2'));

    expect(x2High).toBeGreaterThan(x2Low);
  });

  it('points the needle near center width for a mid-scale value', () => {
    renderMeter({ pvName: 'TEST:PV', minValue: 0, maxValue: 100 }, connectedPV(50));
    const x2Mid = Number(screen.getByTestId('pv-meter-needle').getAttribute('x2'));
    expect(Math.abs(x2Mid - baseLayout.width / 2)).toBeLessThanOrEqual(1);
  });

  it('clamps an above-max value to the same needle endpoint as max', () => {
    const { unmount } = renderMeter(
      { pvName: 'TEST:PV', minValue: 0, maxValue: 100 },
      connectedPV(100)
    );
    const x2Max = Number(screen.getByTestId('pv-meter-needle').getAttribute('x2'));
    unmount();

    renderMeter({ pvName: 'TEST:PV', minValue: 0, maxValue: 100 }, connectedPV(250));
    const x2Above = Number(screen.getByTestId('pv-meter-needle').getAttribute('x2'));

    expect(x2Above).toBeCloseTo(x2Max, 5);
  });
});

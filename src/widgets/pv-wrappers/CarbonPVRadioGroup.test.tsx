import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CarbonPVRadioGroup } from './CarbonWidgets';
import { PVServiceContext } from '../../services/pv/pvServiceContext';
import type { PVService, PVData } from '../../services/pv/PVService';
import { AlarmSeverity } from '../../types/widget';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';

afterEach(cleanup);

function makeService(
  snapshot: PVData | undefined,
  put = vi.fn()
): PVService & { put: ReturnType<typeof vi.fn> } {
  return {
    subscribe: (_pv, listener) => {
      if (snapshot) listener(snapshot);
      return () => {};
    },
    put,
    getSnapshot: () => snapshot,
    connect: () => {},
    disconnect: () => {},
    isConnected: true,
  };
}

function connectedPV(value: string | number): PVData {
  return {
    value,
    displayValue: String(value),
    severity: AlarmSeverity.NO_ALARM,
    connected: true,
    timestamp: 0,
    units: '',
    precision: 0,
    lowerLimit: 0,
    upperLimit: 0,
  };
}

function renderRadioGroup(
  props: WidgetRendererProps['props'],
  service: PVService,
  overrides: Partial<WidgetRendererProps> = {}
) {
  const defaultProps: WidgetRendererProps = {
    id: 'r1',
    type: 'PVRadioGroup',
    layout: { x: 0, y: 0, width: 160, height: 96 },
    props,
    isSelected: false,
    isEditing: false,
    ...overrides,
  };

  return render(
    <PVServiceContext.Provider value={service}>
      <CarbonPVRadioGroup {...defaultProps} />
    </PVServiceContext.Provider>
  );
}

describe('CarbonPVRadioGroup', () => {
  it('derives options from customItems', () => {
    const service = makeService(undefined);
    renderRadioGroup({ pvName: 'T:ENUM', customItems: ['Off', 'On', 'Standby'] }, service);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByLabelText('Off')).toBeTruthy();
    expect(screen.getByLabelText('On')).toBeTruthy();
    expect(screen.getByLabelText('Standby')).toBeTruthy();
  });

  it('falls back to default options when customItems is absent', () => {
    const service = makeService(undefined);
    renderRadioGroup({ pvName: 'T:ENUM' }, service);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByLabelText('Option 1')).toBeTruthy();
    expect(screen.getByLabelText('Option 2')).toBeTruthy();
    expect(screen.getByLabelText('Option 3')).toBeTruthy();
  });

  it('selects the radio matching the current PV value', () => {
    const service = makeService(connectedPV('On'));
    renderRadioGroup({ pvName: 'T:ENUM', customItems: ['Off', 'On', 'Standby'] }, service);

    const off = screen.getByLabelText('Off') as HTMLInputElement;
    const on = screen.getByLabelText('On') as HTMLInputElement;
    const standby = screen.getByLabelText('Standby') as HTMLInputElement;

    expect(on.checked).toBe(true);
    expect(off.checked).toBe(false);
    expect(standby.checked).toBe(false);
  });

  it('writes the selected option to the PV on click', () => {
    const put = vi.fn();
    const service = makeService(connectedPV('Off'), put);
    renderRadioGroup({ pvName: 'T:ENUM', customItems: ['Off', 'On', 'Standby'] }, service);

    fireEvent.click(screen.getByLabelText('Standby'));

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('T:ENUM', 'Standby');
  });

  it('does not write to the PV while isEditing is true', () => {
    const put = vi.fn();
    const service = makeService(connectedPV('Off'), put);
    renderRadioGroup({ pvName: 'T:ENUM', customItems: ['Off', 'On', 'Standby'] }, service, {
      isEditing: true,
    });

    fireEvent.click(screen.getByLabelText('Standby'));

    expect(put).toHaveBeenCalledTimes(0);
  });

  it('disables the radios when the PV is disconnected but a pvName is set', () => {
    const service = makeService(undefined);
    renderRadioGroup({ pvName: 'T:ENUM', customItems: ['Off', 'On', 'Standby'] }, service);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    for (const radio of radios) {
      expect(radio.disabled).toBe(true);
    }
  });

  it('defaults to vertical orientation and switches with the orientation prop', () => {
    const service = makeService(connectedPV('Off'));
    const { container: verticalContainer } = renderRadioGroup(
      { pvName: 'T:ENUM', customItems: ['Off', 'On'] },
      service
    );

    const verticalGroup = verticalContainer.querySelector('fieldset');
    expect(verticalGroup?.className).toContain('cds--radio-button-group--vertical');

    cleanup();

    const { container: horizontalContainer } = renderRadioGroup(
      { pvName: 'T:ENUM', customItems: ['Off', 'On'], orientation: 'horizontal' },
      service
    );
    const horizontalGroup = horizontalContainer.querySelector('fieldset');
    expect(horizontalGroup?.className).not.toContain('cds--radio-button-group--vertical');
  });
});

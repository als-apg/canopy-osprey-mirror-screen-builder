import { useState, useCallback } from 'react';
import {
  TextInput,
  Button,
  Slider,
  Toggle,
  ProgressBar,
  Tag,
  Dropdown,
  Checkbox,
} from '@carbon/react';
import { usePV } from '../../hooks/usePV';
import { alarmBorderStyle } from '../../theme/alarm';
import { AlarmSeverity, AlarmSeverityName } from '../../types/widget';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';
import './CarbonWidgets.scss';

/** PVTextDisplay — Carbon Tag/Text showing live PV value */
export function CarbonPVTextDisplay({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const alarmBorder = alarmBorderStyle(
    pv.severity,
    (props.alarmSensitiveBorder as boolean) ?? true
  );

  const severityTag = (() => {
    switch (pv.severity) {
      case AlarmSeverity.MINOR:
        return 'magenta' as const;
      case AlarmSeverity.MAJOR:
        return 'red' as const;
      case AlarmSeverity.INVALID:
        return 'purple' as const;
      case AlarmSeverity.DISCONNECTED:
        return 'gray' as const;
      default:
        return 'green' as const;
    }
  })();

  return (
    <div
      className={`carbon-pv-display ${isSelected ? 'carbon-pv-display--selected' : ''}`}
      style={{
        width: layout.width,
        height: layout.height,
        ...alarmBorder,
      }}
    >
      {props.label && <span className="carbon-pv-display__label">{props.label as string}</span>}
      <span className="carbon-pv-display__value">{pv.connected ? pv.displayValue : '---'}</span>
      {pv.connected && pv.severity !== AlarmSeverity.NO_ALARM && (
        <Tag size="sm" type={severityTag} className="carbon-pv-display__alarm-tag">
          {AlarmSeverityName[pv.severity]}
        </Tag>
      )}
    </div>
  );
}

/** PVTextInput — Carbon TextInput bound to PV */
export function CarbonPVTextInput({
  id,
  layout,
  props,
  isSelected,
  isEditing,
}: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const [draft, setDraft] = useState<string | null>(null);
  const alarmBorder = alarmBorderStyle(
    pv.severity,
    (props.alarmSensitiveBorder as boolean) ?? true
  );

  const handleBlur = useCallback(() => {
    if (draft !== null && pv.connected) {
      const numVal = parseFloat(draft);
      pv.put(isNaN(numVal) ? draft : numVal);
      setDraft(null);
    }
  }, [draft, pv]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleBlur();
      if (e.key === 'Escape') setDraft(null);
    },
    [handleBlur]
  );

  return (
    <div
      className={`carbon-pv-input ${isSelected ? 'carbon-pv-input--selected' : ''}`}
      style={{ width: layout.width, height: layout.height, ...alarmBorder }}
    >
      <TextInput
        id={`pv-input-${id}`}
        labelText={(props.label as string) ?? ''}
        hideLabel={!props.label}
        size="sm"
        value={draft ?? (pv.connected ? String(pv.value) : '---')}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={!pv.connected && !!props.pvName}
        readOnly={isEditing}
      />
    </div>
  );
}

/** PVButton — Carbon Button that writes to PV */
export function CarbonPVButton({ layout, props, isEditing }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);

  const handleClick = useCallback(() => {
    if (!isEditing && pv.connected && props.pressValue !== undefined) {
      pv.put(props.pressValue as number | string);
    }
  }, [isEditing, pv, props.pressValue]);

  return (
    <div style={{ width: layout.width, height: layout.height }}>
      <Button
        size="sm"
        kind="primary"
        onClick={handleClick}
        disabled={!!props.pvName && !pv.connected}
        className="carbon-pv-button"
        style={{ width: '100%', height: '100%', maxWidth: 'none' }}
      >
        {(props.label as string) ?? 'Button'}
      </Button>
    </div>
  );
}

/** PVSlider — Carbon Slider bound to PV */
export function CarbonPVSlider({ id, layout, props, isSelected, isEditing }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const min = (props.minValue as number) ?? pv.lowerLimit ?? 0;
  const max = (props.maxValue as number) ?? pv.upperLimit ?? 100;
  const value = pv.connected ? (typeof pv.value === 'number' ? pv.value : 0) : 0;

  const handleChange = useCallback(
    ({ value: v }: { value: number }) => {
      if (!isEditing) pv.put(v);
    },
    [isEditing, pv]
  );

  return (
    <div
      className={`carbon-pv-slider ${isSelected ? 'carbon-pv-slider--selected' : ''}`}
      style={{ width: layout.width, height: layout.height }}
    >
      <Slider
        id={`pv-slider-${id}`}
        labelText=""
        hideTextInput
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        disabled={!pv.connected && !!props.pvName}
      />
    </div>
  );
}

/** PVToggle — Carbon Toggle bound to PV */
export function CarbonPVToggle({ id, layout, props, isEditing }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const isOn = pv.connected && (typeof pv.value === 'number' ? pv.value !== 0 : Boolean(pv.value));

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (!isEditing) pv.put(checked ? 1 : 0);
    },
    [isEditing, pv]
  );

  return (
    <div
      style={{ width: layout.width, height: layout.height, display: 'flex', alignItems: 'center' }}
    >
      <Toggle
        id={`pv-toggle-${id}`}
        labelText=""
        hideLabel
        size="sm"
        toggled={isOn}
        onToggle={handleToggle}
        labelA={(props.offLabel as string) ?? 'Off'}
        labelB={(props.onLabel as string) ?? 'On'}
        disabled={!pv.connected && !!props.pvName}
      />
    </div>
  );
}

/** PVProgressBar — Carbon ProgressBar bound to PV */
export function CarbonPVProgressBar({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const min = (props.minValue as number) ?? 0;
  const max = (props.maxValue as number) ?? 100;
  const value = pv.connected ? (typeof pv.value === 'number' ? pv.value : 0) : 0;
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const status = (() => {
    if (!pv.connected) return 'error' as const;
    if (pv.severity === AlarmSeverity.MAJOR) return 'error' as const;
    return 'active' as const;
  })();

  return (
    <div
      className={`carbon-pv-progress ${isSelected ? 'carbon-pv-progress--selected' : ''}`}
      style={{ width: layout.width, height: layout.height }}
    >
      <ProgressBar
        label={(props.label as string) ?? ''}
        hideLabel={!props.label}
        value={percent}
        status={status}
        size="small"
      />
    </div>
  );
}

/** PVLed — Custom LED indicator (no Carbon equivalent) */
export function CarbonPVLed({ layout, props }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const isOn = pv.connected && (typeof pv.value === 'number' ? pv.value !== 0 : Boolean(pv.value));
  const onColor = (props.onColor as string) ?? '#24a148';
  const offColor = (props.offColor as string) ?? '#525252';
  const color = isOn ? onColor : offColor;
  const size = Math.min(layout.width, layout.height);

  return (
    <div
      className="carbon-pv-led"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: isOn
          ? `0 0 ${size / 2}px ${color}80, inset 0 -2px 4px rgba(0,0,0,0.3)`
          : 'inset 0 2px 4px rgba(0,0,0,0.4)',
        transition: 'background-color 0.2s, box-shadow 0.2s',
        border: `1px solid rgba(255,255,255,0.1)`,
      }}
    >
      {/* Highlight reflection */}
      <div
        style={{
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,${isOn ? 0.4 : 0.15}) 0%, transparent 70%)`,
          position: 'relative',
          top: size * 0.12,
          left: size * 0.15,
        }}
      />
    </div>
  );
}

/** PVDropdown — Carbon Dropdown bound to PV */
export function CarbonPVDropdown({ id, layout, props, isEditing }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const items = (props.customItems as string[]) ?? ['Option 1', 'Option 2', 'Option 3'];

  return (
    <div style={{ width: layout.width, height: layout.height }}>
      <Dropdown
        id={`pv-dropdown-${id}`}
        titleText=""
        label={pv.connected ? String(pv.value) : 'Select...'}
        items={items}
        itemToString={(item: string) => item}
        size="sm"
        disabled={!pv.connected && !!props.pvName}
        onChange={({ selectedItem }: { selectedItem: string | null }) => {
          if (!isEditing && selectedItem) pv.put(selectedItem);
        }}
      />
    </div>
  );
}

/** PVCheckbox — Carbon Checkbox bound to PV (writes 1/0) */
export function CarbonPVCheckbox({ id, layout, props, isEditing }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const isChecked =
    pv.connected && (typeof pv.value === 'number' ? pv.value !== 0 : Boolean(pv.value));

  const handleChange = useCallback(
    (_: unknown, { checked }: { checked: boolean }) => {
      if (!isEditing) pv.put(checked ? 1 : 0);
    },
    [isEditing, pv]
  );

  return (
    <div
      style={{ width: layout.width, height: layout.height, display: 'flex', alignItems: 'center' }}
    >
      <Checkbox
        id={`pv-checkbox-${id}`}
        labelText={(props.label as string) ?? ''}
        checked={isChecked}
        onChange={handleChange}
        disabled={!pv.connected && !!props.pvName}
        readOnly={isEditing}
      />
    </div>
  );
}

/** PVByteIndicator — a row of LED dots, one per bit of the PV value */
export function CarbonPVByteIndicator({ layout, props }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const value = pv.connected && typeof pv.value === 'number' ? pv.value : 0;
  const numBits = Math.max(1, (props.numBits as number) ?? 8);
  const startBit = (props.startBit as number) ?? 0;
  const bigEndian = (props.bigEndian as boolean) ?? false;
  const onColor = (props.onColor as string) ?? '#24a148';
  const offColor = (props.offColor as string) ?? '#525252';

  // Each cell is a square sized to the row height; lay them out left→right.
  const size = Math.min(layout.height, layout.width / numBits);

  const bits = Array.from({ length: numBits }, (_, i) => {
    // Bit 0 is the LSB. bigEndian renders the high bit first (leftmost).
    const bitIndex = bigEndian ? numBits - 1 - i : i;
    return (value >> (startBit + bitIndex)) & 1;
  });

  return (
    <div
      className="carbon-pv-byte"
      style={{
        width: layout.width,
        height: layout.height,
        display: 'flex',
        gap: 2,
        alignItems: 'center',
      }}
    >
      {bits.map((on, i) => {
        const color = on ? onColor : offColor;
        return (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: color,
              boxShadow: on
                ? `0 0 ${size / 3}px ${color}80, inset 0 -1px 2px rgba(0,0,0,0.3)`
                : 'inset 0 1px 2px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              flex: '0 0 auto',
            }}
          />
        );
      })}
    </div>
  );
}

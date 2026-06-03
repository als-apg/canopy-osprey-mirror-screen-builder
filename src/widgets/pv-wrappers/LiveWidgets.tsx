import { useState, useCallback } from 'react';
import { usePV } from '../../hooks/usePV';
import { alarmBorderStyle, alarmColor } from '../../theme/alarm';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';

/** PVTextDisplay — shows live PV value with alarm coloring */
export function LivePVTextDisplay({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const borderColor = isSelected ? '#0f62fe' : undefined;
  const alarmBorder = alarmBorderStyle(
    pv.severity,
    (props.alarmSensitiveBorder as boolean) ?? true
  );

  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        backgroundColor: props.backgroundColor ?? '#262626',
        color: props.alarmSensitiveContent
          ? alarmColor(pv.severity)
          : (props.foregroundColor ?? '#f4f4f4'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: props.fontSize ?? 13,
        fontFamily: 'IBM Plex Mono, monospace',
        border: `1px solid ${borderColor ?? alarmBorder.borderColor ?? '#393939'}`,
        borderRadius: 2,
        overflow: 'hidden',
        userSelect: 'none',
        ...alarmBorder,
        ...(borderColor ? { borderColor } : {}),
      }}
    >
      <span style={{ color: '#8d8d8d', fontSize: 11, marginRight: 8 }}>{props.label ?? ''}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pv.connected ? pv.displayValue : '---'}
      </span>
    </div>
  );
}

/** PVTextInput — editable text field bound to PV */
export function LivePVTextInput({ layout, props }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const [draft, setDraft] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const alarmBorder = alarmBorderStyle(
    pv.severity,
    (props.alarmSensitiveBorder as boolean) ?? true
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (draft !== null && pv.connected) {
      pv.put(parseFloat(draft) || draft);
      setDraft(null);
    }
  }, [draft, pv]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleBlur();
      if (e.key === 'Escape') {
        setDraft(null);
        setIsFocused(false);
      }
    },
    [handleBlur]
  );

  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {props.label && (
        <span style={{ color: '#8d8d8d', fontSize: 10, marginBottom: 2, paddingLeft: 2 }}>
          {props.label}
        </span>
      )}
      <input
        style={{
          flex: 1,
          background: props.backgroundColor ?? '#262626',
          color: props.foregroundColor ?? '#f4f4f4',
          border: `1px solid ${isFocused ? '#0f62fe' : (alarmBorder.borderColor ?? '#525252')}`,
          borderRadius: 2,
          padding: '0 8px',
          fontSize: props.fontSize ?? 13,
          fontFamily: 'IBM Plex Mono, monospace',
          outline: 'none',
          ...alarmBorder,
        }}
        value={draft ?? (pv.connected ? String(pv.value) : '---')}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={!pv.connected}
      />
    </div>
  );
}

/** PVButton — writes a value on click */
export function LivePVButton({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);

  const handleClick = useCallback(() => {
    if (pv.connected && props.pressValue !== undefined) {
      pv.put(props.pressValue as number | string);
    }
  }, [pv, props.pressValue]);

  return (
    <button
      style={{
        width: layout.width,
        height: layout.height,
        backgroundColor: '#0f62fe',
        color: '#fff',
        border: isSelected ? '2px solid #78a9ff' : '1px solid transparent',
        borderRadius: 2,
        fontSize: props.fontSize ?? 13,
        fontFamily: 'IBM Plex Sans, sans-serif',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pv.connected || !props.pvName ? 1 : 0.5,
      }}
      onClick={handleClick}
      disabled={!!props.pvName && !pv.connected}
    >
      {props.label ?? 'Button'}
    </button>
  );
}

/** PVLed — round LED indicator */
export function LivePVLed({ layout, props }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const isOn = pv.connected && (typeof pv.value === 'number' ? pv.value !== 0 : Boolean(pv.value));
  const onColor = (props.onColor as string) ?? '#24a148';
  const offColor = (props.offColor as string) ?? '#525252';
  const color = isOn ? onColor : offColor;
  const size = Math.min(layout.width, layout.height);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: isOn ? `0 0 ${size / 2}px ${color}80` : 'none',
        transition: 'background-color 0.2s, box-shadow 0.2s',
      }}
    />
  );
}

/** PVSlider — range slider bound to PV */
export function LivePVSlider({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const min = (props.minValue as number) ?? pv.lowerLimit ?? 0;
  const max = (props.maxValue as number) ?? pv.upperLimit ?? 100;
  const value = pv.connected ? (typeof pv.value === 'number' ? pv.value : 0) : 0;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pv.put(parseFloat(e.target.value));
    },
    [pv]
  );

  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4px 0',
        border: isSelected ? '1px solid #0f62fe' : '1px solid transparent',
        borderRadius: 2,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#8d8d8d',
          padding: '0 2px',
        }}
      >
        <span>{min}</span>
        <span style={{ color: '#f4f4f4', fontFamily: 'IBM Plex Mono, monospace' }}>
          {pv.connected ? value.toFixed(1) : '---'}
        </span>
        <span>{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={(max - min) / 100}
        value={value}
        onChange={handleChange}
        disabled={!pv.connected}
        style={{ width: '100%', accentColor: '#0f62fe' }}
      />
    </div>
  );
}

/** PVToggle — on/off switch */
export function LivePVToggle({ layout, props }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const isOn = pv.connected && (typeof pv.value === 'number' ? pv.value !== 0 : Boolean(pv.value));

  const handleClick = useCallback(() => {
    if (pv.connected) {
      pv.put(isOn ? 0 : 1);
    }
  }, [pv, isOn]);

  return (
    <div
      onClick={handleClick}
      style={{
        width: layout.width,
        height: layout.height,
        borderRadius: layout.height / 2,
        backgroundColor: isOn ? '#24a148' : '#525252',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: isOn ? layout.width - layout.height + 2 : 2,
          width: layout.height - 4,
          height: layout.height - 4,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}

/** PVProgressBar — horizontal bar */
export function LivePVProgressBar({ layout, props, isSelected }: WidgetRendererProps) {
  const pv = usePV(props.pvName as string | undefined);
  const min = (props.minValue as number) ?? 0;
  const max = (props.maxValue as number) ?? 100;
  const value = pv.connected ? (typeof pv.value === 'number' ? pv.value : 0) : 0;
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        backgroundColor: '#393939',
        borderRadius: 2,
        overflow: 'hidden',
        border: isSelected ? '1px solid #0f62fe' : '1px solid transparent',
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: alarmColor(pv.severity),
          transition: 'width 0.3s ease, background-color 0.3s',
        }}
      />
    </div>
  );
}

import { useMemo, useState, useRef } from 'react';
import { TextInput } from '@carbon/react';
import { useScreen } from '../model/hooks';
import { widgetRegistry } from '../../widgets/registry/WidgetRegistry';
import {
  CarbonPVTextDisplay,
  CarbonPVTextInput,
  CarbonPVButton,
  CarbonPVLed,
  CarbonPVSlider,
  CarbonPVToggle,
  CarbonPVProgressBar,
  CarbonPVDropdown,
  CarbonPVCheckbox,
  CarbonPVByteIndicator,
} from '../../widgets/pv-wrappers/CarbonWidgets';
import { BreakpointBar } from './BreakpointBar';
import type { WidgetRendererProps } from '../../widgets/registry/WidgetRegistry';
import type { WidgetType, Widget } from '../../types/widget';
import type { ReactNode } from 'react';
import './LivePreview.scss';

// Map widget types to Carbon live components
const LIVE_COMPONENTS: Partial<Record<WidgetType, React.ComponentType<WidgetRendererProps>>> = {
  PVTextDisplay: CarbonPVTextDisplay,
  PVTextInput: CarbonPVTextInput,
  PVButton: CarbonPVButton,
  PVLed: CarbonPVLed,
  PVSlider: CarbonPVSlider,
  PVToggle: CarbonPVToggle,
  PVProgressBar: CarbonPVProgressBar,
  PVDropdown: CarbonPVDropdown,
  PVCheckbox: CarbonPVCheckbox,
  PVByteIndicator: CarbonPVByteIndicator,
};

export function LivePreview() {
  const screen = useScreen();
  const [macroOverrides, setMacroOverrides] = useState<Record<string, string>>({});
  const [activeBreakpoint, setActiveBreakpoint] = useState('auto');
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Merge default macros with overrides
  const macros = useMemo(
    () => ({ ...screen.meta.macros, ...macroOverrides }),
    [screen.meta.macros, macroOverrides]
  );

  // Resolve macros in a string
  const resolveMacros = (str: string) => {
    return str.replace(/\$\((\w+)\)/g, (_, key) => macros[key] ?? `$(${key})`);
  };

  // Recursively render a widget and its descendants. Geometry is stored
  // absolute (the IR contract); children render nested in the parent wrapper,
  // so the parent's absolute origin is subtracted to cancel the nesting offset
  // (mirrors the canvas renderer). `seen` guards a parentId cycle.
  const renderWidget = (
    widget: Widget,
    seen: Set<string>,
    parentOrigin?: { x: number; y: number }
  ): ReactNode => {
    if (!widget.visible || seen.has(widget.id)) return null;

    const LiveComponent = LIVE_COMPONENTS[widget.type];
    const FallbackComponent = widgetRegistry.get(widget.type)?.component;
    const Component = LiveComponent ?? FallbackComponent;
    if (!Component) return null;

    // Resolve PV name macros — only copy props when there's a macro to resolve.
    const pvName = widget.props.pvName;
    const resolvedProps = pvName
      ? { ...widget.props, pvName: resolveMacros(pvName as string) }
      : widget.props;

    const transparency = Math.min(100, Math.max(0, (widget.props.opacity as number) ?? 0));
    const widgetOpacity = 1 - transparency / 100;

    seen.add(widget.id);
    const origin = { x: widget.layout.x, y: widget.layout.y };
    const childNodes = (widget.children ?? [])
      .map((id) => screen.widgets[id])
      .filter(Boolean)
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((child) => renderWidget(child, seen, origin));

    return (
      <div
        key={widget.id}
        style={{
          position: 'absolute',
          left: widget.layout.x - (parentOrigin?.x ?? 0),
          top: widget.layout.y - (parentOrigin?.y ?? 0),
          width: widget.layout.width,
          height: widget.layout.height,
          zIndex: widget.zIndex,
          transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
          opacity: widgetOpacity,
        }}
      >
        <Component
          id={widget.id}
          type={widget.type}
          layout={widget.layout}
          props={resolvedProps}
          isSelected={false}
          isEditing={false}
        >
          {childNodes.length > 0 ? childNodes : undefined}
        </Component>
      </div>
    );
  };

  const rootWidgets = screen.rootWidgetIds
    .map((id) => screen.widgets[id])
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex);

  // Calculate preview width
  const previewWidth = customWidth ?? screen.meta.width;
  const useDeviceFrame = customWidth !== null && customWidth !== screen.meta.width;

  // Calculate scale to fit the screen within the preview width
  const screenScale = useDeviceFrame ? Math.min(1, previewWidth / screen.meta.width) : 1;

  return (
    <div className="live-preview">
      {/* Breakpoint bar */}
      <BreakpointBar
        activeBreakpoint={activeBreakpoint}
        onBreakpointChange={setActiveBreakpoint}
        customWidth={customWidth}
        onCustomWidthChange={setCustomWidth}
        viewportWidth={screen.meta.width}
      />

      {/* Macro bar */}
      <div className="live-preview__macro-bar">
        <span className="live-preview__macro-label">Macros:</span>
        {Object.entries(screen.meta.macros).map(([key, defaultVal]) => (
          <div key={key} className="live-preview__macro-field">
            <TextInput
              id={`macro-${key}`}
              labelText={key}
              size="sm"
              value={macroOverrides[key] ?? defaultVal}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMacroOverrides((prev) => ({ ...prev, [key]: e.target.value }))
              }
              hideLabel
              placeholder={`$(${key})`}
            />
          </div>
        ))}
        {Object.keys(screen.meta.macros).length === 0 && (
          <span className="live-preview__macro-none">No macros defined</span>
        )}
      </div>

      {/* Live screen viewport */}
      <div className="live-preview__viewport" ref={viewportRef}>
        {/* Device frame when using breakpoint preview */}
        <div
          className={`live-preview__device-frame ${useDeviceFrame ? 'live-preview__device-frame--active' : ''}`}
          style={useDeviceFrame ? { width: previewWidth } : undefined}
        >
          {/* Breakpoint label */}
          {useDeviceFrame && (
            <div className="live-preview__device-label">
              {previewWidth}px — {activeBreakpoint}
            </div>
          )}

          {/* The actual screen — bg follows the app theme via --cds-background
              when the screen doesn't pin its own backgroundColor. */}
          <div
            className="live-preview__screen"
            style={{
              width: screen.meta.width,
              height: screen.meta.height,
              position: 'relative',
              transform: screenScale < 1 ? `scale(${screenScale})` : undefined,
              transformOrigin: 'top left',
              overflowX: screen.meta.showHorizontalScrollbar === false ? 'hidden' : 'auto',
              overflowY: screen.meta.showVerticalScrollbar === false ? 'hidden' : 'auto',
              ...(screen.meta.backgroundColor
                ? { backgroundColor: screen.meta.backgroundColor }
                : null),
            }}
          >
            {rootWidgets.map((widget) => renderWidget(widget, new Set()))}
          </div>
        </div>
      </div>
    </div>
  );
}

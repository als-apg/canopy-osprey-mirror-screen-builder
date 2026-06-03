import { useMemo, useState, useRef } from 'react';
import { TextInput } from '@carbon/react';
import { useEditorStore } from '../model/EditorStore';
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
} from '../../widgets/pv-wrappers/CarbonWidgets';
import { BreakpointBar } from './BreakpointBar';
import type { WidgetRendererProps } from '../../widgets/registry/WidgetRegistry';
import type { WidgetType } from '../../types/widget';
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
};

export function LivePreview() {
  const screen = useEditorStore((s) => s.screen);
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

  const sortedWidgets = screen.rootWidgetIds
    .map((id) => screen.widgets[id])
    .filter((w) => w && w.visible)
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

          {/* The actual screen */}
          <div
            className="live-preview__screen"
            style={{
              width: screen.meta.width,
              height: screen.meta.height,
              backgroundColor: screen.meta.backgroundColor,
              position: 'relative',
              transform: screenScale < 1 ? `scale(${screenScale})` : undefined,
              transformOrigin: 'top left',
            }}
          >
            {sortedWidgets.map((widget) => {
              // Resolve PV name macros
              const resolvedProps = { ...widget.props };
              if (resolvedProps.pvName) {
                resolvedProps.pvName = resolveMacros(resolvedProps.pvName as string);
              }

              const LiveComponent = LIVE_COMPONENTS[widget.type];
              const FallbackComponent = widgetRegistry.get(widget.type)?.component;
              const Component = LiveComponent ?? FallbackComponent;

              if (!Component) return null;

              return (
                <div
                  key={widget.id}
                  style={{
                    position: 'absolute',
                    left: widget.layout.x,
                    top: widget.layout.y,
                    width: widget.layout.width,
                    height: widget.layout.height,
                    zIndex: widget.zIndex,
                    transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
                  }}
                >
                  <Component
                    id={widget.id}
                    type={widget.type}
                    layout={widget.layout}
                    props={resolvedProps}
                    isSelected={false}
                    isEditing={false}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

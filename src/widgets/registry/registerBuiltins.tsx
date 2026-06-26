/* eslint-disable react-refresh/only-export-components -- registration module: inline renderers live next to their registry calls; not a component module. */
import { widgetRegistry } from './WidgetRegistry';
import type { WidgetRendererProps, PropSchema } from './WidgetRegistry';
import {
  CarbonPVTextDisplay,
  CarbonPVTextInput,
  CarbonPVButton,
  CarbonPVSlider,
  CarbonPVToggle,
  CarbonPVProgressBar,
  CarbonPVLed,
} from '../pv-wrappers/CarbonWidgets';
import { LineWidget } from '../drawing/LineWidget';

// ── Shared prop schemas ─────────────────────────────────────────────────────

const pvSchema: PropSchema = {
  key: 'pvName',
  label: 'PV Name',
  type: 'pv',
  section: 'pv',
};

const alarmSchemas: PropSchema[] = [
  { key: 'alarmSensitiveBorder', label: 'Alarm Border', type: 'boolean', section: 'alarm' },
  { key: 'alarmSensitiveContent', label: 'Alarm Content', type: 'boolean', section: 'alarm' },
];

const appearanceSchemas: PropSchema[] = [
  { key: 'foregroundColor', label: 'Foreground', type: 'color', section: 'appearance' },
  { key: 'backgroundColor', label: 'Background', type: 'color', section: 'appearance' },
  { key: 'fontSize', label: 'Font Size', type: 'number', section: 'appearance', min: 8, max: 72 },
  {
    key: 'opacity',
    label: 'Opacity',
    type: 'number',
    section: 'appearance',
    min: 0,
    max: 1,
    step: 0.1,
  },
];

function RectangleWidget({ layout, props, isSelected }: WidgetRendererProps) {
  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        backgroundColor: props.fill ? (props.fillColor ?? '#393939') : 'transparent',
        border: `${props.lineWidth ?? 1}px ${props.lineStyle ?? 'solid'} ${props.lineColor ?? '#6f6f6f'}`,
        borderRadius: props.cornerRadius ?? 0,
        outline: isSelected ? '2px solid #0f62fe' : 'none',
      }}
    />
  );
}

function EllipseWidget({ layout, props, isSelected }: WidgetRendererProps) {
  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        backgroundColor: props.fill ? (props.fillColor ?? '#393939') : 'transparent',
        border: `${props.lineWidth ?? 1}px ${props.lineStyle ?? 'solid'} ${props.lineColor ?? '#6f6f6f'}`,
        borderRadius: '50%',
        outline: isSelected ? '2px solid #0f62fe' : 'none',
      }}
    />
  );
}

function StaticLabelWidget({ layout, props, isSelected }: WidgetRendererProps) {
  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        color: props.foregroundColor ?? '#f4f4f4',
        fontSize: props.fontSize ?? 14,
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        outline: isSelected ? '1px solid #0f62fe' : 'none',
        userSelect: 'none',
      }}
    >
      {props.text ?? 'Label'}
    </div>
  );
}

function GroupWidget({ layout, isSelected }: WidgetRendererProps) {
  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        border: `1px dashed ${isSelected ? '#0f62fe' : '#525252'}`,
        borderRadius: 2,
        backgroundColor: 'transparent',
      }}
    />
  );
}

// ── Register all built-in widgets ───────────────────────────────────────────

export function registerBuiltinWidgets() {
  // Display
  widgetRegistry.register({
    type: 'PVTextDisplay',
    label: 'Text Display',
    category: 'display',
    icon: 'TextLongParagraph',
    defaultLayout: { x: 0, y: 0, width: 160, height: 32 },
    defaultProps: { label: 'Readback', alarmSensitiveBorder: true },
    component: CarbonPVTextDisplay,
    propsSchema: [
      pvSchema,
      { key: 'label', label: 'Label', type: 'string', section: 'display' },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        section: 'display',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Decimal', value: 'decimal' },
          { label: 'Exponential', value: 'exponential' },
          { label: 'Hex', value: 'hex' },
          { label: 'Binary', value: 'binary' },
        ],
      },
      { key: 'precision', label: 'Precision', type: 'number', section: 'display', min: 0, max: 10 },
      { key: 'showUnits', label: 'Show Units', type: 'boolean', section: 'display' },
      ...alarmSchemas,
      ...appearanceSchemas,
    ],
  });

  // Input
  widgetRegistry.register({
    type: 'PVTextInput',
    label: 'Text Input',
    category: 'input',
    icon: 'TextInput',
    defaultLayout: { x: 0, y: 0, width: 160, height: 40 },
    defaultProps: { label: 'Setpoint' },
    component: CarbonPVTextInput,
    propsSchema: [
      pvSchema,
      { key: 'label', label: 'Label', type: 'string', section: 'display' },
      { key: 'confirmOnWrite', label: 'Confirm on Write', type: 'boolean', section: 'behavior' },
      { key: 'confirmMessage', label: 'Confirm Message', type: 'string', section: 'behavior' },
      { key: 'minValue', label: 'Min Value', type: 'number', section: 'behavior' },
      { key: 'maxValue', label: 'Max Value', type: 'number', section: 'behavior' },
      ...alarmSchemas,
      ...appearanceSchemas,
    ],
  });

  widgetRegistry.register({
    type: 'PVButton',
    label: 'Button',
    category: 'input',
    icon: 'TouchInteraction',
    defaultLayout: { x: 0, y: 0, width: 100, height: 36 },
    defaultProps: { label: 'Button', pressValue: 1 },
    component: CarbonPVButton,
    propsSchema: [
      pvSchema,
      { key: 'label', label: 'Label', type: 'string', section: 'display' },
      { key: 'pressValue', label: 'Press Value', type: 'string', section: 'behavior' },
      { key: 'confirmOnWrite', label: 'Confirm', type: 'boolean', section: 'behavior' },
      ...appearanceSchemas,
    ],
  });

  widgetRegistry.register({
    type: 'PVSlider',
    label: 'Slider',
    category: 'input',
    icon: 'Slider',
    defaultLayout: { x: 0, y: 0, width: 200, height: 48 },
    defaultProps: { orientation: 'horizontal', minValue: 0, maxValue: 100 },
    component: CarbonPVSlider,
    propsSchema: [
      pvSchema,
      {
        key: 'orientation',
        label: 'Orientation',
        type: 'select',
        section: 'display',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ],
      },
      { key: 'minValue', label: 'Min', type: 'number', section: 'behavior' },
      { key: 'maxValue', label: 'Max', type: 'number', section: 'behavior' },
      { key: 'showValueLabel', label: 'Show Value', type: 'boolean', section: 'display' },
      ...alarmSchemas,
    ],
  });

  widgetRegistry.register({
    type: 'PVToggle',
    label: 'Toggle',
    category: 'input',
    icon: 'ToggleFilled',
    defaultLayout: { x: 0, y: 0, width: 80, height: 32 },
    defaultProps: { onLabel: 'On', offLabel: 'Off' },
    component: CarbonPVToggle,
    propsSchema: [
      pvSchema,
      { key: 'onLabel', label: 'On Label', type: 'string', section: 'display' },
      { key: 'offLabel', label: 'Off Label', type: 'string', section: 'display' },
      ...alarmSchemas,
    ],
  });

  // Indicators
  widgetRegistry.register({
    type: 'PVLed',
    label: 'LED',
    category: 'indicator',
    icon: 'CircleFilled',
    defaultLayout: { x: 0, y: 0, width: 24, height: 24 },
    defaultProps: { onColor: '#24a148', offColor: '#525252' },
    component: CarbonPVLed,
    propsSchema: [
      pvSchema,
      { key: 'onColor', label: 'On Color', type: 'color', section: 'appearance' },
      { key: 'offColor', label: 'Off Color', type: 'color', section: 'appearance' },
      { key: 'bit', label: 'Bit', type: 'number', section: 'behavior', min: 0, max: 31 },
      ...alarmSchemas,
    ],
  });

  widgetRegistry.register({
    type: 'PVProgressBar',
    label: 'Progress Bar',
    category: 'indicator',
    icon: 'Meter',
    defaultLayout: { x: 0, y: 0, width: 200, height: 20 },
    defaultProps: { minValue: 0, maxValue: 100 },
    component: CarbonPVProgressBar,
    propsSchema: [
      pvSchema,
      { key: 'minValue', label: 'Min', type: 'number', section: 'behavior' },
      { key: 'maxValue', label: 'Max', type: 'number', section: 'behavior' },
      ...alarmSchemas,
      ...appearanceSchemas,
    ],
  });

  // Drawing
  widgetRegistry.register({
    type: 'Rectangle',
    label: 'Rectangle',
    category: 'drawing',
    icon: 'Checkbox',
    defaultLayout: { x: 0, y: 0, width: 100, height: 60 },
    defaultProps: { lineColor: '#6f6f6f', lineWidth: 1, fill: false },
    component: RectangleWidget,
    propsSchema: [
      { key: 'lineColor', label: 'Line Color', type: 'color', section: 'appearance' },
      {
        key: 'lineWidth',
        label: 'Line Width',
        type: 'number',
        section: 'appearance',
        min: 0,
        max: 20,
      },
      {
        key: 'lineStyle',
        label: 'Line Style',
        type: 'select',
        section: 'appearance',
        options: [
          { label: 'Solid', value: 'solid' },
          { label: 'Dashed', value: 'dashed' },
          { label: 'Dotted', value: 'dotted' },
        ],
      },
      { key: 'fill', label: 'Fill', type: 'boolean', section: 'appearance' },
      { key: 'fillColor', label: 'Fill Color', type: 'color', section: 'appearance' },
      {
        key: 'cornerRadius',
        label: 'Corner Radius',
        type: 'number',
        section: 'appearance',
        min: 0,
      },
    ],
  });

  widgetRegistry.register({
    type: 'Ellipse',
    label: 'Ellipse',
    category: 'drawing',
    icon: 'CircleDash',
    defaultLayout: { x: 0, y: 0, width: 60, height: 60 },
    defaultProps: { lineColor: '#6f6f6f', lineWidth: 1, fill: false },
    component: EllipseWidget,
    propsSchema: [
      { key: 'lineColor', label: 'Line Color', type: 'color', section: 'appearance' },
      {
        key: 'lineWidth',
        label: 'Line Width',
        type: 'number',
        section: 'appearance',
        min: 0,
        max: 20,
      },
      { key: 'fill', label: 'Fill', type: 'boolean', section: 'appearance' },
      { key: 'fillColor', label: 'Fill Color', type: 'color', section: 'appearance' },
    ],
  });

  widgetRegistry.register({
    type: 'Line',
    label: 'Line',
    category: 'drawing',
    icon: 'HorizontalLineSolid',
    defaultLayout: { x: 0, y: 0, width: 200, height: 100 },
    defaultProps: {
      lineColor: '#6f6f6f',
      lineWidth: 2,
      lineStyle: 'solid',
      arrowStart: false,
      arrowEnd: true,
      arrowSize: 10,
    },
    component: LineWidget,
    propsSchema: [
      { key: 'lineColor', label: 'Line Color', type: 'color', section: 'appearance' },
      {
        key: 'lineWidth',
        label: 'Line Width',
        type: 'number',
        section: 'appearance',
        min: 1,
        max: 20,
      },
      {
        key: 'lineStyle',
        label: 'Line Style',
        type: 'select',
        section: 'appearance',
        options: [
          { label: 'Solid', value: 'solid' },
          { label: 'Dashed', value: 'dashed' },
          { label: 'Dotted', value: 'dotted' },
        ],
      },
      { key: 'arrowStart', label: 'Arrow at Start', type: 'boolean', section: 'appearance' },
      { key: 'arrowEnd', label: 'Arrow at End', type: 'boolean', section: 'appearance' },
      {
        key: 'arrowSize',
        label: 'Arrow Size',
        type: 'number',
        section: 'appearance',
        min: 4,
        max: 30,
      },
    ],
  });

  widgetRegistry.register({
    type: 'StaticLabel',
    label: 'Label',
    category: 'drawing',
    icon: 'TextShortParagraph',
    defaultLayout: { x: 0, y: 0, width: 120, height: 24 },
    defaultProps: { text: 'Label', foregroundColor: '#f4f4f4', fontSize: 14 },
    component: StaticLabelWidget,
    propsSchema: [
      { key: 'text', label: 'Text', type: 'string', section: 'display' },
      ...appearanceSchemas,
    ],
  });

  // Containers
  widgetRegistry.register({
    type: 'Group',
    label: 'Group',
    category: 'container',
    icon: 'GroupObjects',
    defaultLayout: { x: 0, y: 0, width: 200, height: 150 },
    defaultProps: { layoutMode: 'absolute' },
    component: GroupWidget,
    propsSchema: [
      {
        key: 'layoutMode',
        label: 'Layout',
        type: 'select',
        section: 'display',
        options: [
          { label: 'Absolute', value: 'absolute' },
          { label: 'Flex', value: 'flex' },
          { label: 'Grid', value: 'grid' },
        ],
      },
    ],
  });
}

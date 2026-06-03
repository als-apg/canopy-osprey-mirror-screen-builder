// ── Alarm ──────────────────────────────────���───────────────���─────────────────

export const AlarmSeverity = {
  NO_ALARM: 0,
  MINOR: 1,
  MAJOR: 2,
  INVALID: 3,
  DISCONNECTED: 4,
} as const;
export type AlarmSeverity = (typeof AlarmSeverity)[keyof typeof AlarmSeverity];

export const AlarmSeverityName: Record<AlarmSeverity, string> = {
  [AlarmSeverity.NO_ALARM]: 'NO_ALARM',
  [AlarmSeverity.MINOR]: 'MINOR',
  [AlarmSeverity.MAJOR]: 'MAJOR',
  [AlarmSeverity.INVALID]: 'INVALID',
  [AlarmSeverity.DISCONNECTED]: 'DISCONNECTED',
};

// ── Display Format ──────────────────────────────���────────────────────────────

export const DisplayFormat = {
  Default: 'default',
  Decimal: 'decimal',
  Exponential: 'exponential',
  Hex: 'hex',
  Binary: 'binary',
  String: 'string',
  Engineering: 'engineering',
} as const;
export type DisplayFormat = (typeof DisplayFormat)[keyof typeof DisplayFormat];

// ── Rules & Actions ──────────────────────────────────────────────────────────

export interface RuleExpression {
  condition: string;
  value: unknown;
}

export interface RulePV {
  name: string;
  trigger: boolean;
}

export interface Rule {
  name: string;
  targetProperty: string;
  outputExpression: boolean;
  expressions: RuleExpression[];
  pvs: RulePV[];
}

export type Action =
  | {
      type: 'open_display';
      file: string;
      macros?: Record<string, string>;
      target: 'tab' | 'window' | 'replace';
    }
  | { type: 'write_pv'; pvName: string; value: string | number }
  | { type: 'execute'; command: string; description?: string }
  | { type: 'open_webpage'; url: string }
  | { type: 'open_file'; file: string };

// ── Layout ────────────────────────────────────────────────────────────────���──

export type LayoutMode = 'absolute' | 'flex' | 'grid';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface AbsoluteLayout extends Position, Size {}

// ── Widget Model ────────────────────────────────���────────────────────────────

export type WidgetType =
  // PV Wrappers (Carbon-based)
  | 'PVTextDisplay'
  | 'PVTextInput'
  | 'PVButton'
  | 'PVDropdown'
  | 'PVCheckbox'
  | 'PVRadioGroup'
  | 'PVSlider'
  | 'PVSpinbox'
  | 'PVToggle'
  | 'PVProgressBar'
  // Custom Instruments
  | 'PVLed'
  | 'PVByteIndicator'
  | 'PVMeter'
  | 'PVGauge'
  | 'PVTank'
  | 'PVThermometer'
  // Drawing
  | 'Rectangle'
  | 'Ellipse'
  | 'Line'
  | 'Arc'
  | 'StaticLabel'
  | 'ScreenImage'
  // Containers
  | 'Group'
  | 'EmbeddedScreen'
  | 'PVTabs';

export interface WidgetProps {
  // PV binding
  pvName?: string;
  pvBindings?: Record<string, string>;

  // Display
  label?: string;
  format?: DisplayFormat;
  precision?: number;
  precisionFromPV?: boolean;
  showUnits?: boolean;

  // Appearance
  foregroundColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  fontSize?: number;
  fontFamily?: string;
  opacity?: number;

  // Alarm
  alarmSensitiveBorder?: boolean;
  alarmSensitiveContent?: boolean;

  // Write widgets
  confirmOnWrite?: boolean;
  confirmMessage?: string;
  minValue?: number;
  maxValue?: number;
  limitsFromPV?: boolean;
  enabled?: boolean;

  // Button-specific
  pressValue?: string | number;
  releaseValue?: string | number;
  onLabel?: string;
  offLabel?: string;
  onColor?: string;
  offColor?: string;
  bit?: number;

  // Slider-specific
  orientation?: 'horizontal' | 'vertical';
  showScale?: boolean;
  showValueLabel?: boolean;
  increment?: number;

  // Shape-specific
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fill?: boolean;
  cornerRadius?: number;
  startAngle?: number;
  spanAngle?: number;

  // Image
  filename?: string;
  stretchMode?: 'none' | 'fit' | 'fill' | 'stretch';

  // Embedded display
  file?: string;
  macros?: Record<string, string>;
  resizeMode?: 'none' | 'resize' | 'sizeToContent' | 'stretch' | 'crop';

  // LED
  numBits?: number;
  startBit?: number;
  bigEndian?: boolean;

  // Container layout
  layoutMode?: LayoutMode;
  gap?: number;
  flexDirection?: 'row' | 'column';
  alignItems?: string;
  justifyContent?: string;

  // Text
  text?: string;

  // Allow arbitrary extra props
  [key: string]: unknown;
}

export interface Widget {
  id: string;
  type: WidgetType;
  name: string;
  layout: AbsoluteLayout;
  visible: boolean;
  rotation: number;
  rules: Rule[];
  actions: Action[];
  props: WidgetProps;
  children?: string[]; // child widget IDs for containers
  parentId?: string;
  locked?: boolean;
  zIndex: number;
}

// ── Screen Model ──────────────────��──────────────────────────────────────────

export interface ScreenMeta {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  macros: Record<string, string>;
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
  version: string;
  theme?: 'white' | 'g10' | 'g90' | 'g100';
}

export interface ScreenModel {
  meta: ScreenMeta;
  widgets: Record<string, Widget>;
  rootWidgetIds: string[];
  tabOrder: string[];
}

export function createDefaultScreenMeta(): ScreenMeta {
  return {
    title: 'New Screen',
    width: 800,
    height: 600,
    backgroundColor: '#262626',
    macros: {},
    gridSize: 10,
    showGrid: true,
    snapToGrid: true,
    version: '1.0.0',
    theme: 'g90',
  };
}

export function createDefaultScreen(): ScreenModel {
  return {
    meta: createDefaultScreenMeta(),
    widgets: {},
    rootWidgetIds: [],
    tabOrder: [],
  };
}

// IR widget type → Screen Builder widget mapping.
//
// Single source of truth for turning a converter-emitted `WidgetNode` (kebab
// registry id + IR props) into the SB's `WidgetType` + `WidgetProps`. Pure: no
// React, no store. Consumed by `importScreenJSON`.
//
// Two contracts drive the design:
//  - **Nothing is silently dropped.** `unknown-widget` (and any IR type not in
//    the table) becomes a `Rectangle` placeholder that preserves the original
//    class + props, and is reported. This mirrors the converter's D11 contract.
//  - **Eject must not break.** `Widget.type` is the closed `WidgetType` union
//    that `generateTSX` emits verbatim, so every mapping target is a real
//    catalog type — never a raw IR id.

import type { WidgetNode } from '@canopy/screen-ir';
import type { Action, WidgetType, WidgetProps } from '../../types/widget';

export interface MapResult {
  sbType: WidgetType;
  props: WidgetProps;
  /** Synthesized actions (e.g. `related-display-button` → `open_display`). */
  actions: Action[];
  /** IR prop keys deliberately discarded (no SB home). For the report. */
  droppedProps: string[];
  /** Set when the widget was degraded (chrome/semantics lost). For the report. */
  degradeReason?: string;
  /**
   * The mapper fell back to a placeholder (an `unknown-widget` or an IR type
   * with no SB mapping). `originalClass` is the preserved source class.
   */
  unknown?: { originalClass: string };
}

// ── Coercion helpers (mirror parseTSX's numProp style) ───────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/** Assign `props[key] = value` only when `value` is defined. */
function put(props: WidgetProps, key: string, value: unknown): void {
  if (value !== undefined) props[key] = value;
}

// ── Per-type prop mappers ────────────────────────────────────────────────────
// Each reads the IR props bag and writes the SB-named props. Keys not consumed
// here are passed through verbatim by the generic pass-through below (the
// `WidgetProps` index signature allows arbitrary keys), so unknown-but-harmless
// props survive rather than vanish.

type IRProps = Record<string, unknown>;
type PropMapper = (ir: IRProps, props: WidgetProps) => void;

const FOREGROUND = ['foregroundColor', 'backgroundColor', 'borderColor', 'fontSize', 'fontFamily'];
function copyAppearance(ir: IRProps, props: WidgetProps): void {
  for (const k of FOREGROUND) put(props, k, ir[k]);
}

const TYPE_MAP: Record<string, { sbType: WidgetType; map: PropMapper; degradeReason?: string }> = {
  'text-label': {
    sbType: 'StaticLabel',
    map: (ir, p) => {
      put(p, 'text', str(ir.text) ?? str(ir.label));
      copyAppearance(ir, p);
    },
  },
  'pv-label': {
    sbType: 'PVTextDisplay',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'format', ir.format);
      put(p, 'precision', num(ir.precision));
      put(p, 'showUnits', bool(ir.showUnits));
      put(p, 'precisionFromPV', bool(ir.precisionFromPV));
      copyAppearance(ir, p);
    },
  },
  'pv-text-input': {
    sbType: 'PVTextInput',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'confirmOnWrite', bool(ir.confirmOnWrite));
      put(p, 'confirmMessage', str(ir.confirmMessage));
    },
  },
  'pv-button': {
    sbType: 'PVButton',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'label', str(ir.label));
      put(p, 'pressValue', ir.pressValue);
      put(p, 'releaseValue', ir.releaseValue);
    },
  },
  'regular-button': {
    sbType: 'PVButton',
    map: (ir, p) => {
      put(p, 'label', str(ir.label));
      put(p, 'pressValue', ir.pressValue);
      put(p, 'releaseValue', ir.releaseValue);
    },
  },
  'pv-checkbox': {
    sbType: 'PVCheckbox',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'label', str(ir.label));
    },
  },
  'pv-enum-combobox': {
    sbType: 'PVDropdown',
    map: (ir, p) => put(p, 'pvName', str(ir.pv)),
  },
  'pv-slider': {
    sbType: 'PVSlider',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'minValue', num(ir.min));
      put(p, 'maxValue', num(ir.max));
      put(p, 'orientation', ir.orientation);
      put(p, 'showValueLabel', bool(ir.showValue));
      put(p, 'increment', num(ir.increment));
      put(p, 'showScale', bool(ir.showScale));
      put(p, 'limitsFromPV', bool(ir.limitsFromPV));
    },
  },
  'pv-progress-bar': {
    sbType: 'PVProgressBar',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'minValue', num(ir.min));
      put(p, 'maxValue', num(ir.max));
      put(p, 'orientation', ir.orientation);
    },
  },
  'pv-byte-led': {
    sbType: 'PVByteIndicator',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'numBits', num(ir.numBits));
      put(p, 'startBit', num(ir.shift));
      put(p, 'bigEndian', bool(ir.bigEndian));
      put(p, 'onColor', str(ir.onColor));
      put(p, 'offColor', str(ir.offColor));
    },
  },
  'pv-led': {
    sbType: 'PVLed',
    map: (ir, p) => {
      put(p, 'pvName', str(ir.pv));
      put(p, 'bit', num(ir.bit));
      put(p, 'onColor', str(ir.onColor));
      put(p, 'offColor', str(ir.offColor));
    },
  },
  'embedded-display': {
    sbType: 'EmbeddedScreen',
    map: (ir, p) => {
      put(p, 'file', str(ir.file));
      put(p, 'macros', ir.macros);
      put(p, 'resizeMode', ir.resizeMode);
    },
  },
  'image-view': {
    sbType: 'ScreenImage',
    map: (ir, p) => {
      put(p, 'filename', str(ir.src));
      put(p, 'stretchMode', ir.stretchMode);
    },
  },
  'related-display-button': {
    sbType: 'PVButton',
    // `file`/`macros` are turned into an open_display Action by mapWidget, not
    // props — so they're listed in CONSUMED_KEYS to keep them off the button.
    map: (ir, p) => put(p, 'label', str(ir.label)),
    degradeReason:
      'related-display navigation carried as an open_display action; review target window behavior',
  },
  // Containers degrade to Group: children + z-order survive, chrome does not.
  frame: {
    sbType: 'Group',
    map: (_ir, p) => {
      p.layoutMode = 'absolute';
    },
    degradeReason: 'frame border/shadow chrome is not represented; rendered as a plain Group',
  },
  'group-box': {
    sbType: 'Group',
    map: (ir, p) => {
      p.layoutMode = 'absolute';
      put(p, 'label', str(ir.title));
    },
    degradeReason: 'group-box title chrome is not represented; preserved as label on a plain Group',
  },
  'scroll-area': {
    sbType: 'Group',
    map: (_ir, p) => {
      p.layoutMode = 'absolute';
    },
    degradeReason:
      'scroll-area scrolling/clipping is not represented; children laid out absolutely',
  },
  tabs: {
    sbType: 'Group',
    map: (_ir, p) => {
      p.layoutMode = 'absolute';
    },
    degradeReason: 'tabs structure is not represented; pages flattened into a single Group',
  },
};

// IR prop keys each known mapper already consumes — used so the generic
// pass-through doesn't re-copy a key under its old IR name (e.g. leave a stray
// `pv` alongside the renamed `pvName`).
const CONSUMED_KEYS = new Set([
  'pv',
  'text',
  'label',
  'format',
  'precision',
  'showUnits',
  'precisionFromPV',
  'confirmOnWrite',
  'confirmMessage',
  'pressValue',
  'releaseValue',
  'min',
  'max',
  'orientation',
  'showValue',
  'increment',
  'showScale',
  'limitsFromPV',
  'numBits',
  'shift',
  'bigEndian',
  'onColor',
  'offColor',
  'bit',
  'file',
  'macros',
  'resizeMode',
  'src',
  'stretchMode',
  'title',
  ...FOREGROUND,
]);

/**
 * Map one IR widget node to its SB widget type + props.
 *
 * `unknown-widget` and any unrecognized IR type fall back to a `Rectangle`
 * placeholder that preserves the original class/props and is reported by the
 * caller. This is total — no IR type ever leaks through as a non-catalog type.
 */
export function mapWidget(node: WidgetNode): MapResult {
  const ir = (node.props ?? {}) as IRProps;

  if (node.type === 'unknown-widget' || !(node.type in TYPE_MAP)) {
    return mapUnknown(node, ir);
  }

  const entry = TYPE_MAP[node.type];
  const props: WidgetProps = {};
  entry.map(ir, props);

  const actions: Action[] = [];

  // related-display-button click opens another screen — carry that as an SB
  // open_display Action rather than props on the button.
  if (node.type === 'related-display-button') {
    const file = str(ir.file);
    if (file) {
      const macros = ir.macros;
      actions.push({
        type: 'open_display',
        file,
        target: 'window',
        ...(macros && typeof macros === 'object'
          ? { macros: macros as Record<string, string> }
          : {}),
      });
    }
  }

  // Generic pass-through: keep any IR prop the mapper didn't consume, so a
  // newer-than-SB prop survives import rather than vanishing.
  for (const [key, value] of Object.entries(ir)) {
    if (!CONSUMED_KEYS.has(key) && !(key in props)) props[key] = value;
  }

  return {
    sbType: entry.sbType,
    props,
    actions,
    droppedProps: [],
    degradeReason: entry.degradeReason,
  };
}

function mapUnknown(node: WidgetNode, ir: IRProps): MapResult {
  const originalClass = str(ir.originalClass) ?? node.type;
  const props: WidgetProps = {
    label: originalClass,
    fill: false,
    originalClass,
    originalProps: ir.originalProps ?? ir,
  };
  if (node.warnings?.length) props.warnings = [...node.warnings];
  return {
    sbType: 'Rectangle',
    props,
    actions: [],
    droppedProps: [],
    degradeReason: `unmapped widget '${originalClass}' rendered as a placeholder`,
    unknown: { originalClass },
  };
}

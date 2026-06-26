// Widget node types for the Canopy screen IR.

import type { Rule } from './rules.ts';

/**
 * Pixel-perfect bounds in canvas coordinates. Absolute-only for v0.1.
 *
 * Future additive extensions (non-breaking):
 * - Optional `geometry` to allow CSS-flow rendering
 * - `mode` discriminator for grid / flow / anchor
 * - `anchor: { right?, bottom? }` for Phoebus-style edge anchoring
 */
export interface Geometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Editor-facing annotations preserved across save.
 *
 * Ignored by the runtime renderer. Operators leave notes here that survive
 * round-trip — e.g. "DO NOT MOVE — fault response page reference".
 */
export interface WidgetMeta {
  readonly comment?: string;
}

/**
 * A widget property value. Most props are plain JSON literals.
 *
 * The `$`-prefix tagged form is reserved for non-literal values that the
 * runtime resolver needs to recognize (e.g. computed expressions in v0.2+).
 * v0.1 ships only `PropertyLiteral` and `MacroTemplate` (which is itself
 * just a string — macro substitution is detected via the widget's
 * `propSchema` `format: "pv-channel" | "macro-string"`, not via the value).
 */
export type PropertyValue = PropertyLiteral | PropertyTagged;

export type PropertyLiteral =
  | string
  | number
  | boolean
  | null
  | readonly PropertyValue[]
  | { readonly [key: string]: PropertyValue };

/**
 * Reserved escape hatch for v0.2+ — computed expressions, future binding
 * types. Detected by the leading `$` key prefix.
 */
export interface PropertyTagged {
  readonly [key: `$${string}`]: unknown;
}

export type Props = Readonly<Record<string, PropertyValue>>;

/**
 * One widget in the IR tree.
 *
 * - `id` is stable across saves; never regenerate on round-trip.
 * - `type` is the Canopy widget registry id (kebab-case, e.g. `"pv-label"`),
 *   never a Qt class name.
 * - `geometry` is absolute pixel coordinates.
 * - Z-order is array order of `children` — later siblings render on top.
 * - Rules are inline, in author form, attached by `targetProperty`.
 * - `unknown-widget` is the converter's fallback when a Qt class has no
 *   registry entry.
 */
export interface WidgetNode {
  readonly id: string;
  readonly type: string;
  readonly props: Props;
  readonly geometry: Geometry;
  readonly children?: readonly WidgetNode[];
  readonly rules?: readonly Rule[];
  readonly meta?: WidgetMeta;
  /**
   * Converter-emitted warnings that survive into the IR. Surfaced in SB as
   * inline indicators on the widget node. v0.1 most commonly populated by
   * `unknown-widget` placeholders.
   */
  readonly warnings?: readonly string[];
}

/**
 * Special widget type emitted by the converter for Qt classes with no
 * registry entry. The runtime renderer shows a visible TODO box; SB lets
 * authors replace it with a real widget. Original Qt props are preserved
 * verbatim under `originalProps` so nothing is silently lost.
 */
export interface UnknownWidgetProps {
  readonly originalClass: string;
  readonly originalProps: Readonly<Record<string, unknown>>;
}

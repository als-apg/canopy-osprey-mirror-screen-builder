// Screen-level Fox formula declarations for the Canopy screen IR.

/**
 * How Fox evaluates the formula. `"scalar"` is the common case (a single
 * computed value); `"timeseries"` / `"waveform"` are for array-valued PVs.
 */
export type FormulaKind = 'scalar' | 'timeseries' | 'waveform';

/**
 * A named screen-level formula evaluated by Canopy's Fox math engine.
 *
 * Formulas are referenced by name via the `fox://<name>` convention — from a
 * widget's channel prop (a "calc PV"), from a rule's PV binding
 * (`pvs[].name = "fox://<name>"`), or from a formula-driven rule
 * (`Rule.formula = "<name>"`). The reference is always just the name; the
 * `fox://` prefix marks it as a formula rather than a PV.
 *
 * `bindings` maps the placeholder names used in `expression` (e.g. `A`, `B`) to
 * the PV channels that feed them. Shape-compatible with Fox's `FormulaSpec`.
 */
export interface FormulaDeclaration {
  readonly name: string;
  /** Defaults to `"scalar"` when omitted. */
  readonly kind?: FormulaKind;
  readonly expression: string;
  readonly bindings?: Readonly<Record<string, string>>;
}

/** Prefix marking a value as a formula reference (`fox://<name>`) rather than a PV. */
export const FOX_PREFIX = 'fox://';

/** Whether `value` is a `fox://` formula reference. */
export function isFoxRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(FOX_PREFIX);
}

/** The bare formula name behind a reference, with the `fox://` prefix stripped if present. */
export function foxName(ref: string): string {
  return ref.startsWith(FOX_PREFIX) ? ref.slice(FOX_PREFIX.length) : ref;
}

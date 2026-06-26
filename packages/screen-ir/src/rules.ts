// Rule types for the Canopy screen IR — author form only.
// Runtime form (FormulaSpec) is derived client-side at subscription time.

/**
 * One PV binding referenced by a rule's conditions.
 *
 * Conditions reference these by 0-based index (`{0}`, `{1}`, ...) so renames
 * stay stable across the rule's lifetime. `name` may contain `${MACRO}`
 * substitutions — resolved client-side before subscribing to Fox.
 */
export interface RulePvBinding {
  readonly name: string;
  /** Whether changes to this PV trigger re-evaluation. Almost always `true`. */
  readonly trigger: boolean;
}

/**
 * One condition in the ordered condition/value list. Evaluated top to bottom.
 * The first condition whose `expression` is truthy wins; if none match, the
 * rule's `default` is used.
 *
 * `expression` references PVs by `{N}` placeholder — e.g. `"{0} > 1"`.
 */
export interface RuleCondition {
  readonly expression: string;
  /** JSON-serializable scalar matching the target property's type. */
  readonly value: string | number | boolean | null;
}

/**
 * Fields common to both rule arms.
 *
 * `targetProperty` is any rule-bindable property of the
 * widget, where bindable = JSON scalar/enum in the widget's `propSchema`
 * minus `format: "pv-channel"` fields. Output type must match the property's
 * declared type — checked client-side in the SB Rule Editor.
 */
interface RuleBase {
  readonly id: string;
  readonly name: string;
  readonly targetProperty: string;
  /** Value written to the target property when no condition matches. */
  readonly default: string | number | boolean | null;
}

/**
 * A widget property rule (author form). A discriminated union of two arms:
 *
 * - **Conditional** (`conditions`): an ordered condition→value table over `pvs`.
 *   This is the common case and exactly what the `.edl`/`.ui` converter emits.
 *   A `pvs[].name` may be a `fox://<name>` reference, so conditions can test the
 *   output of a screen-level formula alongside raw PVs.
 * - **Formula-driven** (`formula`): the target property is set directly to the
 *   continuous output of the named screen-level `FormulaDeclaration` — no
 *   condition table. `formula` is the formula's `name` (the bare name, not the
 *   `fox://` form).
 *
 * Both arms compile client-side to a Fox `FormulaSpec` at subscription time;
 * compiled form is never stored.
 */
export type Rule =
  | (RuleBase & {
      readonly pvs: readonly RulePvBinding[];
      readonly conditions: readonly RuleCondition[];
    })
  | (RuleBase & {
      readonly formula: string;
    });

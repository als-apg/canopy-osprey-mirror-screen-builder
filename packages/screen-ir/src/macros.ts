// Macro types for the Canopy screen IR.

export const MACRO_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Author-time declaration of a macro on a screen.
 *
 * - `default` is required for `kind: "screen"`, forbidden for `kind: "template"`.
 * - `name` must match {@link MACRO_NAME_PATTERN}.
 */
export interface MacroDeclaration {
  readonly name: string;
  readonly default?: string;
  readonly description?: string;
}

/**
 * Runtime macro values. Provided by Workbench navigation, related-display
 * navigation, embedded-display parents, or the SB Run Mode dialog.
 *
 * NEVER stored in the IR — the IR holds templates, runtime resolves to values.
 */
export type MacroValues = Readonly<Record<string, string>>;

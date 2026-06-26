// Top-level screen / template types for the Canopy IR.

import type { FormulaDeclaration } from './formula.ts';
import type { MacroDeclaration } from './macros.ts';
import type { WidgetNode } from './widget.ts';

/** Current schema version. Bump on breaking change; minor bump on additive. */
export const SCHEMA_VERSION = '1.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/**
 * `"screen"` is a directly-renderable screen. `"template"` is a parameterized
 * fragment that requires explicit macro values at instantiation — its
 * `MacroDeclaration`s must NOT have defaults.
 */
export type ScreenKind = 'screen' | 'template';

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Where this screen came from. Used by tooling and round-trip tests; not
 * required at runtime.
 *
 * Open by design: saved screen files are permanent, and the (disposable) `.edl`
 * /`.ui` converter stamps its own source types (e.g. `"edl-converter"`,
 * `"ui-converter"`). The editor must read those forever, so `type` is `string`.
 * The named variants are kept for authoring convenience / autocomplete, not as
 * an exhaustive list.
 */
export type ScreenSource =
  | { readonly type: 'screen-builder'; readonly savedAt: string }
  | { readonly type: 'hand-authored' }
  | {
      readonly type: string;
      readonly savedAt?: string;
      readonly sourceFile?: string;
      readonly convertedAt?: string;
    };

export interface ScreenMetadata {
  readonly title: string;
  readonly source: ScreenSource;
  readonly size: ScreenSize;
  readonly description?: string;
  readonly author?: string;
}

/**
 * The canonical Canopy screen Intermediate Representation.
 *
 * Round-trip identity is a hard contract: open → save without edits → byte
 * (or at minimum semantically) identical output. Validators enforce this in
 * tests.
 */
export interface ScreenJSON {
  readonly schemaVersion: SchemaVersion;
  readonly kind: ScreenKind;
  readonly id: string;
  readonly metadata: ScreenMetadata;
  readonly macros: readonly MacroDeclaration[];
  /**
   * Screen-level Fox formula declarations, referenced by `fox://<name>` from
   * channel props and rules. Optional — a screen with no formulas omits it.
   */
  readonly formulas?: readonly FormulaDeclaration[];
  readonly root: WidgetNode;
}

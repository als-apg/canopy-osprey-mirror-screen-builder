// @canopy/screen-ir public surface.
// Types only in v0.1. Validators and migrations land in follow-up commits.

export { SCHEMA_VERSION } from './screen.ts';
export type {
  SchemaVersion,
  ScreenKind,
  ScreenSize,
  ScreenSource,
  ScreenMetadata,
  ScreenJSON,
} from './screen.ts';

export { MACRO_NAME_PATTERN } from './macros.ts';
export type { MacroDeclaration, MacroValues } from './macros.ts';

export type { FormulaDeclaration, FormulaKind } from './formula.ts';

export type {
  WidgetNode,
  Geometry,
  WidgetMeta,
  PropertyValue,
  PropertyLiteral,
  PropertyTagged,
  Props,
  UnknownWidgetProps,
} from './widget.ts';

export type { Rule, RulePvBinding, RuleCondition } from './rules.ts';

export { validate } from './validate.ts';

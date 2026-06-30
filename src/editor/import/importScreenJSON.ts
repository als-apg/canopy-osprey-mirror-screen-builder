// Import a canonical screen IR document (`*.screen.json`) into the Screen
// Builder's internal `ScreenModel`.
//
// Pure: JSON in, `{ screen, report }` out, no I/O. Shared by both entry points —
// opening a saved `.screen.json` locally, and the live `.ui`/`.edl` converter
// flow (which feeds in the DTO's `screen` field).
//
// The core transform is **tree → flat map**: the IR nests widgets via
// `root.children` with absolute geometry and array-order z-order; the SB stores
// a flat `widgets` record keyed by id with a `rootWidgetIds` list.

import { validate, SCHEMA_VERSION } from '@canopy/screen-ir';
import type { ScreenJSON, WidgetNode, Rule as IRRule } from '@canopy/screen-ir';
import type { Rule, RuleExpression, ScreenModel, ScreenMeta, Widget } from '../../types/widget';
import { createDefaultScreenMeta } from '../../types/widget';
import { mapWidget } from './irWidgetMap';

/** Thrown when the input document fails `@canopy/screen-ir`'s `validate()`. */
export class ImportValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Screen IR validation failed:\n${errors.join('\n')}`);
    this.name = 'ImportValidationError';
    this.errors = errors;
  }
}

/** Everything the import touched that the user should know about. */
export interface ImportReport {
  /** D11 placeholders, aggregated by original Qt class. */
  unknownWidgets: { originalClass: string; count: number }[];
  /** Widgets imported with reduced fidelity (chrome/semantics lost). */
  degradedWidgets: { widgetId: string; type: string; reason: string }[];
  /** IR prop keys discarded with no SB home. */
  droppedProps: { widgetId: string; type: string; keys: string[] }[];
  /** Formula-driven rules dropped (no SB equivalent yet). */
  droppedRules: string[];
  /** Node warnings + soft import notes (e.g. duplicate-id renames). */
  warnings: string[];
}

function emptyReport(): ImportReport {
  return {
    unknownWidgets: [],
    degradedWidgets: [],
    droppedProps: [],
    droppedRules: [],
    warnings: [],
  };
}

/**
 * Convert a screen IR document to a `ScreenModel` + an `ImportReport`.
 *
 * Validates against the full Screen IR contract first; throws
 * `ImportValidationError` (carrying the messages) on any failure, so the caller
 * never replaces the canvas with a half-imported screen.
 */
export function importScreenJSON(json: unknown): { screen: ScreenModel; report: ImportReport } {
  // Read-tolerance: the converter omits `macros` entirely on a screen with no
  // macros, but the canonical schema requires the key (an absent array and `[]`
  // are semantically identical). Normalize before validating rather than
  // weakening the shared contract. Other absent-but-defaultable fields stay the
  // schema's concern.
  const normalized = normalizeForRead(json);

  const errors = validate(normalized);
  if (errors.length > 0) throw new ImportValidationError(errors);

  const doc = normalized as ScreenJSON;
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    throw new ImportValidationError([
      `unsupported schemaVersion '${doc.schemaVersion}', expected '${SCHEMA_VERSION}'`,
    ]);
  }

  const report = emptyReport();
  const meta = buildMeta(doc);

  const widgets: Record<string, Widget> = {};
  const rootWidgetIds: string[] = [];
  const unknownCounts = new Map<string, number>();
  let zCounter = 0;
  const usedIds = new Set<string>();

  // Stable id reuse: the IR's `w-NNN` ids are meaningful (rules/refs point at
  // them), so reuse them verbatim. Only synthesize on the rare collision.
  const claimId = (rawId: string): string => {
    let id = rawId;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${rawId}-${n++}`;
      report.warnings.push(`duplicate widget id '${rawId}' renamed to '${id}'`);
    }
    usedIds.add(id);
    return id;
  };

  const walk = (node: WidgetNode, parentId: string | undefined): string => {
    const id = claimId(node.id);
    const mapped = mapWidget(node);

    if (mapped.unknown) {
      const oc = mapped.unknown.originalClass;
      unknownCounts.set(oc, (unknownCounts.get(oc) ?? 0) + 1);
    } else if (mapped.degradeReason) {
      report.degradedWidgets.push({ widgetId: id, type: node.type, reason: mapped.degradeReason });
    }
    if (mapped.droppedProps.length > 0) {
      report.droppedProps.push({ widgetId: id, type: node.type, keys: mapped.droppedProps });
    }
    if (node.warnings?.length) report.warnings.push(...node.warnings);

    const childIds = (node.children ?? []).map((child) => walk(child, id));

    const widget: Widget = {
      id,
      type: mapped.sbType,
      name: `${mapped.sbType}_${id}`,
      layout: {
        x: node.geometry.x,
        y: node.geometry.y,
        width: node.geometry.width,
        height: node.geometry.height,
      },
      visible: true,
      rotation: 0,
      rules: mapRules(node.rules, id, report),
      actions: mapped.actions,
      props: mapped.props,
      zIndex: zCounter++,
    };
    if (parentId) widget.parentId = parentId;
    if (childIds.length > 0) widget.children = childIds;

    widgets[id] = widget;
    return id;
  };

  // The `absolute-canvas` root is a structural wrapper, not a user widget — its
  // size already fed `meta`; only its children become real widgets.
  for (const child of doc.root.children ?? []) {
    rootWidgetIds.push(walk(child, undefined));
  }

  report.unknownWidgets = [...unknownCounts].map(([originalClass, count]) => ({
    originalClass,
    count,
  }));

  const screen: ScreenModel = {
    meta,
    widgets,
    rootWidgetIds,
    tabOrder: [...rootWidgetIds],
  };
  return { screen, report };
}

/**
 * Default absent-but-empty-equivalent fields so valid-in-spirit converter
 * output passes the schema gate. Currently just `macros: []` (the converter
 * omits it when empty). Non-object input is returned untouched for `validate()`
 * to reject with a precise message.
 */
function normalizeForRead(json: unknown): unknown {
  if (!json || typeof json !== 'object') return json;
  const obj = json as Record<string, unknown>;
  if (obj.macros === undefined) return { ...obj, macros: [] };
  return json;
}

function buildMeta(doc: ScreenJSON): ScreenMeta {
  const meta = createDefaultScreenMeta();
  meta.title = doc.metadata.title;
  meta.width = doc.metadata.size.width;
  meta.height = doc.metadata.size.height;
  meta.macros = Object.fromEntries((doc.macros ?? []).map((m) => [m.name, m.default ?? '']));
  // Lossless: screen-level formulas are author-facing and survive eject.
  if (doc.formulas && doc.formulas.length > 0) meta.formulas = [...doc.formulas];
  return meta;
}

/**
 * Map IR rules (a discriminated union) to SB rules (a single flat shape).
 *
 * - **Formula-driven** rules have no SB equivalent yet → dropped + reported.
 * - **Conditional** rules map `conditions[].expression` → `expressions[].condition`
 *   (note the field flip), and the IR `default` is folded into a trailing
 *   catch-all `{ condition: 'true', value: default }` so its semantics survive.
 * The IR `id` is dropped (SB rules have none); `pvs` map 1:1, leaving
 * `fox://`/`${MACRO}` names literal.
 */
function mapRules(
  irRules: readonly IRRule[] | undefined,
  widgetId: string,
  report: ImportReport
): Rule[] {
  const rules: Rule[] = [];
  for (const ir of irRules ?? []) {
    if ('formula' in ir) {
      report.droppedRules.push(`${ir.name} (formula-driven) on widget '${widgetId}'`);
      report.warnings.push(
        `rule '${ir.name}' on '${widgetId}' is formula-driven and was dropped (no SB support yet)`
      );
      continue;
    }
    const expressions: RuleExpression[] = ir.conditions.map((c) => ({
      condition: c.expression,
      value: c.value,
    }));
    expressions.push({ condition: 'true', value: ir.default });
    rules.push({
      name: ir.name,
      targetProperty: ir.targetProperty,
      outputExpression: false,
      expressions,
      pvs: ir.pvs.map((pv) => ({ name: pv.name, trigger: pv.trigger })),
    });
  }
  return rules;
}

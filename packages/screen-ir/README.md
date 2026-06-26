# `@canopy/screen-ir`

Canonical Canopy screen Intermediate Representation. The single seam between
authoring inputs (Screen Builder, `.ui` converter) and rendering outputs
(Screen JSON, ejectable React TSX, runtime renderer).

## Status

- **v0.1:** TypeScript types only.
- **v0.2 (this package):** runtime `validate()` (ajv) over a vendored JSON Schema,
  plus a conformance test against real converter output. `formulas[]`, the Rule
  union, and `fox://` references land here.
- **v0.3+:** `migrate()` across schema versions; possible codegen of types from
  the schema if hand-maintenance gets painful.

## Read-tolerant, write-strict

`@canopy/screen-ir` is the **canonical** screen contract. The `.edl`/`.ui`
converter is disposable migration scaffolding; the editor, the runtime, and the
saved `*.screen.json` files are permanent — so this package owns the format and
the converter conforms to it.

The IR _types_ and `validate()` accept the loose **superset** the editor must be
able to open: converter-stamped `source` types (`"edl-converter"`), hoisted
`formulas[]`, rule conditions with computed inputs. The editor _writes_ a tight
subset. Lenient on input, strict on output.

## Formulas & rules

Formulas are permanent and author-facing (calc PVs and rules both use Canopy's
Fox math engine). A screen-level `FormulaDeclaration` is referenced by name via
the `fox://<name>` convention from three places:

1. **Calc PV** — a channel prop holds `"fox://<name>"` (`props.pv`).
2. **Rule condition input** — a rule's `pvs[].name` may be `"fox://<name>"`, so
   conditions test computed values alongside raw PVs.
3. **Formula-driven property** — `Rule` with `{ formula: "<name>" }` (no
   conditions); the target property is the formula's continuous output.

`Rule` is a **discriminated union**: the _conditional_ arm
(`{ pvs[], conditions[], default }`, exactly what the converter emits) or the
_formula_ arm (`{ formula, default }`). `validate()` enforces "exactly one arm"
and that every `fox://` reference resolves to a declared formula.

Property values stay **literal-only**: `fox://` lives in channel props and
rule objects, never smuggled into an arbitrary scalar prop value.

## Validation

```ts
import { validate } from '@canopy/screen-ir';
const errors = validate(screenDocument); // string[]; [] === valid
```

`validate()` layers two things: structural conformance to the vendored JSON
Schema, then the semantic rules the schema can't express (macro defaults, the
Rule union, `fox://` resolution). It is the _full_ contract, not just the
structural subset.

### The schema is ours

`schema/screen-ir.schema.json` is **owned by this package** — the
screen-builder-published contract artifact, hand-maintained to mirror the
TypeScript types in `src/`. It is the structural subset; the cross-field rules
(macro defaults, the Rule union arm, `fox://` resolution) live in `validate()`'s
semantic layer because JSON Schema can't express them.

The TypeScript types are the primary source of truth (developers edit those);
the schema is the consumable artifact derived from them. The conformance test
(`test/conformance.test.ts`) keeps the two honest — every fixture must satisfy
`validate()`, and the type-only example must compile.

Downstream consumers (notably the disposable `.edl`/`.ui` converter) vendor
**this** file and validate their output against it — the converter no longer
defines the contract; it conforms to it.

## Public surface

```ts
import type {
  ScreenJSON,
  WidgetNode,
  Geometry,
  Rule,
  MacroDeclaration,
  MacroValues,
} from '@canopy/screen-ir';
```

See [`src/index.ts`](src/index.ts) for the full export list.

## Round-trip identity

The IR is `readonly` everywhere. All mutations in Screen Builder go through
the command pattern (Zustand + immer), which produces a new IR. Saves
serialize the IR as-is; opens validate against the schema and produce the
same shape. A round-trip identity test will land alongside `validate()`.

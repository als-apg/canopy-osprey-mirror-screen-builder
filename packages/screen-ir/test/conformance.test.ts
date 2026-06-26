// Conformance + smoke tests for the Screen IR contract.
//
// The positive cases are the drift tripwire: real converter output and a
// hand-authored formula-arm screen must both satisfy validate(). If the
// converter's output shape drifts, the first test goes red here instead of a
// user hitting a broken screen. The negative cases prove validate() actually
// enforces the semantic rules the JSON Schema can't express.

import { describe, expect, it } from 'vitest';

import { validate } from '../src/index.ts';
import { example } from '../examples/typecheck.ts';

import converterGolden from './fixtures/p1_widgets.screen.json' with { type: 'json' };
import formulaDriven from './fixtures/formula-driven.screen.json' with { type: 'json' };

describe('validate() — conformance', () => {
  it('accepts real converter output (edl-converter golden fixture)', () => {
    expect(validate(converterGolden)).toEqual([]);
  });

  it('accepts the hand-authored formula-driven screen (formula arm + fox:// refs)', () => {
    expect(validate(formulaDriven)).toEqual([]);
  });

  it('accepts the type-only example literal at runtime', () => {
    expect(validate(example)).toEqual([]);
  });
});

describe('validate() — semantic rules the schema cannot express', () => {
  it('rejects a screen macro with no default', () => {
    const bad = {
      ...formulaDriven,
      macros: [{ name: 'P' }],
    };
    expect(validate(bad)).toContainEqual(expect.stringContaining("macro 'P' needs a default"));
  });

  it('rejects a dangling fox:// reference', () => {
    const bad = structuredClone(formulaDriven) as typeof formulaDriven;
    // r-001 references f-002; drop f-002 so the reference dangles.
    (bad as { formulas: unknown[] }).formulas = bad.formulas.filter((f) => f.name !== 'f-002');
    expect(validate(bad)).toContainEqual(expect.stringContaining("references formula 'f-002'"));
  });

  it('rejects a rule with both conditions and formula (neither union arm matches)', () => {
    const bad = structuredClone(formulaDriven) as typeof formulaDriven;
    const rule = bad.root.children[0].rules[0] as Record<string, unknown>;
    // r-001 is a formula-arm rule; adding conditions/pvs makes it match neither
    // arm of the Rule oneOf (each arm seals against the other's keys).
    rule.conditions = [];
    rule.pvs = [];
    expect(validate(bad).length).toBeGreaterThan(0);
  });
});

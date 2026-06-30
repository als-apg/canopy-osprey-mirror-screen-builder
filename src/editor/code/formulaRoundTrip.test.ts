import { describe, it, expect } from 'vitest';
import { generateTSX } from './generateTSX';
import { parseTSX } from './parseTSX';
import { createDefaultScreen } from '../../types/widget';
import type { FormulaDeclaration } from '@canopy/screen-ir';

describe('formula round-trip (generateTSX ↔ parseTSX)', () => {
  it('preserves screen-level formulas through eject and re-open', () => {
    const formulas: FormulaDeclaration[] = [
      { name: 'sum', kind: 'scalar', expression: 'A+B', bindings: { A: 'X:VAL', B: 'Y:VAL' } },
      { name: 'avg', kind: 'scalar', expression: '(A+B)/2', bindings: { A: 'X', B: 'Y' } },
    ];
    const screen = createDefaultScreen();
    screen.meta.formulas = formulas;
    screen.meta.macros = { P: 'DEV' };

    const tsx = generateTSX(screen);
    expect(tsx).toContain('formulas:');

    const reparsed = parseTSX(tsx);
    expect(reparsed.meta.formulas).toEqual(formulas);
    expect(reparsed.meta.macros).toEqual({ P: 'DEV' });
  });

  it('omits the formulas line when there are none', () => {
    const screen = createDefaultScreen();
    const tsx = generateTSX(screen);
    expect(tsx).not.toContain('formulas:');
    expect(parseTSX(tsx).meta.formulas).toBeUndefined();
  });
});

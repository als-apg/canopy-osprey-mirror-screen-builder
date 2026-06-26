// Type-only smoke test: an authored screen literal must satisfy ScreenJSON.
// If this file fails `tsc --noEmit`, the IR types and the example are out of sync.

import type { ScreenJSON } from '../src/index.ts';

export const example: ScreenJSON = {
  schemaVersion: '1.0',
  kind: 'screen',
  id: 'vacuum-system',
  metadata: {
    title: 'Vacuum System',
    source: { type: 'screen-builder', savedAt: '2026-06-19T10:00:00Z' },
    size: { width: 800, height: 600 },
  },
  macros: [
    { name: 'PREFIX', default: 'DEMO:VAC1', description: 'Device prefix' },
    { name: 'DEVICE', default: 'Q1' },
  ],
  formulas: [
    {
      name: 'avg-pressure',
      kind: 'scalar',
      expression: '(A + B) / 2',
      bindings: { A: '${PREFIX}:P1', B: '${PREFIX}:P2' },
    },
  ],
  root: {
    id: 'w-001',
    type: 'absolute-canvas',
    props: { width: 800, height: 600 },
    geometry: { x: 0, y: 0, width: 800, height: 600 },
    children: [
      {
        id: 'w-002',
        type: 'pv-label',
        props: {
          pv: '${PREFIX}:PRESSURE',
          precision: 'fromPV',
          alarmSensitive: true,
          alarmBorder: true,
        },
        geometry: { x: 10, y: 20, width: 200, height: 30 },
        rules: [
          {
            id: 'r-001',
            name: 'Border color from severity',
            targetProperty: 'alarmBorder',
            pvs: [{ name: '${PREFIX}:STATUS:SEV', trigger: true }],
            conditions: [{ expression: '{0} > 1', value: true }],
            default: false,
          },
        ],
        meta: { comment: 'Primary pressure readout — DO NOT MOVE' },
      },
      {
        id: 'w-003',
        type: 'pv-slider',
        props: { pv: '${PREFIX}:SETPOINT', min: 0, max: 100 },
        geometry: { x: 10, y: 60, width: 200, height: 40 },
      },
      {
        id: 'w-004',
        type: 'embedded-display',
        props: {
          file: 'motor-control.screen.json',
          macros: { MOTOR: '${PREFIX}:M1' },
        },
        geometry: { x: 250, y: 20, width: 400, height: 200 },
      },
      {
        // Calc PV (channel = formula) + a formula-driven rule (the union's
        // formula arm). Exercises the new surface at the type level.
        id: 'w-005',
        type: 'pv-label',
        props: { pv: 'fox://avg-pressure' },
        geometry: { x: 10, y: 110, width: 200, height: 30 },
        rules: [
          {
            id: 'r-002',
            name: 'Width tracks averaged pressure',
            targetProperty: 'width',
            formula: 'avg-pressure',
            default: null,
          },
        ],
      },
    ],
  },
};

// A converter-shaped source must satisfy the (now open) ScreenSource type.
export const convertedSource: ScreenJSON['metadata']['source'] = { type: 'edl-converter' };

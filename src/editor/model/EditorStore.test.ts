import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useEditorStore } from './EditorStore';
import type { ScreenModel, Widget } from '../../types/widget';
import { createDefaultScreen } from '../../types/widget';

// Build a screen with a container `group` holding two children `a` and `b`,
// plus an unrelated top-level widget `c`. Geometry is stored ABSOLUTE.
function nestedScreen(): ScreenModel {
  const screen = createDefaultScreen();
  const mk = (id: string, x: number, y: number, extra: Partial<Widget> = {}): Widget => ({
    id,
    type: 'Rectangle',
    name: id,
    layout: { x, y, width: 50, height: 50 },
    visible: true,
    rotation: 0,
    rules: [],
    actions: [],
    props: {},
    zIndex: 0,
    ...extra,
  });
  screen.widgets = {
    group: mk('group', 100, 100, { type: 'Group', children: ['a', 'b'] }),
    a: mk('a', 110, 110, { parentId: 'group' }),
    b: mk('b', 160, 110, { parentId: 'group' }),
    c: mk('c', 400, 400),
  };
  screen.rootWidgetIds = ['group', 'c'];
  return screen;
}

describe('moveWidgets', () => {
  beforeEach(() => {
    // Disable snap so deltas are exact, and load a fresh nested screen.
    const screen = nestedScreen();
    screen.meta.snapToGrid = false;
    useEditorStore.getState().setScreen(screen);
  });

  const move = (ids: string[], dx: number, dy: number) =>
    useEditorStore.getState().moveWidgets(ids, dx, dy);
  const at = (id: string) => useEditorStore.getState().screen.widgets[id].layout;

  it('moving a container carries its whole subtree by the same delta', () => {
    move(['group'], 10, 20);
    expect(at('group')).toMatchObject({ x: 110, y: 120 });
    expect(at('a')).toMatchObject({ x: 120, y: 130 });
    expect(at('b')).toMatchObject({ x: 170, y: 130 });
    // An unrelated widget is untouched.
    expect(at('c')).toMatchObject({ x: 400, y: 400 });
  });

  it('does not double-move a child selected alongside its ancestor', () => {
    move(['group', 'a'], 10, 0);
    // `a` rides the container once (not twice).
    expect(at('a')).toMatchObject({ x: 120, y: 110 });
    expect(at('group')).toMatchObject({ x: 110, y: 100 });
  });

  it('moves a lone child without touching its parent', () => {
    move(['a'], 5, 5);
    expect(at('a')).toMatchObject({ x: 115, y: 115 });
    expect(at('group')).toMatchObject({ x: 100, y: 100 });
    expect(at('b')).toMatchObject({ x: 160, y: 110 });
  });
});

describe('saveToFile name suggestion', () => {
  let suggestedName: string | undefined;

  beforeEach(() => {
    suggestedName = undefined;
    // Capture the name the save picker is asked for, and no-op the write.
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = vi.fn(
      async (opts: { suggestedName?: string }) => {
        suggestedName = opts.suggestedName;
        return {
          name: opts.suggestedName ?? '',
          createWritable: async () => ({ write: async () => {}, close: async () => {} }),
        };
      }
    );
  });

  afterEach(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('suggests .tsx even when filePath is a .screen.json from a legacy import', async () => {
    useEditorStore.getState().setFilePath('vac_li04_VP.screen.json');
    await useEditorStore.getState().saveToFile();
    expect(suggestedName).toBe('vac_li04_VP.tsx');
  });

  it('keeps a .tsx filePath as .tsx', async () => {
    useEditorStore.getState().setFilePath('my_screen.tsx');
    await useEditorStore.getState().saveToFile();
    expect(suggestedName).toBe('my_screen.tsx');
  });

  it('falls back to screen.tsx when no filePath is set', async () => {
    useEditorStore.getState().setFilePath(null);
    await useEditorStore.getState().saveToFile();
    expect(suggestedName).toBe('screen.tsx');
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useEditorStore } from './EditorStore';
import type { ScreenModel, Widget } from '../../types/widget';
import { createDefaultScreen } from '../../types/widget';
import { importScreenJSON } from '../import/importScreenJSON';

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

describe('save and export file flows', () => {
  let suggestedName: string | undefined;
  let written: string | undefined;
  let pickerCalls: number;

  beforeEach(() => {
    suggestedName = undefined;
    written = undefined;
    pickerCalls = 0;
    // Fresh default screen (title 'New Screen'), clean store.
    useEditorStore.getState().setScreen(createDefaultScreen());
    useEditorStore.getState().setFilePath(null);
    useEditorStore.getState().clearImportReport();
    // Capture the name the save picker is asked for and the bytes written.
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = vi.fn(
      async (opts: { suggestedName?: string }) => {
        pickerCalls += 1;
        suggestedName = opts.suggestedName;
        return {
          name: opts.suggestedName ?? '',
          createWritable: async () => ({
            write: async (data: string) => {
              written = data;
            },
            close: async () => {},
          }),
        };
      }
    );
  });

  afterEach(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('keeps a .screen.json filePath as-is', async () => {
    useEditorStore.getState().setFilePath('vac_li04_VP.screen.json');
    await useEditorStore.getState().saveToFile();
    expect(suggestedName).toBe('vac_li04_VP.screen.json');
  });

  it('re-suffixes a legacy .tsx filePath to .screen.json', async () => {
    useEditorStore.getState().setFilePath('my_screen.tsx');
    await useEditorStore.getState().saveToFile();
    expect(suggestedName).toBe('my_screen.screen.json');
  });

  it('falls back to the sanitized title when no filePath is set', async () => {
    await useEditorStore.getState().saveToFile();
    expect(suggestedName).toBe('NewScreen.screen.json');
  });

  it('saveAsFile always suggests from the title', async () => {
    useEditorStore.getState().setFilePath('something_else.screen.json');
    useEditorStore.getState().updateScreenMeta({ title: 'Vacuum System' });
    await useEditorStore.getState().saveAsFile();
    expect(suggestedName).toBe('VacuumSystem.screen.json');
  });

  it('writes a valid IR document, marks the store clean, and adopts the saved name', async () => {
    useEditorStore.getState().updateScreenMeta({ title: 'My Screen' }); // marks dirty
    await useEditorStore.getState().saveToFile();

    expect(written).toBeDefined();
    expect(written!.endsWith('\n')).toBe(true);
    const doc: unknown = JSON.parse(written!);
    expect((doc as { schemaVersion: string }).schemaVersion).toBe('1.0');
    // The written document must round-trip through the importer.
    expect(() => importScreenJSON(doc)).not.toThrow();

    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().filePath).toBe('MyScreen.screen.json');
    expect(useEditorStore.getState().saveError).toBeNull();
  });

  it('surfaces an ExportError as saveError and writes nothing', async () => {
    // 'bad name' violates the IR macro-name pattern (^[A-Z][A-Z0-9_]*$).
    useEditorStore.getState().updateScreenMeta({ macros: { 'bad name': 'x' } });
    await useEditorStore.getState().saveToFile();

    const state = useEditorStore.getState();
    expect(state.saveError).not.toBeNull();
    expect(state.saveError!.length).toBeGreaterThan(0);
    expect(pickerCalls).toBe(0); // aborted before the picker — no file written
    expect(state.isDirty).toBe(true); // still dirty; nothing was saved
  });

  it('exportCodeFile writes TSX one-way: keeps isDirty and filePath untouched', async () => {
    useEditorStore.getState().setFilePath('my_screen.screen.json');
    useEditorStore.getState().updateScreenMeta({ title: 'My Screen' }); // marks dirty
    await useEditorStore.getState().exportCodeFile();

    expect(suggestedName).toBe('my_screen.tsx');
    expect(written).toContain('export default function');
    // One-way eject: the canonical file and dirty state are untouched.
    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(useEditorStore.getState().filePath).toBe('my_screen.screen.json');
  });

  it('stamps meta.screenId on first save so a later retitle keeps the id', async () => {
    await useEditorStore.getState().saveToFile();
    expect(useEditorStore.getState().screen.meta.screenId).toBe('new-screen');

    useEditorStore.getState().updateScreenMeta({ title: 'Renamed Later' });
    await useEditorStore.getState().saveToFile();
    expect((JSON.parse(written!) as { id: string }).id).toBe('new-screen');
    expect(useEditorStore.getState().screen.meta.screenId).toBe('new-screen');
  });

  it('saveAsFile mints a fresh id from the current title (fork identity)', async () => {
    await useEditorStore.getState().saveToFile(); // stamps 'new-screen'
    useEditorStore.getState().updateScreenMeta({ title: 'Forked Copy' });
    await useEditorStore.getState().saveAsFile();

    expect((JSON.parse(written!) as { id: string }).id).toBe('forked-copy');
    // The fork's identity is adopted by the open document.
    expect(useEditorStore.getState().screen.meta.screenId).toBe('forked-copy');
  });
});

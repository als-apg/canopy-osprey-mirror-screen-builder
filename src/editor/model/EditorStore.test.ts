import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useEditorStore, getActiveTab } from './EditorStore';
import type { ScreenModel, Widget } from '../../types/widget';
import { createDefaultScreen } from '../../types/widget';
import { importScreenJSON } from '../import/importScreenJSON';

/** Shorthand — the active tab from a fresh store snapshot. */
const active = () => getActiveTab(useEditorStore.getState());

/** Close every tab except one fresh untitled default (mirrors initial state). */
function resetToOneFreshTab() {
  const s = useEditorStore.getState();
  // closeTab spawns a fresh tab when the last tab closes, so closing every
  // existing tab in order leaves the store with exactly one clean tab.
  const ids = [...s.tabOrder];
  for (const id of ids) s.closeTab(id);
}

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
    resetToOneFreshTab();
    // Disable snap so deltas are exact, and load a fresh nested screen.
    const screen = nestedScreen();
    screen.meta.snapToGrid = false;
    useEditorStore.getState().setScreen(screen);
  });

  const move = (ids: string[], dx: number, dy: number) =>
    useEditorStore.getState().moveWidgets(ids, dx, dy);
  const at = (id: string) => active().screen.widgets[id].layout;

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
    resetToOneFreshTab();
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

  it('writes a valid IR document, marks the tab clean, and adopts the saved name', async () => {
    useEditorStore.getState().updateScreenMeta({ title: 'My Screen' }); // marks dirty
    await useEditorStore.getState().saveToFile();

    expect(written).toBeDefined();
    expect(written!.endsWith('\n')).toBe(true);
    const doc: unknown = JSON.parse(written!);
    expect((doc as { schemaVersion: string }).schemaVersion).toBe('1.0');
    // The written document must round-trip through the importer.
    expect(() => importScreenJSON(doc)).not.toThrow();

    expect(active().isDirty).toBe(false);
    expect(active().filePath).toBe('MyScreen.screen.json');
    expect(active().saveError).toBeNull();
  });

  it('surfaces an ExportError as saveError and writes nothing', async () => {
    // 'bad name' violates the IR macro-name pattern (^[A-Z][A-Z0-9_]*$).
    useEditorStore.getState().updateScreenMeta({ macros: { 'bad name': 'x' } });
    await useEditorStore.getState().saveToFile();

    const tab = active();
    expect(tab.saveError).not.toBeNull();
    expect(tab.saveError!.length).toBeGreaterThan(0);
    expect(pickerCalls).toBe(0); // aborted before the picker — no file written
    expect(tab.isDirty).toBe(true); // still dirty; nothing was saved
  });

  it('exportCodeFile writes TSX one-way: keeps isDirty and filePath untouched', async () => {
    useEditorStore.getState().setFilePath('my_screen.screen.json');
    useEditorStore.getState().updateScreenMeta({ title: 'My Screen' }); // marks dirty
    await useEditorStore.getState().exportCodeFile();

    expect(suggestedName).toBe('my_screen.tsx');
    expect(written).toContain('export default function');
    // One-way eject: the canonical file and dirty state are untouched.
    expect(active().isDirty).toBe(true);
    expect(active().filePath).toBe('my_screen.screen.json');
  });

  it('stamps meta.screenId on first save so a later retitle keeps the id', async () => {
    await useEditorStore.getState().saveToFile();
    expect(active().screen.meta.screenId).toBe('new-screen');

    useEditorStore.getState().updateScreenMeta({ title: 'Renamed Later' });
    await useEditorStore.getState().saveToFile();
    expect((JSON.parse(written!) as { id: string }).id).toBe('new-screen');
    expect(active().screen.meta.screenId).toBe('new-screen');
  });

  it('saveAsFile mints a fresh id from the current title (fork identity)', async () => {
    await useEditorStore.getState().saveToFile(); // stamps 'new-screen'
    useEditorStore.getState().updateScreenMeta({ title: 'Forked Copy' });
    await useEditorStore.getState().saveAsFile();

    expect((JSON.parse(written!) as { id: string }).id).toBe('forked-copy');
    // The fork's identity is adopted by the open document.
    expect(active().screen.meta.screenId).toBe('forked-copy');
  });
});

describe('tab management', () => {
  beforeEach(() => {
    resetToOneFreshTab();
  });

  it('newTab appends a fresh tab and activates it', () => {
    const s = useEditorStore.getState();
    const firstId = s.activeTabId;
    const newId = s.newTab();
    const after = useEditorStore.getState();
    expect(after.tabOrder).toEqual([firstId, newId]);
    expect(after.activeTabId).toBe(newId);
    expect(after.tabs[newId].screen.meta.title).toBe('New Screen');
    expect(after.tabs[newId].isDirty).toBe(false);
  });

  it('activateTab preserves per-tab viewport (zoom + pan)', () => {
    const s = useEditorStore.getState();
    const firstId = s.activeTabId;
    s.setZoom(2);
    s.setPan(50, 60);
    const secondId = s.newTab();
    // On second tab, viewport is the default.
    expect(useEditorStore.getState().tabs[secondId].viewport).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    // Switch back — first tab's viewport is intact.
    useEditorStore.getState().activateTab(firstId);
    expect(useEditorStore.getState().tabs[firstId].viewport).toEqual({
      zoom: 2,
      panX: 50,
      panY: 60,
    });
  });

  it('closeTab on the active tab activates a neighbor', () => {
    const s = useEditorStore.getState();
    const firstId = s.activeTabId;
    const secondId = s.newTab();
    const thirdId = s.newTab();
    // Active is thirdId. Close it — should activate the neighbor at the same
    // index, which is now secondId (the previous rightmost).
    useEditorStore.getState().closeTab(thirdId);
    const after = useEditorStore.getState();
    expect(after.tabOrder).toEqual([firstId, secondId]);
    expect(after.activeTabId).toBe(secondId);
  });

  it('closing the only remaining tab spawns a fresh untitled tab', () => {
    const s = useEditorStore.getState();
    const firstId = s.activeTabId;
    s.closeTab(firstId);
    const after = useEditorStore.getState();
    expect(after.tabOrder.length).toBe(1);
    expect(after.tabOrder[0]).not.toBe(firstId);
    expect(after.tabs[after.activeTabId].screen.meta.title).toBe('New Screen');
  });

  it('undo/redo is isolated per tab', () => {
    const s = useEditorStore.getState();
    const firstId = s.activeTabId;
    // Make an edit in tab A
    s.addWidget('Rectangle', { x: 0, y: 0, width: 50, height: 50 });
    expect(active().screen.rootWidgetIds.length).toBe(1);
    // Open a new tab and edit there
    const secondId = s.newTab();
    useEditorStore.getState().addWidget('Rectangle', { x: 10, y: 10, width: 50, height: 50 });
    expect(active().screen.rootWidgetIds.length).toBe(1);
    // Undo in tab B doesn't affect tab A
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().tabs[secondId].screen.rootWidgetIds.length).toBe(0);
    expect(useEditorStore.getState().tabs[firstId].screen.rootWidgetIds.length).toBe(1);
  });

  it('bumps screenLoadId on newTab (so canvas fits the new screen)', () => {
    const before = useEditorStore.getState().screenLoadId;
    useEditorStore.getState().newTab();
    expect(useEditorStore.getState().screenLoadId).toBe(before + 1);
  });

  it('does NOT bump screenLoadId on activateTab (preserves viewport)', () => {
    const s = useEditorStore.getState();
    const firstId = s.activeTabId;
    s.newTab();
    const before = useEditorStore.getState().screenLoadId;
    useEditorStore.getState().activateTab(firstId);
    expect(useEditorStore.getState().screenLoadId).toBe(before);
  });
});

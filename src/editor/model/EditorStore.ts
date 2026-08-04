import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  Widget,
  WidgetType,
  WidgetProps,
  ScreenModel,
  ScreenMeta,
  AbsoluteLayout,
} from '../../types/widget';
import { createDefaultScreen } from '../../types/widget';
import { generateTSX } from '../code/generateTSX';
import { parseTSX } from '../code/parseTSX';
import {
  importScreenJSON,
  ImportValidationError,
  type ImportReport,
} from '../import/importScreenJSON';
import { exportScreenJSON, serializeScreenDoc, ExportError } from '../export/exportScreenJSON';
import { sanitizeTitle, suggestedBase } from './fileNames';
import { convertScreen, ConverterError } from '../../services/converter/convertScreen';

// Minimal shape of the File System Access API used by save/open. The full
// types ship with `lib.dom.d.ts` in newer TS releases; this local subset keeps
// us off `any` without forcing a tsconfig lib bump.
interface FSWritable {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FSFileHandle {
  name: string;
  createWritable(): Promise<FSWritable>;
  getFile(): Promise<File>;
}
interface FSFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}
interface WindowWithFS {
  showSaveFilePicker(opts?: FSFilePickerOptions): Promise<FSFileHandle>;
  showOpenFilePicker(opts?: FSFilePickerOptions): Promise<FSFileHandle[]>;
}
const fsWindow = () => window as unknown as WindowWithFS;

const TSX_FILE_TYPES = [{ description: 'TSX Files', accept: { 'text/typescript': ['.tsx'] } }];

// NOTE: the File System Access API rejects multi-dot extensions
// ('.screen.json' is invalid in `accept`), so the picker filters on '.json'
// and the canonical compound suffix rides in `suggestedName` instead.
const SCREEN_FILE_TYPES = [
  { description: 'Canopy Screen', accept: { 'application/json': ['.json'] } },
];

/**
 * Writes a text file to disk, preferring the File System Access API and
 * falling back to a download. On success, returns the saved file's name (or
 * null if the browser performed a download and we don't know where it
 * landed). Returns undefined if the user cancelled the picker.
 */
async function writeTextFile(
  content: string,
  suggestedName: string,
  types: FSFilePickerOptions['types'],
  mime: string
): Promise<{ savedName: string | null } | undefined> {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await fsWindow().showSaveFilePicker({
        suggestedName,
        types,
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { savedName: handle.name };
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return { savedName: null };
  } catch {
    // User cancelled the picker.
    return undefined;
  }
}

/**
 * Shared save flow: serialize the active tab's screen to canonical IR,
 * surfacing an `ExportError` as `saveError` (nothing is written in that case),
 * then write via the picker and mark the tab clean on success. The written
 * document's id is stamped onto `meta.screenId` so a later retitle can't
 * change a saved screen's identity; `freshId` (Save As) re-derives it from
 * the title so a fork gets its own.
 */
async function saveActiveTabAs(
  suggestedName: string,
  state: EditorStore,
  set: (fn: (s: EditorStore) => void) => void,
  opts?: { freshId?: boolean }
): Promise<void> {
  const tab = state.tabs[state.activeTabId];
  if (!tab) return;
  let json: string;
  let docId: string;
  try {
    const doc = exportScreenJSON(tab.screen, { freshId: opts?.freshId });
    docId = doc.id;
    json = serializeScreenDoc(doc);
  } catch (err) {
    set((s) => {
      const t = s.tabs[s.activeTabId];
      if (!t) return;
      t.saveError =
        err instanceof ExportError
          ? err.errors
          : [err instanceof Error ? err.message : String(err)];
    });
    return;
  }
  const result = await writeTextFile(json, suggestedName, SCREEN_FILE_TYPES, 'application/json');
  if (!result) return;
  set((s) => {
    const t = s.tabs[s.activeTabId];
    if (!t) return;
    if (result.savedName !== null) t.filePath = result.savedName;
    t.screen.meta.screenId = docId;
    t.isDirty = false;
    t.saveError = null;
  });
}

const OPEN_FILE_TYPES = [
  {
    description: 'Screen Files',
    accept: {
      'text/typescript': ['.tsx', '.ts', '.jsx'],
      'application/json': ['.json'],
    },
  },
];

/**
 * Reads a screen file from disk via the picker or a hidden file input.
 * Accepts both TSX screens and `.screen.json` IR documents; the caller routes
 * by name/content.
 */
async function readScreenFile(): Promise<{ name: string; code: string } | null> {
  try {
    if ('showOpenFilePicker' in window) {
      const [handle] = await fsWindow().showOpenFilePicker({ types: OPEN_FILE_TYPES });
      const file = await handle.getFile();
      return { name: handle.name, code: await file.text() };
    }
    return await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.tsx,.ts,.jsx,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        resolve({ name: file.name, code: await file.text() });
      };
      input.click();
    });
  } catch {
    return null;
  }
}

/** A picked legacy file plus the file handle for upload. */
async function pickLegacyFile(): Promise<File | null> {
  try {
    if ('showOpenFilePicker' in window) {
      const [handle] = await fsWindow().showOpenFilePicker({
        types: [
          {
            description: 'Legacy Screens',
            accept: { 'application/octet-stream': ['.edl', '.ui'] },
          },
        ],
      });
      return await handle.getFile();
    }
    return await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.edl,.ui';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  } catch {
    return null;
  }
}

/**
 * Decide whether a just-read file is a screen IR document (route to the JSON
 * importer) or a TSX screen (route to parseTSX). Name suffix first, then a
 * content sniff for `schemaVersion`.
 */
function isScreenJSON(name: string, code: string): boolean {
  if (name.endsWith('.screen.json')) return true;
  if (!name.endsWith('.json')) return false;
  try {
    const parsed = JSON.parse(code);
    return !!parsed && typeof parsed === 'object' && 'schemaVersion' in parsed;
  } catch {
    return false;
  }
}

// ── Selection State ─────────────────────────────────────────────────────────

interface SelectionState {
  selectedIds: string[];
  hoveredId: string | null;
}

// ── Viewport State ──────────────────────────────────────────────────────────

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

// ── Panel Visibility ────────────────────────────────────────────────────────

interface PanelState {
  paletteOpen: boolean;
  treeOpen: boolean;
  inspectorOpen: boolean;
  codeEditorOpen: boolean;
  livePreviewOpen: boolean;
  livePreviewMode: 'side-by-side' | 'toggle';
}

type BooleanPanelKey = {
  [K in keyof PanelState]: PanelState[K] extends boolean ? K : never;
}[keyof PanelState];

// ── Editor Mode ─────────────────────────────────────────────────────────────

type EditorMode = 'edit' | 'live' | 'tab-order';

// ── Per-Tab State ───────────────────────────────────────────────────────────

/**
 * Everything that belongs to a single open screen (document). Panels, theme,
 * mode, clipboard and drag state live on the top-level store since they're
 * shared across tabs.
 */
export interface TabState {
  id: string;
  screen: ScreenModel;
  filePath: string | null;
  isDirty: boolean;
  lastImportReport: ImportReport | null;
  importError: string[] | null;
  saveError: string[] | null;
  selection: SelectionState;
  viewport: ViewportState;
  undoStack: ScreenModel[];
  redoStack: ScreenModel[];
  // Undo coalescing (in-memory only): merges rapid same-target edits into
  // one entry, per-tab so typing in tab A doesn't reset tab B's coalesce key.
  _lastUndoKey: string | null;
  _lastUndoTime: number;
}

function createTab(screen: ScreenModel, filePath: string | null = null): TabState {
  return {
    id: nanoid(8),
    screen,
    filePath,
    isDirty: false,
    lastImportReport: null,
    importError: null,
    saveError: null,
    selection: { selectedIds: [], hoveredId: null },
    viewport: { zoom: 1, panX: 0, panY: 0 },
    undoStack: [],
    redoStack: [],
    _lastUndoKey: null,
    _lastUndoTime: 0,
  };
}

// ── Full Store ──────────────────────────────────────────────────────────────

interface EditorState {
  // Open tabs (documents) + ordering + active tab. Invariant: `tabOrder`
  // always has at least one entry, and `activeTabId` always points at one
  // of them — closing the last tab spawns a fresh untitled one.
  tabs: Record<string, TabState>;
  tabOrder: string[];
  activeTabId: string;

  // Bumped whenever a new screen is loaded into a tab (import/open/newTab
  // spawned by closing the last tab); the canvas watches this to auto-fit
  // zoom. Not bumped on tab switch — the tab's stored viewport is preserved.
  // `fitNonce` is bumped by the toolbar's Fit-to-Screen button (on-demand).
  screenLoadId: number;
  fitNonce: number;

  // Panels (shared across tabs)
  panels: PanelState;

  // Mode (shared)
  mode: EditorMode;

  // Theme (shared)
  editorTheme: 'white' | 'g10' | 'g90' | 'g100';

  // Clipboard (shared — paste crosses tabs)
  clipboard: Widget[];

  // Palette drag (shared)
  paletteDrag: { type: WidgetType } | null;
}

interface EditorActions {
  // Tab management
  newTab(): string;
  closeTab(id: string): void;
  activateTab(id: string): void;

  // Screen (operates on active tab)
  setScreen(screen: ScreenModel): void;
  setFilePath(path: string | null): void;
  updateScreenMeta(meta: Partial<ScreenMeta>): void;
  markClean(): void;

  // Widget CRUD (active tab)
  addWidget(type: WidgetType, layout: AbsoluteLayout, props?: Partial<WidgetProps>): string;
  removeWidgets(ids: string[]): void;
  updateWidget(id: string, updates: Partial<Widget>): void;
  updateWidgetProps(id: string, props: Partial<WidgetProps>): void;
  updateWidgetLayout(id: string, layout: Partial<AbsoluteLayout>): void;
  moveWidgets(ids: string[], dx: number, dy: number): void;
  resizeWidget(id: string, layout: AbsoluteLayout): void;

  // Z-ordering
  bringToFront(ids: string[]): void;
  sendToBack(ids: string[]): void;

  // Grouping
  groupWidgets(ids: string[]): string;
  ungroupWidget(groupId: string): void;

  // Selection
  selectWidgets(ids: string[], append?: boolean): void;
  clearSelection(): void;
  selectAll(): void;
  setHovered(id: string | null): void;

  // Viewport
  setZoom(zoom: number): void;
  setPan(x: number, y: number): void;
  requestFit(): void;

  // Panels
  togglePanel(panel: BooleanPanelKey): void;

  // Mode
  setMode(mode: EditorMode): void;

  // Theme
  setEditorTheme(theme: 'white' | 'g10' | 'g90' | 'g100'): void;

  // Undo/Redo (per-tab)
  pushUndo(coalesceKey?: string): void;
  undo(): void;
  redo(): void;

  // File I/O
  saveToFile(): Promise<void>;
  saveAsFile(): Promise<void>;
  openFile(): Promise<void>;
  importLegacyScreen(): Promise<void>;
  clearImportReport(): void;
  exportTSX(): string;
  /** One-way TSX eject to disk: never clears isDirty or retargets filePath. */
  exportCodeFile(): Promise<void>;

  // Clipboard
  copySelection(): void;
  paste(offset?: { x: number; y: number }): void;
  duplicateSelection(): void;
  deleteSelection(): void;

  // Palette drag
  startPaletteDrag(type: WidgetType): void;
  endPaletteDrag(): void;
}

export type EditorStore = EditorState & EditorActions;

/** Returns the active tab. The store's invariant guarantees this is defined. */
export function getActiveTab(s: EditorStore): TabState {
  return s.tabs[s.activeTabId];
}

const UNDO_CAP = 50;

const DEFAULT_PANELS: PanelState = {
  paletteOpen: true,
  treeOpen: true,
  inspectorOpen: true,
  codeEditorOpen: false,
  livePreviewOpen: false,
  livePreviewMode: 'side-by-side',
};

// Build the initial store state with one default tab so `activeTabId` is
// always valid.
const initialTab = createTab(createDefaultScreen());

export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    // ── Initial State ──────────────────────────────────────────────────────

    tabs: { [initialTab.id]: initialTab },
    tabOrder: [initialTab.id],
    activeTabId: initialTab.id,
    screenLoadId: 0,
    fitNonce: 0,
    panels: DEFAULT_PANELS,
    mode: 'edit',
    editorTheme: 'g90',
    clipboard: [],
    paletteDrag: null,

    // ── Tab management ─────────────────────────────────────────────────────

    newTab() {
      const tab = createTab(createDefaultScreen());
      set((s) => {
        s.tabs[tab.id] = tab;
        s.tabOrder.push(tab.id);
        s.activeTabId = tab.id;
        s.screenLoadId += 1;
      });
      return tab.id;
    },

    closeTab(id) {
      set((s) => {
        if (!s.tabs[id]) return;
        const idx = s.tabOrder.indexOf(id);
        delete s.tabs[id];
        s.tabOrder = s.tabOrder.filter((tid) => tid !== id);

        if (s.tabOrder.length === 0) {
          // Never leave the store tabless — spawn a fresh untitled tab and fit.
          const fresh = createTab(createDefaultScreen());
          s.tabs[fresh.id] = fresh;
          s.tabOrder.push(fresh.id);
          s.activeTabId = fresh.id;
          s.screenLoadId += 1;
          return;
        }

        if (s.activeTabId === id) {
          // Activate the neighbor at the same index (or the last if we closed
          // the rightmost). No screenLoadId bump — the neighbor keeps its
          // viewport as-is.
          s.activeTabId = s.tabOrder[Math.min(idx, s.tabOrder.length - 1)];
        }
      });
    },

    activateTab(id) {
      set((s) => {
        if (s.tabs[id]) s.activeTabId = id;
      });
    },

    // ── Screen (active tab) ────────────────────────────────────────────────

    setScreen(screen) {
      // Replace the active tab's screen wholesale (used by tests and any
      // future "reload" flow). Resets undo/redo and marks clean, matching the
      // semantics of loading a fresh document into the tab.
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        t.screen = screen;
        t.isDirty = false;
        t.selection.selectedIds = [];
        t.undoStack = [];
        t.redoStack = [];
      });
    },

    setFilePath(path) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (t) t.filePath = path;
      });
    },

    updateScreenMeta(meta) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        Object.assign(t.screen.meta, meta);
        t.isDirty = true;
      });
    },

    markClean() {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (t) t.isDirty = false;
      });
    },

    // ── Widget CRUD ────────────────────────────────────────────────────────

    addWidget(type, layout, props = {}) {
      get().pushUndo();
      const id = nanoid(8);
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const maxZ = Object.values(t.screen.widgets).reduce((max, w) => Math.max(max, w.zIndex), 0);
        const widget: Widget = {
          id,
          type,
          name: `${type}_${id}`,
          layout: { ...layout },
          visible: true,
          rotation: 0,
          rules: [],
          actions: [],
          props: { ...props },
          zIndex: maxZ + 1,
        };
        t.screen.widgets[id] = widget;
        t.screen.rootWidgetIds.push(id);
        t.isDirty = true;
      });
      return id;
    },

    removeWidgets(ids) {
      get().pushUndo();
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        for (const id of ids) {
          const widget = t.screen.widgets[id];
          if (widget?.parentId) {
            const parent = t.screen.widgets[widget.parentId];
            if (parent?.children) {
              parent.children = parent.children.filter((cid) => cid !== id);
            }
          }
          t.screen.rootWidgetIds = t.screen.rootWidgetIds.filter((rid) => rid !== id);
          const removeChildren = (wid: string) => {
            const w = t.screen.widgets[wid];
            if (w?.children) {
              for (const cid of w.children) {
                removeChildren(cid);
              }
            }
            delete t.screen.widgets[wid];
          };
          removeChildren(id);
        }
        t.selection.selectedIds = t.selection.selectedIds.filter((sid) => !ids.includes(sid));
        t.isDirty = true;
      });
    },

    updateWidget(id, updates) {
      get().pushUndo(`widget:${id}:${Object.keys(updates).sort().join(',')}`);
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const widget = t.screen.widgets[id];
        if (widget) {
          Object.assign(widget, updates);
          t.isDirty = true;
        }
      });
    },

    updateWidgetProps(id, props) {
      get().pushUndo(`props:${id}:${Object.keys(props).sort().join(',')}`);
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const widget = t.screen.widgets[id];
        if (widget) {
          Object.assign(widget.props, props);
          t.isDirty = true;
        }
      });
    },

    updateWidgetLayout(id, layout) {
      get().pushUndo(`layout:${id}:${Object.keys(layout).sort().join(',')}`);
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const widget = t.screen.widgets[id];
        if (widget) {
          Object.assign(widget.layout, layout);
          t.isDirty = true;
        }
      });
    },

    moveWidgets(ids, dx, dy) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        // Geometry is stored absolute, so moving a container must explicitly
        // carry its whole subtree (descendants hold their own absolute coords).
        // Collect each selected widget plus all descendants, deduped — a widget
        // selected both directly and via an ancestor moves only once.
        const toMove = new Map<string, Widget>();
        const collect = (id: string) => {
          if (toMove.has(id)) return;
          const w = t.screen.widgets[id];
          if (!w) return;
          toMove.set(id, w);
          for (const cid of w.children ?? []) collect(cid);
        };
        for (const id of ids) collect(id);

        // Snap-to-grid is applied only to the dragged (top-level selected)
        // widgets; descendants shift by the same raw delta to preserve their
        // offset within the container.
        const snap = t.screen.meta.snapToGrid;
        const g = t.screen.meta.gridSize;
        const selected = new Set(ids);
        for (const [id, w] of toMove) {
          w.layout.x += dx;
          w.layout.y += dy;
          if (snap && selected.has(id)) {
            w.layout.x = Math.round(w.layout.x / g) * g;
            w.layout.y = Math.round(w.layout.y / g) * g;
          }
        }
        t.isDirty = true;
      });
    },

    resizeWidget(id, layout) {
      // Note: pushUndo should be called once at drag-start, not per-pixel
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const w = t.screen.widgets[id];
        if (w) {
          w.layout = { ...layout };
          if (t.screen.meta.snapToGrid) {
            const g = t.screen.meta.gridSize;
            w.layout.x = Math.round(w.layout.x / g) * g;
            w.layout.y = Math.round(w.layout.y / g) * g;
            w.layout.width = Math.max(g, Math.round(w.layout.width / g) * g);
            w.layout.height = Math.max(g, Math.round(w.layout.height / g) * g);
          }
          t.isDirty = true;
        }
      });
    },

    // ── Z-ordering ─────────────────────────────────────────────────────────

    bringToFront(ids) {
      get().pushUndo();
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const maxZ = Object.values(t.screen.widgets).reduce((max, w) => Math.max(max, w.zIndex), 0);
        ids.forEach((id, i) => {
          const w = t.screen.widgets[id];
          if (w) w.zIndex = maxZ + 1 + i;
        });
        t.isDirty = true;
      });
    },

    sendToBack(ids) {
      get().pushUndo();
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const minZ = Object.values(t.screen.widgets).reduce(
          (min, w) => Math.min(min, w.zIndex),
          Infinity
        );
        ids.forEach((id, i) => {
          const w = t.screen.widgets[id];
          if (w) w.zIndex = minZ - ids.length + i;
        });
        t.isDirty = true;
      });
    },

    // ── Grouping ───────────────────────────────────────────────────────────

    groupWidgets(ids) {
      get().pushUndo();
      const groupId = nanoid(8);
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const maxZ = Object.values(t.screen.widgets).reduce((max, w) => Math.max(max, w.zIndex), 0);
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const id of ids) {
          const w = t.screen.widgets[id];
          if (w) {
            minX = Math.min(minX, w.layout.x);
            minY = Math.min(minY, w.layout.y);
            maxX = Math.max(maxX, w.layout.x + w.layout.width);
            maxY = Math.max(maxY, w.layout.y + w.layout.height);
          }
        }

        const group: Widget = {
          id: groupId,
          type: 'Group',
          name: `Group_${groupId}`,
          layout: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          visible: true,
          rotation: 0,
          rules: [],
          actions: [],
          props: { layoutMode: 'absolute' },
          children: [...ids],
          zIndex: maxZ + 1,
        };

        t.screen.widgets[groupId] = group;
        t.screen.rootWidgetIds = t.screen.rootWidgetIds.filter((rid) => !ids.includes(rid));
        t.screen.rootWidgetIds.push(groupId);

        for (const id of ids) {
          const w = t.screen.widgets[id];
          if (w) {
            w.layout.x -= minX;
            w.layout.y -= minY;
            w.parentId = groupId;
          }
        }

        t.selection.selectedIds = [groupId];
        t.isDirty = true;
      });
      return groupId;
    },

    ungroupWidget(groupId) {
      get().pushUndo();
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        const group = t.screen.widgets[groupId];
        if (!group || group.type !== 'Group' || !group.children) return;

        for (const childId of group.children) {
          const child = t.screen.widgets[childId];
          if (child) {
            child.layout.x += group.layout.x;
            child.layout.y += group.layout.y;
            child.parentId = undefined;
            t.screen.rootWidgetIds.push(childId);
          }
        }

        t.screen.rootWidgetIds = t.screen.rootWidgetIds.filter((rid) => rid !== groupId);
        delete t.screen.widgets[groupId];
        t.isDirty = true;
      });
    },

    // ── Selection ──────────────────────────────────────────────────────────

    selectWidgets(ids, append = false) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        if (append) {
          const newIds = new Set([...t.selection.selectedIds, ...ids]);
          t.selection.selectedIds = [...newIds];
        } else {
          t.selection.selectedIds = [...ids];
        }
      });
    },

    clearSelection() {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (t) t.selection.selectedIds = [];
      });
    },

    selectAll() {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (t) t.selection.selectedIds = [...t.screen.rootWidgetIds];
      });
    },

    setHovered(id) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (t) t.selection.hoveredId = id;
      });
    },

    // ── Viewport ───────────────────────────────────────────────────────────

    setZoom(zoom) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (t) t.viewport.zoom = Math.max(0.1, Math.min(5, zoom));
      });
    },

    setPan(x, y) {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        t.viewport.panX = x;
        t.viewport.panY = y;
      });
    },

    requestFit() {
      set((s) => {
        s.fitNonce += 1;
      });
    },

    // ── Panels ─────────────────────────────────────────────────────────────

    togglePanel(panel) {
      set((s) => {
        s.panels[panel] = !s.panels[panel];
      });
    },

    // ── Mode ───────────────────────────────────────────────────────────────

    setMode(mode) {
      set((s) => {
        s.mode = mode;
      });
    },

    setEditorTheme(theme) {
      set((s) => {
        s.editorTheme = theme;
      });
    },

    // ── Undo/Redo (per-tab, snapshot-based) ────────────────────────────────
    // We rely on immer to freeze each producer's output. State outside the
    // producer is therefore deep-immutable, so we can stash references on the
    // undo stack rather than deep-cloning the screen on every keystroke.

    pushUndo(coalesceKey) {
      const state = get();
      const now = Date.now();
      const tab = state.tabs[state.activeTabId];
      if (!tab) return;

      // Coalesce rapid successive edits to the same target into one entry —
      // typing "PV:NAME" should be one undo, not seven.
      if (coalesceKey && tab._lastUndoKey === coalesceKey && now - tab._lastUndoTime < 500) {
        set((s) => {
          const t = s.tabs[s.activeTabId];
          if (t) t._lastUndoTime = now;
        });
        return;
      }

      const prevScreen = tab.screen;
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        t.undoStack.push(prevScreen);
        if (t.undoStack.length > UNDO_CAP) t.undoStack.shift();
        t.redoStack = [];
        t._lastUndoKey = coalesceKey ?? null;
        t._lastUndoTime = now;
      });
    },

    undo() {
      const state = get();
      const tab = state.tabs[state.activeTabId];
      if (!tab || tab.undoStack.length === 0) return;
      const currentScreen = tab.screen;
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        t.redoStack.push(currentScreen);
        t.screen = t.undoStack.pop()!;
        t.selection.selectedIds = [];
        t.isDirty = true;
        t._lastUndoKey = null;
      });
    },

    redo() {
      const state = get();
      const tab = state.tabs[state.activeTabId];
      if (!tab || tab.redoStack.length === 0) return;
      const currentScreen = tab.screen;
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        t.undoStack.push(currentScreen);
        t.screen = t.redoStack.pop()!;
        t.selection.selectedIds = [];
        t.isDirty = true;
        t._lastUndoKey = null;
      });
    },

    // ── File I/O ───────────────────────────────────────────────────────────

    async saveToFile() {
      // Save writes the canonical IR document (.screen.json). filePath can
      // still carry another suffix — opening a legacy .tsx sets it — so strip
      // any known screen suffix and re-suffix with .screen.json rather than
      // ever writing IR bytes under a .tsx name.
      const state = get();
      const tab = state.tabs[state.activeTabId];
      if (!tab) return;
      const base = suggestedBase(tab.filePath, tab.screen.meta.title);
      await saveActiveTabAs(`${base}.screen.json`, state, set);
    },

    async saveAsFile() {
      const state = get();
      const tab = state.tabs[state.activeTabId];
      if (!tab) return;
      const base = sanitizeTitle(tab.screen.meta.title) || 'screen';
      await saveActiveTabAs(`${base}.screen.json`, state, set, { freshId: true });
    },

    async openFile() {
      const result = await readScreenFile();
      if (!result) return;

      // Dedupe: if a tab already holds this filePath, activate it instead of
      // opening a second copy. Matching is on `filePath` (the file name), which
      // is what save/load already round-trips through.
      const existing = Object.values(get().tabs).find((t) => t.filePath === result.name);
      if (existing) {
        get().activateTab(existing.id);
        return;
      }

      // Route .screen.json IR documents through the importer; TSX through parseTSX.
      if (isScreenJSON(result.name, result.code)) {
        let imported: { screen: ScreenModel; report: ImportReport };
        try {
          imported = importScreenJSON(JSON.parse(result.code));
        } catch (err) {
          // Surface validation errors on the active tab; do NOT open a new tab.
          set((s) => {
            const t = s.tabs[s.activeTabId];
            if (!t) return;
            t.importError =
              err instanceof ImportValidationError
                ? err.errors
                : [err instanceof Error ? err.message : String(err)];
            t.lastImportReport = null;
          });
          return;
        }
        const tab = createTab(imported.screen, result.name);
        tab.lastImportReport = imported.report;
        set((s) => {
          s.tabs[tab.id] = tab;
          s.tabOrder.push(tab.id);
          s.activeTabId = tab.id;
          s.screenLoadId += 1;
        });
        return;
      }

      const screen = parseTSX(result.code);
      const tab = createTab(screen, result.name);
      set((s) => {
        s.tabs[tab.id] = tab;
        s.tabOrder.push(tab.id);
        s.activeTabId = tab.id;
        s.screenLoadId += 1;
      });
    },

    async importLegacyScreen() {
      const file = await pickLegacyFile();
      if (!file) return;
      const kind = file.name.endsWith('.edl')
        ? 'edl'
        : file.name.endsWith('.ui')
          ? 'ui'
          : undefined;

      let imported: { screen: ScreenModel; report: ImportReport };
      try {
        const dto = await convertScreen(file, kind ? { kind } : {});
        imported = importScreenJSON(dto.screen);
        // Merge the server's (richer) diagnostics into the client report.
        imported.report.warnings.push(...dto.warnings);
        for (const u of dto.unknownWidgets) {
          const existing = imported.report.unknownWidgets.find(
            (w) => w.originalClass === u.originalClass
          );
          if (existing) existing.count = Math.max(existing.count, u.count);
          else imported.report.unknownWidgets.push({ ...u });
        }
      } catch (err) {
        set((s) => {
          const t = s.tabs[s.activeTabId];
          if (!t) return;
          t.importError =
            err instanceof ImportValidationError
              ? err.errors
              : err instanceof ConverterError
                ? [`${err.code}: ${err.message}`]
                : [err instanceof Error ? err.message : String(err)];
          t.lastImportReport = null;
        });
        return;
      }

      const tab = createTab(imported.screen, file.name.replace(/\.(edl|ui)$/i, '.screen.json'));
      tab.isDirty = true; // converted but unsaved
      tab.lastImportReport = imported.report;
      set((s) => {
        s.tabs[tab.id] = tab;
        s.tabOrder.push(tab.id);
        s.activeTabId = tab.id;
        s.screenLoadId += 1;
      });
    },

    clearImportReport() {
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        t.lastImportReport = null;
        t.importError = null;
        t.saveError = null;
      });
    },

    exportTSX() {
      const tab = get().tabs[get().activeTabId];
      return tab ? generateTSX(tab.screen) : '';
    },

    async exportCodeFile() {
      // One-way eject: the generated TSX cannot be re-imported, so this
      // neither clears isDirty nor retargets filePath — the canonical file
      // stays the .screen.json.
      const state = get();
      const tab = state.tabs[state.activeTabId];
      if (!tab) return;
      const base = suggestedBase(tab.filePath, tab.screen.meta.title);
      await writeTextFile(
        generateTSX(tab.screen),
        `${base}.tsx`,
        TSX_FILE_TYPES,
        'text/typescript'
      );
    },

    // ── Clipboard ──────────────────────────────────────────────────────────

    copySelection() {
      const state = get();
      const tab = state.tabs[state.activeTabId];
      if (!tab) return;
      const copied = tab.selection.selectedIds.map((id) => tab.screen.widgets[id]).filter(Boolean);
      set((s) => {
        s.clipboard = JSON.parse(JSON.stringify(copied));
      });
    },

    paste(offset = { x: 20, y: 20 }) {
      get().pushUndo();
      const state = get();
      const newIds: string[] = [];
      set((s) => {
        const t = s.tabs[s.activeTabId];
        if (!t) return;
        for (const widget of state.clipboard) {
          const newId = nanoid(8);
          const maxZ = Object.values(t.screen.widgets).reduce(
            (max, w) => Math.max(max, w.zIndex),
            0
          );
          t.screen.widgets[newId] = {
            ...JSON.parse(JSON.stringify(widget)),
            id: newId,
            name: `${widget.type}_${newId}`,
            layout: {
              ...widget.layout,
              x: widget.layout.x + offset.x,
              y: widget.layout.y + offset.y,
            },
            zIndex: maxZ + 1,
            parentId: undefined,
          };
          t.screen.rootWidgetIds.push(newId);
          newIds.push(newId);
        }
        t.selection.selectedIds = newIds;
        t.isDirty = true;
      });
    },

    duplicateSelection() {
      get().copySelection();
      get().paste({ x: 20, y: 20 });
    },

    deleteSelection() {
      const tab = get().tabs[get().activeTabId];
      const ids = tab?.selection.selectedIds ?? [];
      if (ids.length > 0) {
        get().removeWidgets(ids);
      }
    },

    startPaletteDrag(type) {
      set((s) => {
        s.paletteDrag = { type };
      });
    },

    endPaletteDrag() {
      set((s) => {
        s.paletteDrag = null;
      });
    },
  }))
);

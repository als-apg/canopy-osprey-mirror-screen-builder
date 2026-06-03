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

// ── Selection State ────────────────────────────────────���─────────────────────

interface SelectionState {
  selectedIds: string[];
  hoveredId: string | null;
}

// ── Viewport State ────────────────────���───────────────────────────��──────────

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

// ── Panel Visibility ────────────��────────────────────────────────────────────

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

// ── Editor Mode ──────────────���───────────────────────────────────────────────

type EditorMode = 'edit' | 'live' | 'tab-order';

// ── Full Store ───────────────────��────────────────────────────────���──────────

interface EditorState {
  // Screen data
  screen: ScreenModel;
  filePath: string | null;
  isDirty: boolean;

  // Selection
  selection: SelectionState;

  // Viewport
  viewport: ViewportState;

  // Panels
  panels: PanelState;

  // Mode
  mode: EditorMode;

  // Theme
  editorTheme: 'white' | 'g10' | 'g90' | 'g100';

  // Undo/Redo (snapshot-based)
  undoStack: ScreenModel[];
  redoStack: ScreenModel[];

  // Clipboard
  clipboard: Widget[];

  // Palette drag (mouse-event based, replaces HTML5 DnD for Tauri compat)
  paletteDrag: { type: WidgetType } | null;
}

interface EditorActions {
  // Screen
  setScreen(screen: ScreenModel): void;
  setFilePath(path: string | null): void;
  updateScreenMeta(meta: Partial<ScreenMeta>): void;
  markClean(): void;

  // Widget CRUD
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
  zoomToFit(): void;

  // Panels
  togglePanel(panel: BooleanPanelKey): void;

  // Mode
  setMode(mode: EditorMode): void;

  // Theme
  setEditorTheme(theme: 'white' | 'g10' | 'g90' | 'g100'): void;

  // Undo/Redo
  pushUndo(): void;
  undo(): void;
  redo(): void;

  // File I/O
  saveToFile(): Promise<void>;
  saveAsFile(): Promise<void>;
  openFile(): Promise<void>;
  exportTSX(): string;

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

const DEFAULT_PANELS: PanelState = {
  paletteOpen: true,
  treeOpen: true,
  inspectorOpen: true,
  codeEditorOpen: false,
  livePreviewOpen: false,
  livePreviewMode: 'side-by-side',
};

export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    // ── Initial State ────────────��─────────────────────────────────────────

    screen: createDefaultScreen(),
    filePath: null,
    isDirty: false,
    selection: { selectedIds: [], hoveredId: null },
    viewport: { zoom: 1, panX: 0, panY: 0 },
    panels: DEFAULT_PANELS,
    mode: 'edit',
    editorTheme: 'g90',
    undoStack: [],
    redoStack: [],
    clipboard: [],
    paletteDrag: null,

    // ── Screen ─────────────────────────────────────────────────────────────

    setScreen(screen) {
      set((s) => {
        s.screen = screen;
        s.isDirty = false;
        s.selection.selectedIds = [];
        s.undoStack = [];
        s.redoStack = [];
      });
    },

    setFilePath(path) {
      set((s) => {
        s.filePath = path;
      });
    },

    updateScreenMeta(meta) {
      set((s) => {
        Object.assign(s.screen.meta, meta);
        s.isDirty = true;
      });
    },

    markClean() {
      set((s) => {
        s.isDirty = false;
      });
    },

    // ── Widget CRUD ──────────────────���─────────────────────────────────────

    addWidget(type, layout, props = {}) {
      get().pushUndo();
      const id = nanoid(8);
      set((s) => {
        const maxZ = Object.values(s.screen.widgets).reduce((max, w) => Math.max(max, w.zIndex), 0);
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
        s.screen.widgets[id] = widget;
        s.screen.rootWidgetIds.push(id);
        s.isDirty = true;
      });
      return id;
    },

    removeWidgets(ids) {
      get().pushUndo();
      set((s) => {
        for (const id of ids) {
          // Remove from parent's children
          const widget = s.screen.widgets[id];
          if (widget?.parentId) {
            const parent = s.screen.widgets[widget.parentId];
            if (parent?.children) {
              parent.children = parent.children.filter((cid) => cid !== id);
            }
          }
          // Remove from root IDs
          s.screen.rootWidgetIds = s.screen.rootWidgetIds.filter((rid) => rid !== id);
          // Remove children recursively
          const removeChildren = (wid: string) => {
            const w = s.screen.widgets[wid];
            if (w?.children) {
              for (const cid of w.children) {
                removeChildren(cid);
              }
            }
            delete s.screen.widgets[wid];
          };
          removeChildren(id);
        }
        s.selection.selectedIds = s.selection.selectedIds.filter((sid) => !ids.includes(sid));
        s.isDirty = true;
      });
    },

    updateWidget(id, updates) {
      get().pushUndo();
      set((s) => {
        const widget = s.screen.widgets[id];
        if (widget) {
          Object.assign(widget, updates);
          s.isDirty = true;
        }
      });
    },

    updateWidgetProps(id, props) {
      get().pushUndo();
      set((s) => {
        const widget = s.screen.widgets[id];
        if (widget) {
          Object.assign(widget.props, props);
          s.isDirty = true;
        }
      });
    },

    updateWidgetLayout(id, layout) {
      get().pushUndo();
      set((s) => {
        const widget = s.screen.widgets[id];
        if (widget) {
          Object.assign(widget.layout, layout);
          s.isDirty = true;
        }
      });
    },

    moveWidgets(ids, dx, dy) {
      set((s) => {
        for (const id of ids) {
          const w = s.screen.widgets[id];
          if (w) {
            w.layout.x += dx;
            w.layout.y += dy;
            if (s.screen.meta.snapToGrid) {
              const g = s.screen.meta.gridSize;
              w.layout.x = Math.round(w.layout.x / g) * g;
              w.layout.y = Math.round(w.layout.y / g) * g;
            }
          }
        }
        s.isDirty = true;
      });
    },

    resizeWidget(id, layout) {
      // Note: pushUndo should be called once at drag-start, not per-pixel
      set((s) => {
        const w = s.screen.widgets[id];
        if (w) {
          w.layout = { ...layout };
          if (s.screen.meta.snapToGrid) {
            const g = s.screen.meta.gridSize;
            w.layout.x = Math.round(w.layout.x / g) * g;
            w.layout.y = Math.round(w.layout.y / g) * g;
            w.layout.width = Math.max(g, Math.round(w.layout.width / g) * g);
            w.layout.height = Math.max(g, Math.round(w.layout.height / g) * g);
          }
          s.isDirty = true;
        }
      });
    },

    // ── Z-ordering ───────────────���───────────────────���─────────────────────

    bringToFront(ids) {
      get().pushUndo();
      set((s) => {
        const maxZ = Object.values(s.screen.widgets).reduce((max, w) => Math.max(max, w.zIndex), 0);
        ids.forEach((id, i) => {
          const w = s.screen.widgets[id];
          if (w) w.zIndex = maxZ + 1 + i;
        });
        s.isDirty = true;
      });
    },

    sendToBack(ids) {
      get().pushUndo();
      set((s) => {
        const minZ = Object.values(s.screen.widgets).reduce(
          (min, w) => Math.min(min, w.zIndex),
          Infinity
        );
        ids.forEach((id, i) => {
          const w = s.screen.widgets[id];
          if (w) w.zIndex = minZ - ids.length + i;
        });
        s.isDirty = true;
      });
    },

    // ── Grouping ───────────────────���────────────────────────────────────��──

    groupWidgets(ids) {
      get().pushUndo();
      const groupId = nanoid(8);
      set((s) => {
        const maxZ = Object.values(s.screen.widgets).reduce((max, w) => Math.max(max, w.zIndex), 0);
        // Calculate bounding box
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const id of ids) {
          const w = s.screen.widgets[id];
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

        s.screen.widgets[groupId] = group;
        s.screen.rootWidgetIds = s.screen.rootWidgetIds.filter((rid) => !ids.includes(rid));
        s.screen.rootWidgetIds.push(groupId);

        // Adjust children positions to be relative to group
        for (const id of ids) {
          const w = s.screen.widgets[id];
          if (w) {
            w.layout.x -= minX;
            w.layout.y -= minY;
            w.parentId = groupId;
          }
        }

        s.selection.selectedIds = [groupId];
        s.isDirty = true;
      });
      return groupId;
    },

    ungroupWidget(groupId) {
      get().pushUndo();
      set((s) => {
        const group = s.screen.widgets[groupId];
        if (!group || group.type !== 'Group' || !group.children) return;

        for (const childId of group.children) {
          const child = s.screen.widgets[childId];
          if (child) {
            child.layout.x += group.layout.x;
            child.layout.y += group.layout.y;
            child.parentId = undefined;
            s.screen.rootWidgetIds.push(childId);
          }
        }

        s.screen.rootWidgetIds = s.screen.rootWidgetIds.filter((rid) => rid !== groupId);
        delete s.screen.widgets[groupId];
        s.isDirty = true;
      });
    },

    // ── Selection ──────────────────────────────────────────────────────────

    selectWidgets(ids, append = false) {
      set((s) => {
        if (append) {
          const newIds = new Set([...s.selection.selectedIds, ...ids]);
          s.selection.selectedIds = [...newIds];
        } else {
          s.selection.selectedIds = [...ids];
        }
      });
    },

    clearSelection() {
      set((s) => {
        s.selection.selectedIds = [];
      });
    },

    selectAll() {
      set((s) => {
        s.selection.selectedIds = [...s.screen.rootWidgetIds];
      });
    },

    setHovered(id) {
      set((s) => {
        s.selection.hoveredId = id;
      });
    },

    // ── Viewport ───────────────────��─────────────────────────────────���─────

    setZoom(zoom) {
      set((s) => {
        s.viewport.zoom = Math.max(0.1, Math.min(5, zoom));
      });
    },

    setPan(x, y) {
      set((s) => {
        s.viewport.panX = x;
        s.viewport.panY = y;
      });
    },

    zoomToFit() {
      // Will be implemented once we have canvas container dimensions
      set((s) => {
        s.viewport.zoom = 1;
        s.viewport.panX = 0;
        s.viewport.panY = 0;
      });
    },

    // ── Panels ────────────────────��────────────────────────────────���───────

    togglePanel(panel) {
      set((s) => {
        s.panels[panel] = !s.panels[panel];
      });
    },

    // ── Mode ────────────────────��─────────────────────────────────────���────

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

    // ── Undo/Redo (snapshot-based) ────────────────────────────────────────

    pushUndo() {
      set((s) => {
        const snapshot = JSON.parse(JSON.stringify(s.screen)) as ScreenModel;
        s.undoStack.push(snapshot);
        // Cap at 50 snapshots
        if (s.undoStack.length > 50) s.undoStack.shift();
        s.redoStack = [];
      });
    },

    undo() {
      const state = get();
      if (state.undoStack.length === 0) return;
      set((s) => {
        const currentSnapshot = JSON.parse(JSON.stringify(s.screen)) as ScreenModel;
        s.redoStack.push(currentSnapshot);
        const prev = s.undoStack.pop()!;
        s.screen = prev;
        s.selection.selectedIds = [];
        s.isDirty = true;
      });
    },

    redo() {
      const state = get();
      if (state.redoStack.length === 0) return;
      set((s) => {
        const currentSnapshot = JSON.parse(JSON.stringify(s.screen)) as ScreenModel;
        s.undoStack.push(currentSnapshot);
        const next = s.redoStack.pop()!;
        s.screen = next;
        s.selection.selectedIds = [];
        s.isDirty = true;
      });
    },

    // ── File I/O ──────────────────────────────────────────────────────────

    async saveToFile() {
      const state = get();
      const code = generateTSX(state.screen);

      try {
        if ('showSaveFilePicker' in window) {
          // File System Access API (Chrome/Edge)
          const handle = await fsWindow().showSaveFilePicker({
            suggestedName: state.filePath?.split(/[/\\]/).pop() ?? 'screen.tsx',
            types: [{ description: 'TSX Files', accept: { 'text/typescript': ['.tsx'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(code);
          await writable.close();
          set((s) => {
            s.filePath = handle.name;
            s.isDirty = false;
          });
        } else {
          // Fallback: download
          const blob = new Blob([code], { type: 'text/typescript' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = state.filePath?.split(/[/\\]/).pop() ?? 'screen.tsx';
          a.click();
          URL.revokeObjectURL(url);
          set((s) => {
            s.isDirty = false;
          });
        }
      } catch (e) {
        // User cancelled
        console.log('Save cancelled', e);
      }
    },

    async saveAsFile() {
      const state = get();
      const code = generateTSX(state.screen);
      try {
        if ('showSaveFilePicker' in window) {
          const handle = await fsWindow().showSaveFilePicker({
            suggestedName: state.screen.meta.title.replace(/[^a-zA-Z0-9]/g, '') + '.tsx',
            types: [{ description: 'TSX Files', accept: { 'text/typescript': ['.tsx'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(code);
          await writable.close();
          set((s) => {
            s.filePath = handle.name;
            s.isDirty = false;
          });
        } else {
          const blob = new Blob([code], { type: 'text/typescript' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = state.screen.meta.title.replace(/[^a-zA-Z0-9]/g, '') + '.tsx';
          a.click();
          URL.revokeObjectURL(url);
          set((s) => {
            s.isDirty = false;
          });
        }
      } catch (e) {
        console.log('Save As cancelled', e);
      }
    },

    async openFile() {
      try {
        if ('showOpenFilePicker' in window) {
          const [handle] = await fsWindow().showOpenFilePicker({
            types: [{ description: 'TSX Files', accept: { 'text/typescript': ['.tsx'] } }],
          });
          const file = await handle.getFile();
          const code = await file.text();
          console.log('[Screen Builder] Parsing file:', handle.name, 'length:', code.length);
          const screen = parseTSX(code);
          console.log(
            '[Screen Builder] Parsed:',
            screen.rootWidgetIds.length,
            'widgets, title:',
            screen.meta.title
          );
          set((s) => {
            s.screen = screen;
            s.filePath = handle.name;
            s.isDirty = false;
            s.selection.selectedIds = [];
            s.undoStack = [];
            s.redoStack = [];
          });
        } else {
          // Fallback: file input
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.tsx,.ts,.jsx';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const code = await file.text();
            console.log('[Screen Builder] Parsing file:', file.name, 'length:', code.length);
            const screen = parseTSX(code);
            console.log(
              '[Screen Builder] Parsed:',
              screen.rootWidgetIds.length,
              'widgets, title:',
              screen.meta.title
            );
            set((s) => {
              s.screen = screen;
              s.filePath = file.name;
              s.isDirty = false;
              s.selection.selectedIds = [];
              s.undoStack = [];
              s.redoStack = [];
            });
          };
          input.click();
        }
      } catch (e) {
        console.log('Open cancelled', e);
      }
    },

    exportTSX() {
      return generateTSX(get().screen);
    },

    // ── Clipboard ───────────────────────────────────────────────────────��──

    copySelection() {
      const state = get();
      const copied = state.selection.selectedIds
        .map((id) => state.screen.widgets[id])
        .filter(Boolean);
      set((s) => {
        s.clipboard = JSON.parse(JSON.stringify(copied));
      });
    },

    paste(offset = { x: 20, y: 20 }) {
      get().pushUndo();
      const state = get();
      const newIds: string[] = [];
      set((s) => {
        for (const widget of state.clipboard) {
          const newId = nanoid(8);
          const maxZ = Object.values(s.screen.widgets).reduce(
            (max, w) => Math.max(max, w.zIndex),
            0
          );
          s.screen.widgets[newId] = {
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
          s.screen.rootWidgetIds.push(newId);
          newIds.push(newId);
        }
        s.selection.selectedIds = newIds;
        s.isDirty = true;
      });
    },

    duplicateSelection() {
      get().copySelection();
      get().paste({ x: 20, y: 20 });
    },

    deleteSelection() {
      const ids = get().selection.selectedIds;
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

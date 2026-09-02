// Selector hooks that resolve to the active tab's per-screen state. Components
// use these instead of `useEditorStore((s) => s.screen)` so they don't need to
// know about the tabs collection. The store invariant (activeTabId always
// points at an existing tab) is preserved by tab management actions, so these
// selectors don't null-check.
import { useEditorStore, getActiveTab } from './EditorStore';

export const useScreen = () => useEditorStore((s) => s.tabs[s.activeTabId].screen);
export const useSelection = () => useEditorStore((s) => s.tabs[s.activeTabId].selection);
export const useViewport = () => useEditorStore((s) => s.tabs[s.activeTabId].viewport);
export const useFilePath = () => useEditorStore((s) => s.tabs[s.activeTabId].filePath);
export const useIsDirty = () => useEditorStore((s) => s.tabs[s.activeTabId].isDirty);
export const useUndoStack = () => useEditorStore((s) => s.tabs[s.activeTabId].undoStack);
export const useRedoStack = () => useEditorStore((s) => s.tabs[s.activeTabId].redoStack);
export const useLastImportReport = () =>
  useEditorStore((s) => s.tabs[s.activeTabId].lastImportReport);
export const useImportError = () => useEditorStore((s) => s.tabs[s.activeTabId].importError);
export const useSaveError = () => useEditorStore((s) => s.tabs[s.activeTabId].saveError);

export { getActiveTab };

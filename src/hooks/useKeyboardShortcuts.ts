import { useEffect, useRef } from 'react';
import { useEditorStore, getActiveTab } from '../editor/model/EditorStore';
import { useScreen, useSelection } from '../editor/model/hooks';

export function useKeyboardShortcuts() {
  const nudgeUndoPushed = useRef(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const copySelection = useEditorStore((s) => s.copySelection);
  const paste = useEditorStore((s) => s.paste);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const selectAll = useEditorStore((s) => s.selectAll);
  const groupWidgets = useEditorStore((s) => s.groupWidgets);
  const ungroupWidget = useEditorStore((s) => s.ungroupWidget);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const moveWidgets = useEditorStore((s) => s.moveWidgets);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const saveToFile = useEditorStore((s) => s.saveToFile);
  const openFile = useEditorStore((s) => s.openFile);
  const selection = useSelection();
  const screen = useScreen();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;

      // Don't intercept shortcuts when typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Save
      if (ctrl && e.key === 's') {
        e.preventDefault();
        saveToFile();
      }
      // Open
      if (ctrl && e.key === 'o') {
        e.preventDefault();
        openFile();
      }
      // Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Copy
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        copySelection();
      }
      // Paste
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        paste();
      }
      // Duplicate
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        duplicateSelection();
      }
      // Select All
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      }
      // Group
      if (ctrl && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        if (selection.selectedIds.length > 1) {
          groupWidgets(selection.selectedIds);
        }
      }
      // Ungroup
      if (ctrl && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        if (selection.selectedIds.length === 1) {
          const w = screen.widgets[selection.selectedIds[0]];
          if (w?.type === 'Group') ungroupWidget(w.id);
        }
      }
      // Toggle code editor
      if (ctrl && e.key === 'e') {
        e.preventDefault();
        togglePanel('codeEditorOpen');
      }
      // Toggle live preview
      if (ctrl && e.key === 'l') {
        e.preventDefault();
        togglePanel('livePreviewOpen');
      }
      // Arrow key nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeTab = getActiveTab(useEditorStore.getState());
        const currentSelection = activeTab.selection.selectedIds;
        if (currentSelection.length > 0) {
          e.preventDefault();
          // Only push undo once per nudge burst (debounce 500ms)
          if (!nudgeUndoPushed.current) {
            pushUndo();
            nudgeUndoPushed.current = true;
          }
          if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
          nudgeTimer.current = setTimeout(() => {
            nudgeUndoPushed.current = false;
          }, 500);

          const gridSize = activeTab.screen.meta.snapToGrid ? activeTab.screen.meta.gridSize : 1;
          const step = e.shiftKey ? gridSize * 5 : gridSize;
          const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
          const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
          moveWidgets(currentSelection, dx, dy);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    undo,
    redo,
    copySelection,
    paste,
    deleteSelection,
    duplicateSelection,
    selectAll,
    groupWidgets,
    ungroupWidget,
    togglePanel,
    moveWidgets,
    pushUndo,
    saveToFile,
    openFile,
    selection,
    screen,
  ]);
}

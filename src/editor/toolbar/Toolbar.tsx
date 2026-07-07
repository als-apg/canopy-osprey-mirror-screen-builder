import { useCallback } from 'react';
import { Button } from '@carbon/react';
import {
  DocumentAdd,
  DocumentExport,
  DocumentImport,
  FolderOpen,
  Save,
  SaveModel,
  Undo,
  Redo,
  Copy,
  Paste,
  TrashCan,
  ZoomIn,
  ZoomOut,
  FitToScreen,
  Grid as GridIcon,
  Pin,
  PinFilled,
  GroupObjects,
  Subtract,
} from '@carbon/icons-react';
import { useEditorStore } from '../model/EditorStore';
import { createDefaultScreen } from '../../types/widget';
import './Toolbar.scss';

export function Toolbar() {
  const saveToFile = useEditorStore((s) => s.saveToFile);
  const saveAsFile = useEditorStore((s) => s.saveAsFile);
  const exportCodeFile = useEditorStore((s) => s.exportCodeFile);
  const openFile = useEditorStore((s) => s.openFile);
  const importLegacyScreen = useEditorStore((s) => s.importLegacyScreen);
  const setScreen = useEditorStore((s) => s.setScreen);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const copySelection = useEditorStore((s) => s.copySelection);
  const paste = useEditorStore((s) => s.paste);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const setZoom = useEditorStore((s) => s.setZoom);
  const requestFit = useEditorStore((s) => s.requestFit);
  const viewport = useEditorStore((s) => s.viewport);
  const screen = useEditorStore((s) => s.screen);
  const updateScreenMeta = useEditorStore((s) => s.updateScreenMeta);
  const selection = useEditorStore((s) => s.selection);
  const groupWidgets = useEditorStore((s) => s.groupWidgets);
  const ungroupWidget = useEditorStore((s) => s.ungroupWidget);
  const isDirty = useEditorStore((s) => s.isDirty);

  const hasSelection = selection.selectedIds.length > 0;
  const hasMultiSelection = selection.selectedIds.length > 1;

  const toggleShowGrid = useCallback(() => {
    updateScreenMeta({ showGrid: !screen.meta.showGrid });
  }, [screen.meta.showGrid, updateScreenMeta]);

  const toggleSnapToGrid = useCallback(() => {
    updateScreenMeta({ snapToGrid: !screen.meta.snapToGrid });
  }, [screen.meta.snapToGrid, updateScreenMeta]);

  const handleGroup = useCallback(() => {
    if (hasMultiSelection) {
      groupWidgets(selection.selectedIds);
    }
  }, [hasMultiSelection, selection.selectedIds, groupWidgets]);

  const handleUngroup = useCallback(() => {
    if (selection.selectedIds.length === 1) {
      const widget = screen.widgets[selection.selectedIds[0]];
      if (widget?.type === 'Group') {
        ungroupWidget(widget.id);
      }
    }
  }, [selection.selectedIds, screen.widgets, ungroupWidget]);

  return (
    <div className="toolbar">
      <div className="toolbar__section">
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={DocumentAdd}
          iconDescription="New Screen"
          tooltipPosition="bottom"
          tooltipAlignment="start"
          onClick={() => {
            if (isDirty && !confirm('Discard unsaved changes?')) return;
            setScreen(createDefaultScreen());
          }}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={FolderOpen}
          iconDescription="Open File"
          tooltipPosition="bottom"
          tooltipAlignment="start"
          onClick={openFile}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={DocumentImport}
          iconDescription="Import legacy screen (.edl/.ui)"
          tooltipPosition="bottom"
          tooltipAlignment="start"
          onClick={() => {
            if (isDirty && !confirm('Discard unsaved changes?')) return;
            void importLegacyScreen();
          }}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Save}
          iconDescription="Save"
          tooltipPosition="bottom"
          onClick={saveToFile}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={SaveModel}
          iconDescription="Save As"
          tooltipPosition="bottom"
          onClick={saveAsFile}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={DocumentExport}
          iconDescription="Export as code (.tsx) — one-way; this file cannot be re-imported"
          tooltipPosition="bottom"
          onClick={() => void exportCodeFile()}
        />
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Undo}
          iconDescription="Undo"
          tooltipPosition="bottom"
          onClick={undo}
          disabled={undoStack.length === 0}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Redo}
          iconDescription="Redo"
          tooltipPosition="bottom"
          onClick={redo}
          disabled={redoStack.length === 0}
        />
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Copy}
          iconDescription="Copy"
          tooltipPosition="bottom"
          onClick={copySelection}
          disabled={!hasSelection}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Paste}
          iconDescription="Paste"
          tooltipPosition="bottom"
          onClick={() => paste()}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={TrashCan}
          iconDescription="Delete"
          tooltipPosition="bottom"
          onClick={deleteSelection}
          disabled={!hasSelection}
        />
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={GroupObjects}
          iconDescription="Group"
          tooltipPosition="bottom"
          onClick={handleGroup}
          disabled={!hasMultiSelection}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Subtract}
          iconDescription="Ungroup"
          tooltipPosition="bottom"
          onClick={handleUngroup}
          disabled={selection.selectedIds.length !== 1}
        />
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={ZoomOut}
          iconDescription="Zoom Out"
          tooltipPosition="bottom"
          onClick={() => setZoom(viewport.zoom - 0.1)}
        />
        <span className="toolbar__zoom-label">{Math.round(viewport.zoom * 100)}%</span>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={ZoomIn}
          iconDescription="Zoom In"
          tooltipPosition="bottom"
          onClick={() => setZoom(viewport.zoom + 0.1)}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={FitToScreen}
          iconDescription="Fit to Screen"
          tooltipPosition="bottom"
          onClick={requestFit}
        />
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <Button
          kind={screen.meta.showGrid ? 'secondary' : 'ghost'}
          size="sm"
          hasIconOnly
          renderIcon={GridIcon}
          iconDescription={screen.meta.showGrid ? 'Hide Grid' : 'Show Grid'}
          tooltipPosition="bottom"
          onClick={toggleShowGrid}
        />
        <Button
          kind={screen.meta.snapToGrid ? 'secondary' : 'ghost'}
          size="sm"
          hasIconOnly
          renderIcon={screen.meta.snapToGrid ? PinFilled : Pin}
          iconDescription={screen.meta.snapToGrid ? 'Snap On' : 'Snap Off'}
          tooltipPosition="bottom"
          onClick={toggleSnapToGrid}
        />
        <input
          type="number"
          className="toolbar__grid-size"
          value={screen.meta.gridSize}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (val >= 1 && val <= 100) updateScreenMeta({ gridSize: val });
          }}
          min={1}
          max={100}
          title="Grid Size (px)"
        />
      </div>

      <div className="toolbar__spacer" />

      <div className="toolbar__section">
        {isDirty && <span className="toolbar__dirty-indicator" title="Unsaved changes" />}
      </div>
    </div>
  );
}

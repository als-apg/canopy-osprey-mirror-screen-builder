import { useState, useCallback } from 'react';
import { Search, TreeView, TreeNode } from '@carbon/react';
import { View, ViewOff, ChevronDown, ChevronLeft } from '@carbon/icons-react';
import { useEditorStore } from '../model/EditorStore';
import { widgetRegistry } from '../../widgets/registry/WidgetRegistry';
import './ComponentTree.scss';

export function ComponentTree() {
  const screen = useEditorStore((s) => s.screen);
  const selection = useEditorStore((s) => s.selection);
  const selectWidgets = useEditorStore((s) => s.selectWidgets);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const handleSelect = useCallback(
    (_: unknown, node: { id?: string }) => {
      if (node.id) selectWidgets([node.id]);
    },
    [selectWidgets]
  );

  const toggleVisibility = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const widget = screen.widgets[id];
      if (widget) {
        updateWidget(id, { visible: !widget.visible });
      }
    },
    [screen.widgets, updateWidget]
  );

  const renderNode = (id: string) => {
    const widget = screen.widgets[id];
    if (!widget) return null;

    if (
      filter &&
      !widget.name.toLowerCase().includes(filter.toLowerCase()) &&
      !widget.type.toLowerCase().includes(filter.toLowerCase())
    ) {
      return null;
    }

    const def = widgetRegistry.get(widget.type);
    const isSelected = selection.selectedIds.includes(widget.id);
    const hasChildren = widget.children && widget.children.length > 0;

    return (
      <TreeNode
        key={widget.id}
        id={widget.id}
        label={
          <span
            className={`tree-node__label ${isSelected ? 'tree-node__label--selected' : ''} ${!widget.visible ? 'tree-node__label--hidden' : ''}`}
          >
            <span className="tree-node__type">{def?.label ?? widget.type}</span>
            <span className="tree-node__name">{widget.name}</span>
            <button
              className="tree-node__visibility"
              onClick={(e) => toggleVisibility(e, widget.id)}
              title={widget.visible ? 'Hide' : 'Show'}
            >
              {widget.visible ? <View size={12} /> : <ViewOff size={12} />}
            </button>
          </span>
        }
        isExpanded={hasChildren}
      >
        {hasChildren && widget.children!.map((childId) => renderNode(childId))}
      </TreeNode>
    );
  };

  return (
    <div className={`component-tree ${collapsed ? 'component-tree--collapsed' : ''}`}>
      <div className="component-tree__header">
        <span>Component Tree</span>
        <button
          type="button"
          className="component-tree__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand Component Tree panel' : 'Collapse Component Tree panel'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronLeft size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="component-tree__search">
            <Search
              size="sm"
              labelText="Filter components"
              placeholder="Search..."
              value={filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            />
          </div>
          <div className="component-tree__content">
            <TreeView
              label="Screen"
              onSelect={handleSelect}
              selected={selection.selectedIds}
              multiselect={false}
            >
              {screen.rootWidgetIds.map((id) => renderNode(id))}
            </TreeView>
            {screen.rootWidgetIds.length === 0 && (
              <div className="component-tree__empty">
                Drag widgets from the palette to get started
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

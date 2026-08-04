import { useCallback, useState } from 'react';
import { Close } from '@carbon/icons-react';
import { useEditorStore } from '../editor/model/EditorStore';
import './TabBar.scss';

/**
 * Horizontal strip of open-document tabs above the canvas. Each tab shows the
 * screen title (with a `*` marker if dirty) plus a close button. Clicking the
 * body activates the tab; double-clicking the active tab's title opens an
 * inline rename input (same UX as the previous single-screen title editor).
 */
export function TabBar() {
  const tabs = useEditorStore((s) => s.tabs);
  const tabOrder = useEditorStore((s) => s.tabOrder);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activateTab = useEditorStore((s) => s.activateTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const updateScreenMeta = useEditorStore((s) => s.updateScreenMeta);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startRename = useCallback((id: string, current: string) => {
    setRenamingId(id);
    setDraft(current);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const trimmed = draft.trim();
    const tab = tabs[renamingId];
    if (trimmed && tab && trimmed !== tab.screen.meta.title) {
      // updateScreenMeta writes to the active tab only, so activate first if
      // the user renamed a non-active tab (they can't today — double-click is
      // gated to the active tab — but keep the invariant explicit).
      if (renamingId !== activeTabId) activateTab(renamingId);
      updateScreenMeta({ title: trimmed });
    }
    setRenamingId(null);
  }, [renamingId, draft, tabs, activeTabId, activateTab, updateScreenMeta]);

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const tab = tabs[id];
      if (tab?.isDirty && !confirm(`Discard unsaved changes in "${tab.screen.meta.title}"?`)) {
        return;
      }
      closeTab(id);
    },
    [tabs, closeTab]
  );

  const activeTab = tabs[activeTabId];
  const activeFileName = activeTab?.filePath ? activeTab.filePath.split(/[/\\]/).pop() : null;

  return (
    <div className="tab-bar">
      <div className="tab-bar__tabs" role="tablist">
        {tabOrder.map((id) => {
          const tab = tabs[id];
          if (!tab) return null;
          const isActive = id === activeTabId;
          const isRenaming = renamingId === id;
          const title = tab.screen.meta.title;
          return (
            <div
              key={id}
              role="tab"
              aria-selected={isActive}
              className={`tab-bar__tab ${isActive ? 'tab-bar__tab--active' : ''} ${tab.isDirty ? 'tab-bar__tab--dirty' : ''}`}
              onClick={() => !isRenaming && activateTab(id)}
            >
              {isRenaming ? (
                <input
                  className="tab-bar__rename-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => setTimeout(commitRename, 100)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  ref={(el) => {
                    if (el) {
                      // Defer focus so the double-click mouseup doesn't steal it
                      requestAnimationFrame(() => {
                        el.focus();
                        el.select();
                      });
                    }
                  }}
                />
              ) : (
                <span
                  className="tab-bar__label"
                  onDoubleClick={() => isActive && startRename(id, title)}
                  title={isActive ? 'Double-click to rename' : title}
                >
                  {title}
                  {tab.isDirty && <span className="tab-bar__dirty-dot"> *</span>}
                </span>
              )}
              <button
                type="button"
                className="tab-bar__close"
                onClick={(e) => handleClose(e, id)}
                aria-label={`Close ${title}`}
                title="Close"
              >
                <Close size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {activeFileName && <span className="tab-bar__file-path">{activeFileName}</span>}
    </div>
  );
}

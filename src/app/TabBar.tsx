import { useCallback, useEffect, useRef, useState } from 'react';
import { Close } from '@carbon/icons-react';
import { useEditorStore } from '../editor/model/EditorStore';
import './TabBar.scss';

// Grace period during which the scrollbar stays visible after the last scroll
// event before fading back out — long enough that trackpad flick-scrolls feel
// smooth, short enough that the bar doesn't linger.
const SCROLLBAR_HIDE_DELAY_MS = 800;

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

  // Native scrollbar is hidden entirely; we render a custom absolute-positioned
  // thumb over the bottom edge of the bar so the tab strip stays exactly 32px
  // tall (no reserved lane, no layout shift). Position and width are computed
  // from `.tab-bar__tabs`'s scrollLeft / scrollWidth / clientWidth.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [scrollbarVisible, setScrollbarVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [thumb, setThumb] = useState({ hasOverflow: false, left: 0, width: 0 });
  const scrollHideTimer = useRef<number | null>(null);

  const syncThumb = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1; // 1px slack for rounding
    if (!hasOverflow) {
      setThumb({ hasOverflow: false, left: 0, width: 0 });
      return;
    }
    const width = Math.max(24, (el.clientWidth / el.scrollWidth) * el.clientWidth);
    const scrollable = el.scrollWidth - el.clientWidth;
    const trackSpace = el.clientWidth - width;
    const left = scrollable > 0 ? (el.scrollLeft / scrollable) * trackSpace : 0;
    setThumb({ hasOverflow: true, left, width });
  }, []);

  // Resync on window resize / tab list changes.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    syncThumb();
    const ro = new ResizeObserver(syncThumb);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncThumb, tabOrder]);

  const handleScroll = useCallback(() => {
    syncThumb();
    setScrollbarVisible(true);
    if (scrollHideTimer.current !== null) window.clearTimeout(scrollHideTimer.current);
    scrollHideTimer.current = window.setTimeout(() => {
      if (!isHovering) setScrollbarVisible(false);
      scrollHideTimer.current = null;
    }, SCROLLBAR_HIDE_DELAY_MS);
  }, [syncThumb, isHovering]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    setScrollbarVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (scrollHideTimer.current === null) setScrollbarVisible(false);
  }, []);

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
    <div className="tab-bar" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="tab-bar__tabs" ref={tabsRef} role="tablist" onScroll={handleScroll}>
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
      {thumb.hasOverflow && (
        <div
          className={`tab-bar__scrollbar ${scrollbarVisible ? 'tab-bar__scrollbar--visible' : ''}`}
          aria-hidden
        >
          <div
            className="tab-bar__scrollbar-thumb"
            style={{ left: thumb.left, width: thumb.width }}
          />
        </div>
      )}
    </div>
  );
}

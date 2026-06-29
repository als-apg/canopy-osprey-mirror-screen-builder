import type { ReactNode } from 'react';
import type { Widget } from '../../types/widget';
import './WidgetOverlay.scss';

interface WidgetOverlayProps {
  widget: Widget;
  isSelected: boolean;
  isHovered: boolean;
  onHover: () => void;
  onHoverEnd: () => void;
  children: ReactNode;
  /**
   * Absolute origin of the immediate parent container, subtracted from this
   * widget's absolute `layout` so it positions correctly inside the parent's
   * box. Widget geometry is stored absolute (the IR contract), but child
   * overlays render *nested* in the parent's DOM, so the parent's offset must
   * be cancelled out. Omitted (0,0) for top-level widgets.
   */
  parentOrigin?: { x: number; y: number };
}

export function WidgetOverlay({
  widget,
  isSelected,
  isHovered,
  onHover,
  onHoverEnd,
  children,
  parentOrigin,
}: WidgetOverlayProps) {
  const { width, height } = widget.layout;
  const x = widget.layout.x - (parentOrigin?.x ?? 0);
  const y = widget.layout.y - (parentOrigin?.y ?? 0);

  return (
    <div
      className={`widget-overlay ${isSelected ? 'widget-overlay--selected' : ''} ${isHovered ? 'widget-overlay--hovered' : ''}`}
      data-widget-id={widget.id}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
        zIndex: widget.zIndex,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      {children}

      {/* Selection handles */}
      {isSelected && (
        <>
          <div className="widget-overlay__handle widget-overlay__handle--nw" />
          <div className="widget-overlay__handle widget-overlay__handle--ne" />
          <div className="widget-overlay__handle widget-overlay__handle--sw" />
          <div className="widget-overlay__handle widget-overlay__handle--se" />
          <div className="widget-overlay__handle widget-overlay__handle--n" />
          <div className="widget-overlay__handle widget-overlay__handle--s" />
          <div className="widget-overlay__handle widget-overlay__handle--e" />
          <div className="widget-overlay__handle widget-overlay__handle--w" />
        </>
      )}

      {/* Widget name label */}
      {(isSelected || isHovered) && <div className="widget-overlay__label">{widget.name}</div>}
    </div>
  );
}

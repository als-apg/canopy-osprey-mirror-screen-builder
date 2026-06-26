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
}

export function WidgetOverlay({
  widget,
  isSelected,
  isHovered,
  onHover,
  onHoverEnd,
  children,
}: WidgetOverlayProps) {
  const { x, y, width, height } = widget.layout;

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

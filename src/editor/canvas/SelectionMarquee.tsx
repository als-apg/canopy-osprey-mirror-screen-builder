import './SelectionMarquee.scss';

interface SelectionMarqueeProps {
  rect: { x: number; y: number; w: number; h: number };
}

export function SelectionMarquee({ rect }: SelectionMarqueeProps) {
  return (
    <div
      className="selection-marquee"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      }}
    />
  );
}

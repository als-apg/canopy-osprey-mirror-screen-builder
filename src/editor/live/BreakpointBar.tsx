import {
  Laptop,
  TabletLandscape,
  Mobile,
  FitToScreen,
  Screen as ScreenIcon,
} from '@carbon/icons-react';
import './BreakpointBar.scss';

interface Breakpoint {
  id: string;
  label: string;
  width: number;
  icon: React.ReactNode;
}

const BREAKPOINTS: Breakpoint[] = [
  { id: 'auto', label: 'Auto (fit)', width: 0, icon: <FitToScreen size={16} /> },
  { id: 'sm', label: 'Mobile (320)', width: 320, icon: <Mobile size={16} /> },
  { id: 'md', label: 'Tablet (672)', width: 672, icon: <TabletLandscape size={16} /> },
  { id: 'lg', label: 'Desktop (1056)', width: 1056, icon: <Laptop size={16} /> },
  { id: 'xlg', label: 'Large (1312)', width: 1312, icon: <ScreenIcon size={16} /> },
  { id: 'max', label: 'Max (1584)', width: 1584, icon: <ScreenIcon size={16} /> },
];

interface BreakpointBarProps {
  activeBreakpoint: string;
  onBreakpointChange: (id: string) => void;
  customWidth: number | null;
  onCustomWidthChange: (width: number | null) => void;
  viewportWidth: number;
}

export function BreakpointBar({
  activeBreakpoint,
  onBreakpointChange,
  customWidth,
  onCustomWidthChange,
  viewportWidth,
}: BreakpointBarProps) {
  return (
    <div className="breakpoint-bar">
      <span className="breakpoint-bar__label">Preview:</span>
      <div className="breakpoint-bar__buttons">
        {BREAKPOINTS.map((bp) => (
          <button
            key={bp.id}
            className={`breakpoint-bar__btn ${activeBreakpoint === bp.id ? 'breakpoint-bar__btn--active' : ''}`}
            onClick={() => {
              onBreakpointChange(bp.id);
              onCustomWidthChange(bp.width === 0 ? null : bp.width);
            }}
            title={bp.label}
          >
            {bp.icon}
          </button>
        ))}
      </div>
      <div className="breakpoint-bar__size">
        <input
          type="number"
          className="breakpoint-bar__width-input"
          value={customWidth ?? viewportWidth}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (val > 0) {
              onCustomWidthChange(val);
              onBreakpointChange('custom');
            }
          }}
          min={200}
          max={3000}
        />
        <span className="breakpoint-bar__px">px</span>
      </div>
    </div>
  );
}

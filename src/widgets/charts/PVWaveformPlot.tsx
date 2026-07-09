import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { WidgetRendererProps } from '../registry/WidgetRegistry';

// Per-curve config as produced by the converter's `parseJsonStrings` transform
// (originally PyDM's `curves` stringlist of JSON blobs). All fields optional —
// we render whatever is present and tolerate missing/unknown keys.
interface CurveConfig {
  y_channel?: string;
  x_channel?: string | null;
  name?: string;
  color?: string;
  lineStyle?: number;
  lineWidth?: number;
  yAxisName?: string;
}

// Per-axis config (PyDM's `yAxes`). Only what we render is typed.
interface AxisConfig {
  name?: string;
  label?: string;
  orientation?: string;
}

// ECharts line-style dash from PyDM's numeric lineStyle (1 = solid, 2 = dash,
// 3 = dot — the common Qt::PenStyle ordering). Unknown → solid.
function dashFromLineStyle(style: number | undefined): 'solid' | 'dashed' | 'dotted' {
  if (style === 2) return 'dashed';
  if (style === 3 || style === 4) return 'dotted';
  return 'solid';
}

function asCurves(value: unknown): CurveConfig[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is CurveConfig => typeof c === 'object' && c !== null);
}

function asAxes(value: unknown): AxisConfig[] {
  if (!Array.isArray(value)) return [];
  return value.filter((a): a is AxisConfig => typeof a === 'object' && a !== null);
}

/**
 * PVWaveformPlot — an ECharts line plot of the configured curves.
 *
 * v1 renders the configured curves/axes/legend/title (mirroring
 * react-trace's ECharts usage) with empty series data — live PV plotting per
 * curve is a follow-up. The curve/axis configuration is fully preserved so the
 * widget round-trips through save/open.
 */
export function PVWaveformPlot({ layout, props }: WidgetRendererProps) {
  const curves = asCurves(props.curves);
  const yAxes = asAxes(props.yAxes);
  const title = props.title as string | undefined;
  const rawXLabels = props.xLabels;

  const option = useMemo(() => {
    const xLabels = Array.isArray(rawXLabels) ? (rawXLabels as string[]) : [];
    const series = curves.map((c, i) => ({
      name: c.name || c.y_channel || `Curve ${i + 1}`,
      type: 'line' as const,
      showSymbol: false,
      data: [] as number[],
      lineStyle: {
        color: c.color,
        width: c.lineWidth ?? 1,
        type: dashFromLineStyle(c.lineStyle),
      },
      itemStyle: { color: c.color },
    }));

    return {
      backgroundColor: 'transparent',
      title: title
        ? { text: stripHtml(title), left: 'center', textStyle: { fontSize: 11 } }
        : undefined,
      grid: { left: 48, right: 16, top: title ? 32 : 16, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        name: xLabels[0] ?? '',
        axisLabel: { fontSize: 9 },
      },
      yAxis: {
        type: 'value' as const,
        name: yAxes[0]?.label ?? '',
        axisLabel: { fontSize: 9 },
      },
      legend: series.length > 1 ? { bottom: 0, textStyle: { fontSize: 9 } } : undefined,
      series,
    };
  }, [curves, yAxes, title, rawXLabels]);

  return (
    <div style={{ width: layout.width, height: layout.height, overflow: 'hidden' }}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}

// PyDM plot titles are sometimes HTML (e.g. `<div ...>Foo</div>`). Strip tags
// for the plain-text ECharts title.
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

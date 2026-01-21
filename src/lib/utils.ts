import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SeriesConfig {
  id: string;
  dataKey: string;
  name: string;
  type: 'line' | 'bar';
  yAxisId: 'left' | 'right';
  color: string;
  visible: boolean;
  strokeWidth: number;
  showDot: boolean;
}

export interface AxisConfig {
  label: string;
  unit: string;
  min: number | '';
  max: number | '';
}

export interface ChartConfig {
  title: string;
  xAxisKey: string;
  showGrid: boolean;
  axes: {
    left: AxisConfig;
    right: AxisConfig;
    bottom: AxisConfig;
  };
  series: SeriesConfig[];
}

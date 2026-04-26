import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AggregationBucket, ChartType } from '@/api/charts';

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626', '#65a30d', '#ca8a04'];

function formatX(x: AggregationBucket['x']): string {
  if (x === null || x === undefined) return '(null)';
  if (typeof x === 'number') return String(x);
  // Date strings get truncated to YYYY-MM-DD if ISO
  if (/^\d{4}-\d{2}-\d{2}T/.test(x)) return x.slice(0, 10);
  return x;
}

export interface ChartRendererProps {
  type: ChartType;
  buckets: AggregationBucket[];
  height?: number;
}

export function ChartRenderer({ type, buckets, height = 300 }: ChartRendererProps) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No data to display
      </div>
    );
  }

  const data = buckets.map((b) => ({ x: formatX(b.x), y: b.y }));

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="y" nameKey="x" outerRadius={Math.min(110, height / 2.6)} label>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="y" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="y" fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  );
}

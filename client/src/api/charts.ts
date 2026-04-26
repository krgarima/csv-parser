import { api } from './client';
import type { ColumnMeta } from './datasets';

export type ChartType = 'bar' | 'line' | 'pie';
export type AggregationFn = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface Chart {
  id: string;
  userId: string;
  datasetId: string;
  name: string;
  type: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
  position: number;
  createdAt: string;
}

export interface AggregationBucket {
  x: string | number | null;
  y: number;
}

export interface ChartCreateInput {
  datasetId: string;
  name: string;
  type: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
}

export async function listCharts(): Promise<Chart[]> {
  const { data } = await api.get('/api/charts');
  return data.charts as Chart[];
}

export async function createChart(input: ChartCreateInput): Promise<Chart> {
  const { data } = await api.post('/api/charts', input);
  return data.chart as Chart;
}

export async function deleteChart(id: string): Promise<void> {
  await api.delete(`/api/charts/${id}`);
}

export async function getChartData(id: string): Promise<{
  chart: Chart;
  buckets: AggregationBucket[];
  columnsMeta: ColumnMeta[];
}> {
  const { data } = await api.get(`/api/charts/${id}/data`);
  return data;
}

export async function previewChart(input: {
  datasetId: string;
  type: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
}): Promise<{ buckets: AggregationBucket[]; type: ChartType }> {
  const { data } = await api.post('/api/charts/preview', input);
  return data;
}

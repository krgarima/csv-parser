import { api } from './client';
import type { AggregationBucket, AggregationFn, ChartType } from './charts';

export interface AskResponseSpec {
  chartType: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
}

export async function askQuestion(input: {
  datasetId: string;
  question: string;
}): Promise<{ spec: AskResponseSpec; buckets: AggregationBucket[] }> {
  const { data } = await api.post('/api/ai/ask', input);
  return data;
}

export async function explainChart(chartId: string): Promise<{
  explanation: { summary: string; followUp: string };
}> {
  const { data } = await api.post('/api/ai/explain', { chartId });
  return data;
}

export interface SuggestedQuestion {
  text: string;
  chartType: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
}

export async function suggestQuestions(datasetId: string): Promise<{ questions: SuggestedQuestion[] }> {
  const { data } = await api.post('/api/ai/suggest', { datasetId });
  return data;
}

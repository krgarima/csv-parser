import { api } from './client';

export type ColumnType = 'number' | 'date' | 'text';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  nullCount: number;
  sample: unknown[];
}

export interface ParseError {
  rowIndex: number;
  column: string;
  raw: string;
  reason: string;
}

export interface DatasetSummary {
  id: string;
  userId: string;
  name: string;
  originalFilename: string;
  rowCount: number;
  columnsMeta: ColumnMeta[];
  parseErrors: ParseError[];
  createdAt: string;
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const { data } = await api.get('/api/datasets');
  return data.datasets as DatasetSummary[];
}

export async function getDataset(id: string): Promise<DatasetSummary> {
  const { data } = await api.get(`/api/datasets/${id}`);
  return data.dataset as DatasetSummary;
}

export async function uploadDataset(input: {
  name?: string;
  file: File;
}): Promise<DatasetSummary> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.name) form.append('name', input.name);
  const { data } = await api.post('/api/datasets', form);
  return data.dataset as DatasetSummary;
}

export async function deleteDataset(id: string): Promise<void> {
  await api.delete(`/api/datasets/${id}`);
}

export async function getRows(input: {
  datasetId: string;
  page: number;
  pageSize: number;
}): Promise<{
  rows: Record<string, string | number | null>[];
  total: number;
  columnsMeta: ColumnMeta[];
  page: number;
  pageSize: number;
}> {
  const { data } = await api.get(`/api/datasets/${input.datasetId}/rows`, {
    params: { page: input.page, pageSize: input.pageSize },
  });
  return data;
}

export async function replaceData(input: {
  datasetId: string;
  file: File;
}): Promise<{ dataset: DatasetSummary; schemaChanged: boolean }> {
  const form = new FormData();
  form.append('file', input.file);
  const { data } = await api.put(`/api/datasets/${input.datasetId}/data`, form);
  return data;
}

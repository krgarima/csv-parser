import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartRenderer } from '@/features/charts/ChartRenderer';
import type { AskResponseSpec } from '@/api/ai';
import {
  createChart,
  listCharts,
  previewChart,
  type AggregationFn,
  type ChartType,
} from '@/api/charts';
import type { DatasetSummary } from '@/api/datasets';

interface BuilderSpec {
  type: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
}

export function ChartBuilder({
  dataset,
  initialSpec,
}: {
  dataset: DatasetSummary;
  initialSpec?: AskResponseSpec | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const firstNumberCol = useMemo(() => dataset.columnsMeta.find((c) => c.type === 'number'), [dataset]);
  const firstNonNumberCol = useMemo(
    () => dataset.columnsMeta.find((c) => c.type !== 'number') ?? dataset.columnsMeta[0],
    [dataset],
  );

  const [spec, setSpec] = useState<BuilderSpec>(() => ({
    type: initialSpec?.chartType ?? 'bar',
    xColumn: initialSpec?.xColumn ?? firstNonNumberCol?.name ?? '',
    yColumn: initialSpec?.yColumn ?? firstNumberCol?.name ?? null,
    aggregation: initialSpec?.aggregation ?? (firstNumberCol ? 'sum' : 'count'),
  }));

  useEffect(() => {
    if (initialSpec) {
      setSpec({
        type: initialSpec.chartType,
        xColumn: initialSpec.xColumn,
        yColumn: initialSpec.yColumn,
        aggregation: initialSpec.aggregation,
      });
    }
  }, [initialSpec]);

  const { data: chartsList } = useQuery({ queryKey: ['charts'], queryFn: listCharts });
  const chartCount = chartsList?.length ?? 0;
  const atCap = chartCount >= 3;

  const numberColumns = dataset.columnsMeta.filter((c) => c.type === 'number');

  const previewEnabled =
    !!spec.xColumn && (spec.aggregation === 'count' || !!spec.yColumn);

  const { data: preview, isFetching: isPreviewing, error: previewError } = useQuery({
    queryKey: ['preview', dataset.id, spec],
    queryFn: () =>
      previewChart({
        datasetId: dataset.id,
        type: spec.type,
        xColumn: spec.xColumn,
        yColumn: spec.aggregation === 'count' ? null : spec.yColumn,
        aggregation: spec.aggregation,
      }),
    enabled: previewEnabled,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      createChart({
        datasetId: dataset.id,
        name: name.trim() || `${spec.aggregation} of ${spec.yColumn ?? 'rows'} by ${spec.xColumn}`,
        type: spec.type,
        xColumn: spec.xColumn,
        yColumn: spec.aggregation === 'count' ? null : spec.yColumn,
        aggregation: spec.aggregation,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charts'] });
      setName('');
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err?.response?.data?.error?.message ?? 'Save failed');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build a chart</CardTitle>
        <CardDescription>
          Pick X, Y, an aggregation, and a chart type. Save up to 3 to your dashboard.
          {atCap && " (You're at the 3-chart limit — delete one to add another.)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <FieldSelect
            label="Chart type"
            value={spec.type}
            options={[
              { value: 'bar', label: 'Bar' },
              { value: 'line', label: 'Line' },
              { value: 'pie', label: 'Pie' },
            ]}
            onChange={(v) => setSpec((s) => ({ ...s, type: v as ChartType }))}
            help="Bar for categories, line for trends over time, pie for shares of a whole."
          />
          <FieldSelect
            label="X axis (group by)"
            value={spec.xColumn}
            options={dataset.columnsMeta.map((c) => ({
              value: c.name,
              label: `${c.name} (${c.type})`,
            }))}
            onChange={(v) => setSpec((s) => ({ ...s, xColumn: v }))}
            help="The column whose values become the buckets along the X axis."
          />
          <FieldSelect
            label="Aggregation"
            value={spec.aggregation}
            options={[
              { value: 'count', label: 'count (rows)' },
              { value: 'sum', label: 'sum' },
              { value: 'avg', label: 'avg' },
              { value: 'min', label: 'min' },
              { value: 'max', label: 'max' },
            ]}
            onChange={(v) =>
              setSpec((s) => ({
                ...s,
                aggregation: v as AggregationFn,
                yColumn: v === 'count' ? null : s.yColumn ?? numberColumns[0]?.name ?? null,
              }))
            }
            help="How to summarize the Y values within each X bucket. 'count' just counts rows."
          />
          {spec.aggregation !== 'count' && (
            <FieldSelect
              label="Y axis (numeric)"
              value={spec.yColumn ?? ''}
              options={numberColumns.map((c) => ({ value: c.name, label: c.name }))}
              placeholder={numberColumns.length === 0 ? 'No numeric columns' : 'Pick a column'}
              onChange={(v) => setSpec((s) => ({ ...s, yColumn: v }))}
              disabled={numberColumns.length === 0}
              help="The numeric column to aggregate. Must be a number-typed column."
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="chart-name">Chart name (optional)</Label>
            <Input
              id="chart-name"
              placeholder={`${spec.aggregation} of ${spec.yColumn ?? 'rows'} by ${spec.xColumn}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending || atCap || !preview} className="gap-2">
            <Save className="h-4 w-4" />
            {save.isPending ? 'Saving…' : 'Save chart'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Live preview</p>
          {!previewEnabled && (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground text-center">
              Pick an X axis and Y column to preview.
            </div>
          )}
          {previewEnabled && isPreviewing && (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              Running aggregation…
            </div>
          )}
          {previewEnabled && previewError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {(previewError as { response?: { data?: { error?: { message?: string } } } })?.response?.data
                ?.error?.message ?? 'Preview failed'}
            </div>
          )}
          {preview && <ChartRenderer type={spec.type} buckets={preview.buckets} height={240} />}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  help,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

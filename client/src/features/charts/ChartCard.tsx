import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteChart, getChartData, type Chart } from '@/api/charts';
import { ChartRenderer } from './ChartRenderer';
import { ExplainChartButton } from '@/features/ai/ExplainChartButton';

export function ChartCard({ chart }: { chart: Chart }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['chartData', chart.id],
    queryFn: () => getChartData(chart.id),
  });

  const del = useMutation({
    mutationFn: () => deleteChart(chart.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charts'] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{chart.name}</CardTitle>
          <CardDescription className="text-xs mt-1">
            {chart.aggregation === 'count' ? 'count' : `${chart.aggregation}(${chart.yColumn})`} by {chart.xColumn}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => del.mutate()}
          disabled={del.isPending}
          title="Delete chart"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <div className="h-[200px] flex items-center text-sm text-muted-foreground">Loading…</div>}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Couldn't render this chart. The dataset's columns may have changed.
          </div>
        )}
        {data && <ChartRenderer type={chart.type} buckets={data.buckets} />}
        <ExplainChartButton chartId={chart.id} />
      </CardContent>
    </Card>
  );
}

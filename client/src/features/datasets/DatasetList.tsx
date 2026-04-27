import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { listDatasets, uploadDataset } from '@/api/datasets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DatasetList() {
  const qc = useQueryClient();
  const [sampleError, setSampleError] = useState<string | null>(null);

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  });

  const loadSample = useMutation({
    mutationFn: async () => {
      const res = await fetch('/sample-sales.csv');
      if (!res.ok) throw new Error('Could not load sample CSV');
      const blob = await res.blob();
      const file = new File([blob], 'sample-sales.csv', { type: 'text/csv' });
      return uploadDataset({ file, name: 'Sample Sales' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['datasets'] });
      setSampleError(null);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } } | Error) => {
      const msg =
        ('response' in err && err.response?.data?.error?.message) ||
        ('message' in err ? err.message : 'Failed to load sample');
      setSampleError(msg);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading datasets…</p>;
  }

  if (!datasets || datasets.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground max-w-md">
            No datasets yet. Upload a CSV above — sales, leads, transactions, anything tabular —
            and we'll detect column types so you can build charts and ask questions about it.
          </p>
          <Button
            variant="secondary"
            onClick={() => loadSample.mutate()}
            disabled={loadSample.isPending}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {loadSample.isPending ? 'Loading sample…' : 'Try the sample sales dataset'}
          </Button>
          {sampleError && <p className="text-sm text-destructive">{sampleError}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {datasets.map((d) => (
        <Card key={d.id}>
          <CardHeader>
            <CardTitle className="truncate">{d.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              {d.rowCount.toLocaleString()} rows · {d.columnsMeta.length} columns
            </p>
            {d.parseErrors.length > 0 && (
              <p className="text-amber-600">
                {d.parseErrors.length} parse warning{d.parseErrors.length === 1 ? '' : 's'}
              </p>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              {d.columnsMeta.slice(0, 6).map((c) => (
                <span
                  key={c.name}
                  className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                >
                  {c.name}: {c.type}
                </span>
              ))}
              {d.columnsMeta.length > 6 && (
                <span className="px-2 py-0.5 text-xs text-muted-foreground">
                  +{d.columnsMeta.length - 6} more
                </span>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="mt-2 self-start">
              <Link to={`/datasets/${d.id}`}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

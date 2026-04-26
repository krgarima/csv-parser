import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listDatasets } from '@/api/datasets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DatasetList() {
  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading datasets…</p>;
  }

  if (!datasets || datasets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No datasets yet. Upload one above to get started.
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

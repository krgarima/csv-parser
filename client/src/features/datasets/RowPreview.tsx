import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRows } from '@/api/datasets';

export function RowPreview({ datasetId }: { datasetId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['rows', datasetId, page, pageSize],
    queryFn: () => getRows({ datasetId, page, pageSize }),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading rows…</p>;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const columns = data.columnsMeta.map((c) => c.name);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 whitespace-nowrap">
                    {row[c] === null || row[c] === undefined ? (
                      <span className="text-muted-foreground italic">null</span>
                    ) : (
                      String(row[c])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Page {page} of {totalPages} · {data.total.toLocaleString()} rows
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDataset } from '@/api/datasets';
import type { AskResponseSpec } from '@/api/ai';
import { DashboardHeader } from '@/features/dashboard/DashboardHeader';
import { RowPreview } from './RowPreview';
import { ReplaceDataModal } from './ReplaceDataModal';
import { ChartBuilder } from '@/features/chart-builder/ChartBuilder';
import { AskQuestion } from '@/features/ai/AskQuestion';
import { SuggestedQuestions } from '@/features/ai/SuggestedQuestions';

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [appliedSpec, setAppliedSpec] = useState<AskResponseSpec | null>(null);

  const { data: dataset, isLoading, error } = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => getDataset(id!),
    enabled: !!id,
  });

  if (isLoading || !id) {
    return (
      <div className="min-h-screen bg-muted/30">
        <DashboardHeader />
        <main className="container py-6 text-sm text-muted-foreground">Loading dataset…</main>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="min-h-screen bg-muted/30">
        <DashboardHeader />
        <main className="container py-6">
          <p className="text-sm text-destructive">Dataset not found.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader />
      <main className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="gap-1 -ml-3">
              <Link to="/dashboard">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-xl font-semibold mt-1">{dataset.name}</h1>
            <p className="text-sm text-muted-foreground">
              {dataset.rowCount.toLocaleString()} rows · {dataset.columnsMeta.length} columns
            </p>
          </div>
          <ReplaceDataModal datasetId={dataset.id} datasetName={dataset.name} />
        </div>

        {dataset.parseErrors.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              {dataset.parseErrors.length} parse warning{dataset.parseErrors.length === 1 ? '' : 's'}
            </p>
            <p className="text-xs mt-1">
              Some cells couldn't be parsed as their inferred column type. Those cells were stored as null.
              First few:
            </p>
            <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5">
              {dataset.parseErrors.slice(0, 3).map((e, i) => (
                <li key={i}>
                  Row {e.rowIndex + 1}, column "{e.column}": {e.reason} (raw: {JSON.stringify(e.raw)})
                </li>
              ))}
            </ul>
          </div>
        )}

        <SuggestedQuestions datasetId={dataset.id} onApply={setAppliedSpec} />

        <AskQuestion datasetId={dataset.id} onApplySpec={setAppliedSpec} />

        <ChartBuilder dataset={dataset} initialSpec={appliedSpec} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Data preview</h2>
          <RowPreview datasetId={dataset.id} />
        </section>
      </main>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { listCharts } from '@/api/charts';
import { listDatasets } from '@/api/datasets';
import { ChartCard } from '@/features/charts/ChartCard';
import { DashboardHeader } from './DashboardHeader';
import { UploadCard } from '@/features/datasets/UploadCard';
import { DatasetList } from '@/features/datasets/DatasetList';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardPage() {
  const { data: charts } = useQuery({ queryKey: ['charts'], queryFn: listCharts });
  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: listDatasets });
  const hasDatasets = (datasets?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader />
      <main className="container py-6 space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your data</h2>
          <UploadCard />
          <DatasetList />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Saved charts</h2>
          {!hasDatasets && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Upload a dataset, then open it to start building charts.
              </CardContent>
            </Card>
          )}
          {hasDatasets && (charts?.length ?? 0) === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No charts saved yet. Open a dataset to build one.
              </CardContent>
            </Card>
          )}
          {charts && charts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {charts.map((c) => (
                <ChartCard key={c.id} chart={c} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

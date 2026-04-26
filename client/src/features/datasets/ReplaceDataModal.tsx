import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { replaceData } from '@/api/datasets';

export function ReplaceDataModal({ datasetId, datasetName }: { datasetId: string; datasetName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const replace = useMutation({
    mutationFn: (file: File) => replaceData({ datasetId, file }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['datasets'] });
      qc.invalidateQueries({ queryKey: ['dataset', datasetId] });
      qc.invalidateQueries({ queryKey: ['rows', datasetId] });
      qc.invalidateQueries({ queryKey: ['chartData'] });
      if (result.schemaChanged) {
        setWarning(
          'Heads up: column names or types changed. Existing charts may stop working until you update them.',
        );
      } else {
        setWarning(null);
        setOpen(false);
      }
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err?.response?.data?.error?.message ?? 'Replace failed');
    },
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    replace.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Replace data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace data in "{datasetName}"</DialogTitle>
          <DialogDescription>
            Re-upload a CSV. Existing charts that reference this dataset will be re-pointed at the new data
            automatically. If the column schema changes, charts may need updating.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button onClick={() => inputRef.current?.click()} disabled={replace.isPending}>
            {replace.isPending ? 'Uploading…' : 'Choose new CSV'}
          </Button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {warning && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {warning}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
